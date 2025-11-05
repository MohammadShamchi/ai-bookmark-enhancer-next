# P0-05: Inconsistent AI Categorization Results

**Priority**: P0 - CRITICAL
**Impact**: Same bookmarks get different categories on different runs
**Estimated Fix Time**: 2-3 hours
**Risk Level**: MEDIUM (changes AI prompting strategy)

---

## 🎯 Problem Description

Running the same bookmarks through the organizer produces **different results each time**. Categories change, folder names vary, and organization is unpredictable.

**User Quote**: "maybe some times give ok answer with proper folder but other times through the exact like before bookmarks which is not fine"

### Root Causes

1. **No context between chunks**: Each chunk (400 bookmarks) is processed independently, AI doesn't know what categories were created for previous chunks
2. **Temperature 0.2**: Low but not deterministic (0 = deterministic)
3. **No seed parameter**: OpenAI's seed parameter ensures reproducibility
4. **Vague prompts**: Generic instructions lead to varied interpretations
5. **No constraints**: AI can invent any category names it wants

### Example of Inconsistency

**Run 1:**
```json
{
  "folders": [
    {"name": "Technology", "ids": ["1", "2", "3"]},
    {"name": "News", "ids": ["4", "5"]}
  ]
}
```

**Run 2 (same bookmarks):**
```json
{
  "folders": [
    {"name": "Tech", "ids": ["1", "2"]},
    {"name": "Tech News", "ids": ["3"]},
    {"name": "News & Media", "ids": ["4", "5"]}
  ]
}
```

**Problem**: Different category names, different groupings!

---

## ✅ Acceptance Criteria

1. **Consistent results**: Same bookmarks → same categories (99%+ reproducibility)
2. **Shared context**: Later chunks know about earlier categories
3. **Deterministic AI**: Use temperature=0 and seed parameter
4. **Better prompts**: Clear instructions with examples and constraints
5. **Category guidelines**: Predefined category list or naming rules
6. **Post-processing**: Merge similar categories ("Tech" + "Technology")

---

## 🔧 Suggested Implementation

### Approach: Multi-Pass with Shared Context

**File**: `lib/ai_client.js`

### Step 1: Improve System Prompt

```javascript
const SYSTEM_PROMPT = `You are an expert bookmark organizer. Your task is to categorize bookmarks into clear, consistent folders.

GUIDELINES:
1. Use broad, standard categories (e.g., "Technology", "News", "Shopping")
2. Keep folder names concise (1-3 words max)
3. Use title case for folder names
4. Avoid overly specific categories (prefer "Technology" over "JavaScript Tutorials")
5. Group related items together (e.g., all programming sites in "Development")

STANDARD CATEGORIES (prefer these when applicable):
- Development (programming, code, GitHub, Stack Overflow)
- Technology (tech news, gadgets, software)
- News (news sites, journalism, current events)
- Shopping (e-commerce, products, stores)
- Social Media (Facebook, Twitter, Reddit, etc.)
- Entertainment (movies, music, games, streaming)
- Education (courses, tutorials, learning)
- Productivity (tools, organization, time management)
- Finance (banking, investing, money)
- Health (fitness, medical, wellness)
- Travel (flights, hotels, destinations)
- Food (recipes, restaurants, cooking)
- Sports (teams, scores, athletics)
- Reference (Wikipedia, documentation, dictionaries)

If a bookmark doesn't fit any standard category, create a new one that's clear and broad.`;
```

### Step 2: Add Context-Aware Processing

```javascript
export async function categorizeBookmarks(flatList, { onProgress = null, signal = null } = {}) {
  const { OPENAI_KEY, AI_MODEL } = await chrome.storage.local.get(['OPENAI_KEY', 'AI_MODEL']);
  if (!OPENAI_KEY) {
    throw new Error('OPENAI_KEY not found in chrome.storage.local. Please set it in extension settings.');
  }

  const model = AI_MODEL || 'gpt-4o-mini';

  const { FAST_MODE } = await chrome.storage.local.get('FAST_MODE');
  if (FAST_MODE) {
    return simulateFastMode(flatList, { onProgress, signal });
  }

  const ensureActive = () => {
    if (signal?.aborted) throw new Error('CANCELLED');
  };

  const chunks = flatList.length > 500
    ? chunkArray(flatList, CHUNK_SIZE)
    : [flatList];
  const totalChunks = chunks.length;

  if (onProgress) {
    onProgress({
      percent: 80,
      label: `Analyzing with AI (0/${totalChunks})`,
      chunk: 0,
      totalChunks,
      fastMode: false,
    });
  }

  const allFolders = [];
  const existingCategories = new Set(); // Track categories across chunks

  for (let i = 0; i < chunks.length; i++) {
    ensureActive();
    const chunk = chunks[i];

    try {
      // Pass existing categories as context
      const result = await callOpenAI(
        OPENAI_KEY,
        chunk,
        false,
        signal,
        model,
        Array.from(existingCategories) // NEW: Share context
      );

      if (result.folders && Array.isArray(result.folders)) {
        // Add new categories to shared set
        result.folders.forEach((folder) => {
          if (folder.name) {
            existingCategories.add(folder.name);
          }
        });
        allFolders.push(...result.folders);
      }

      if (onProgress) {
        const progress = 80 + Math.floor(((i + 1) / totalChunks) * 15);
        onProgress({
          percent: progress,
          label: `AI analyzing chunk ${i + 1}/${totalChunks}`,
          chunk: i + 1,
          totalChunks,
          fastMode: false,
        });
      }
    } catch (error) {
      if (error.name === 'AbortError' || error.message === 'CANCELLED') {
        throw new Error('CANCELLED');
      }
      console.error(`[ai_client.js] Error processing chunk ${i + 1}:`, error);
    }
  }

  return {
    folders: allFolders,
    meta: {
      totalChunks,
      fastMode: false,
      model,
    },
  };
}
```

### Step 3: Update callOpenAI with Context and Seed

```javascript
async function callOpenAI(
  apiKey,
  chunk,
  retry = false,
  signal = null,
  model = 'gpt-4o-mini',
  existingCategories = [] // NEW: Accept existing categories
) {
  const systemPrompt = SYSTEM_PROMPT; // Use improved system prompt from Step 1

  // Build user prompt with existing category context
  let contextNote = '';
  if (existingCategories.length > 0) {
    contextNote = `\n\nEXISTING CATEGORIES from previous chunks (reuse these when appropriate):\n${existingCategories.join(', ')}\n\n`;
  }

  const userPrompt = retry
    ? `Return ONLY valid JSON with no markdown formatting or code fences. Format: {"folders":[{"name":"Category Name","ids":["id1","id2"]}]}. ${contextNote}Organize these bookmarks: ${JSON.stringify(chunk)}`
    : `${contextNote}Given this JSON list of bookmarks, return a JSON object with this exact structure:
{
  "folders": [
    { "name": "Category Name", "ids": ["id1", "id2", "id3"] }
  ]
}

Rules:
- Use only the bookmark IDs provided in the input
- Prefer existing categories listed above when they fit
- Create new categories only when necessary
- Return ONLY valid JSON, no markdown or explanatory text

Bookmarks to categorize:
${JSON.stringify(chunk)}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0, // Changed from 0.2 to 0 for determinism
      seed: 42, // NEW: Fixed seed for reproducibility
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    }),
    signal
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('INVALID_KEY');
    }
    if (res.status === 404) {
      throw new Error(`Model "${model}" not found. Update your model selection in settings.`);
    }
    const errorText = await res.text();
    throw new Error(`OpenAI API error: ${res.status} ${errorText}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('No content in OpenAI response');
  }

  // Strip markdown code fences if present
  const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    return {
      folders: parsed.folders || [],
      usage: data.usage
    };
  } catch (parseError) {
    if (!retry) {
      console.warn('[ai_client.js] JSON parse failed, retrying with stricter prompt');
      return callOpenAI(apiKey, chunk, true, signal, model, existingCategories);
    }
    console.error('[ai_client.js] Failed to parse JSON after retry:', cleaned);
    throw new Error('Failed to parse AI response as JSON');
  }
}
```

### Step 4: Add Post-Processing for Category Normalization

**File**: `lib/organizer.js` (add helper function)

```javascript
/**
 * Normalize category names to reduce duplicates
 * @param {string} name
 * @returns {string}
 */
function normalizeCategory(name) {
  const normalized = name.trim();

  // Mapping of variations to standard names
  const standardizations = {
    'tech': 'Technology',
    'programming': 'Development',
    'coding': 'Development',
    'dev': 'Development',
    'news & media': 'News',
    'media': 'News',
    'shopping & e-commerce': 'Shopping',
    'ecommerce': 'Shopping',
    'e-commerce': 'Shopping',
    'social': 'Social Media',
    'entertainment & media': 'Entertainment',
    'learning': 'Education',
    'courses': 'Education',
    'tools': 'Productivity',
    'work': 'Productivity',
  };

  const lower = normalized.toLowerCase();
  if (standardizations[lower]) {
    return standardizations[lower];
  }

  return normalized;
}

export function mergeSuggestions(aiResult, flatList) {
  const validIds = new Set(flatList.map(b => String(b.id)));

  if (!aiResult?.folders || !Array.isArray(aiResult.folders)) {
    console.warn('[organizer.js] Invalid AI result, returning empty folders');
    return { folders: [] };
  }

  const folderMap = new Map();

  for (const folder of aiResult.folders) {
    if (!folder.name || !folder.ids) continue;

    // NEW: Normalize category name
    const normalizedName = normalizeCategory(folder.name);
    const key = normalizedName.toLowerCase();

    if (!folderMap.has(key)) {
      folderMap.set(key, {
        name: normalizedName,
        ids: new Set()
      });
    }

    const merged = folderMap.get(key);

    for (const id of folder.ids) {
      const idStr = String(id);
      if (validIds.has(idStr)) {
        merged.ids.add(idStr);
      }
    }
  }

  // Rest of function unchanged...
}
```

---

## 🧪 Testing Checklist

- [ ] Run same bookmarks 3 times: Get identical results (or 95%+ similar)
- [ ] Multi-chunk test: Later chunks reuse categories from earlier chunks
- [ ] Category variation: "Tech" gets normalized to "Technology"
- [ ] Temperature 0: Results are deterministic
- [ ] Seed parameter: Ensures reproducibility
- [ ] Prompt improvements: Better category names than before
- [ ] Context awareness: Second chunk sees first chunk's categories

---

## 📊 Expected Improvement

### Before (inconsistent):
```
Run 1: Technology (45), News (23), Tech News (12), Shopping (34)
Run 2: Tech (42), News & Media (35), E-Commerce (34)
Run 3: Programming (30), Technology (27), Media (21), Shopping (34)
```
❌ **Different every time**

### After (consistent):
```
Run 1: Technology (45), News (23), Development (12), Shopping (34)
Run 2: Technology (45), News (23), Development (12), Shopping (34)
Run 3: Technology (45), News (23), Development (12), Shopping (34)
```
✅ **Same results every time**

---

## ⚠️ Important Notes

1. **Temperature 0**: Makes model deterministic but slightly less creative
2. **Seed parameter**: OpenAI's way to ensure reproducibility (supported in newer models)
3. **Context window**: Passing existing categories uses a few tokens but improves consistency dramatically
4. **Normalization**: Post-processing catches variations AI might still create
5. **Trade-off**: Slightly less flexible, but much more predictable

---

## 💡 Future Enhancements (Not in this issue)

- Let users define custom category mappings
- Learn from user edits (if user moves bookmarks, remember preference)
- Two-pass system: First pass generates categories, second pass categorizes all bookmarks with those fixed categories

---

## 📦 Files to Modify

1. ✏️ `lib/ai_client.js` - Add context sharing, improve prompts, use seed
2. ✏️ `lib/organizer.js` - Add category normalization

---

## 🔗 Related Issues

- **Depends on**: P0-01 (Sequential Processing) - conflicts with same file
- **Blocks**: None
- **Related**: P0-04 (Model selection) - different models have different consistency

---

**Critical for user satisfaction! Wait for P0-01 to be merged first.**
