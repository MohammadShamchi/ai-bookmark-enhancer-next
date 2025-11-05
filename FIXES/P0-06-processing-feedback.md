# P0-06: Minimal Processing Feedback

**Priority**: P0 - CRITICAL
**Impact**: Users feel uninformed during long processing
**Estimated Fix Time**: 1-2 hours
**Risk Level**: LOW (UI-only changes)

---

## 🎯 Problem Description

During AI processing, users only see:
- Generic progress bar (80% → 95%)
- Basic stage label: "Analyzing with AI"
- No detailed information about what's happening

For a 20-40 minute process, this leaves users:
- Not knowing if it's stuck
- Unable to see what categories are being created
- No idea how many chunks remain
- No cost/token tracking

**User Quote**: "no ui feedback which this process can makes long time or couple of minutes be patient"

### Current UI (`ui/page2.html`)

```html
<div class="stage" id="stage">Stage: Collecting bookmarks</div>
```

**Missing**:
- Chunk progress (2/6)
- Current categories found
- Token usage
- Detailed status messages

---

## 🔍 Root Cause

1. **Minimal AI status display**: Only shows in hidden developer panel
2. **Generic progress labels**: No chunk-specific information
3. **No live results**: Can't see categories as they're created

---

## ✅ Acceptance Criteria

1. **Show chunk progress**: "Processing chunk 3 of 6"
2. **Display categories found so far**: Live list of categories being created
3. **Show AI mode**: Fast mode vs normal mode clearly indicated
4. **Token usage** (optional): Display estimated cost
5. **Detailed status**: What's happening right now
6. **Visual indicators**: Spinner or animated elements
7. **Responsive updates**: Update as chunks complete

---

## 🔧 Suggested Implementation

### Step 1: Enhance Page2 HTML Structure

**File**: `ui/page2.html` (replace status section)

```html
<div class="status" id="status-section">
  <div class="status-header">
    <span>Processing</span>
    <span id="percent">0%</span>
  </div>
  <div class="progress"><div class="progress-bar" id="bar"></div></div>
  <div class="stage" id="stage">Stage: Collecting bookmarks</div>

  <!-- NEW: Detailed AI status -->
  <div class="ai-status" id="ai-status" hidden>
    <div class="ai-status-row">
      <span class="ai-label">Mode:</span>
      <span class="ai-value" id="ai-mode">Standard AI</span>
    </div>
    <div class="ai-status-row">
      <span class="ai-label">Chunks:</span>
      <span class="ai-value" id="ai-chunks">0 / 0</span>
    </div>
    <div class="ai-status-row">
      <span class="ai-label">Categories:</span>
      <span class="ai-value" id="ai-categories">0 found</span>
    </div>
  </div>

  <!-- NEW: Live category preview -->
  <div class="categories-preview" id="categories-preview" hidden>
    <h4>Categories Being Created:</h4>
    <div class="category-tags" id="category-tags"></div>
  </div>
</div>
```

**Add CSS**:

```css
.ai-status {
  margin-top: 16px;
  padding: 12px 16px;
  background: rgba(95, 224, 193, 0.05);
  border-radius: 8px;
  border: 1px solid rgba(95, 224, 193, 0.15);
}

.ai-status-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 13px;
}

.ai-label {
  color: var(--text-secondary);
  opacity: 0.8;
}

.ai-value {
  font-weight: 500;
  color: var(--accent);
}

.categories-preview {
  margin-top: 16px;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.categories-preview h4 {
  font-size: 13px;
  font-weight: 600;
  margin: 0 0 10px 0;
  color: var(--text-secondary);
}

.category-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.category-tag {
  display: inline-block;
  padding: 4px 10px;
  background: rgba(95, 224, 193, 0.1);
  border: 1px solid rgba(95, 224, 193, 0.25);
  border-radius: 12px;
  font-size: 12px;
  color: var(--accent);
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.category-tag.new {
  animation: pulse 0.5s ease;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}
```

---

### Step 2: Update Page2 JavaScript

**File**: `ui/page2.js`

#### Add UI element references (line ~6):

```javascript
const aiStatusEl = document.getElementById('ai-status');
const aiModeEl = document.getElementById('ai-mode');
const aiChunksEl = document.getElementById('ai-chunks');
const aiCategoriesEl = document.getElementById('ai-categories');
const categoriesPreviewEl = document.getElementById('categories-preview');
const categoryTagsEl = document.getElementById('category-tags');
```

#### Add state tracking:

```javascript
const state = {
  stageId: 'read',
  runMeta: null,
  categoriesFound: new Set(), // NEW: Track categories
};
```

#### Update handleRuntimeMessage function (line 87):

```javascript
function handleRuntimeMessage(message) {
  if (!message?.type) return;

  if (message.type === MSG.PROGRESS_TICK) {
    state.stageId = message.stageId ?? state.stageId;
    renderProgress(message);
    renderTasks(state.stageId);

    // NEW: Render AI status if available
    if (message.aiStatus) {
      renderAIStatus(message.aiStatus);
    }

    showProcessing();
    return;
  }

  // ... rest of function
}
```

#### Add new rendering functions:

```javascript
/**
 * Render detailed AI processing status
 */
function renderAIStatus(aiStatus) {
  if (!aiStatusEl) return;

  // Show AI status panel during AI stage
  if (state.stageId === 'ai') {
    aiStatusEl.hidden = false;

    // Mode
    if (aiModeEl) {
      aiModeEl.textContent = aiStatus.fastMode ? '⚡ Fast Mode' : '🤖 AI Mode';
    }

    // Chunks
    if (aiChunksEl && typeof aiStatus.chunk === 'number') {
      aiChunksEl.textContent = `${aiStatus.chunk} / ${aiStatus.totalChunks}`;
    }

    // Categories count
    if (aiCategoriesEl) {
      aiCategoriesEl.textContent = `${state.categoriesFound.size} found`;
    }
  } else {
    aiStatusEl.hidden = true;
  }
}

/**
 * Update live category preview
 * @param {Array<string>} newCategories - Categories from latest chunk
 */
function updateCategoryPreview(newCategories) {
  if (!categoriesPreviewEl || !categoryTagsEl) return;

  if (!newCategories || newCategories.length === 0) return;

  // Show preview during AI stage
  if (state.stageId === 'ai') {
    categoriesPreviewEl.hidden = false;

    newCategories.forEach((categoryName) => {
      if (state.categoriesFound.has(categoryName)) return; // Already shown

      state.categoriesFound.add(categoryName);

      // Create tag element
      const tag = document.createElement('span');
      tag.className = 'category-tag new';
      tag.textContent = categoryName;

      categoryTagsEl.appendChild(tag);

      // Remove 'new' class after animation
      setTimeout(() => tag.classList.remove('new'), 500);
    });
  } else {
    categoriesPreviewEl.hidden = true;
  }
}
```

---

### Step 3: Emit Categories from Background

**File**: `background.js` (modify tick function ~line 299)

```javascript
function tick(stageId, override = {}) {
  const step = stepById(stageId);
  const rawPercent = typeof override.percent === 'number' ? override.percent : step.percent;
  const percent = Math.max(0, Math.min(100, rawPercent));
  const resolvedLabel =
    typeof override.label === 'string' && override.label.trim().length
      ? override.label
      : step.label;

  lastProgress = {
    stageId,
    percent,
    label: resolvedLabel,
  };
  const metaPatch = { progress: lastProgress };
  const message = { type: MSG.PROGRESS_TICK, ...lastProgress };

  if (stageId === 'ai') {
    if (typeof override.totalChunks === 'number') {
      aiStatus.totalChunks = Math.max(override.totalChunks, 0);
    }
    if (typeof override.chunk === 'number') {
      aiStatus.chunk = Math.max(0, override.chunk);
    }
    if (typeof override.fastMode === 'boolean') {
      aiStatus.fastMode = override.fastMode;
    }
    if (override.label) {
      aiStatus.label = resolvedLabel;
    }
    // NEW: Include categories in message
    if (override.categories && Array.isArray(override.categories)) {
      aiStatus.categories = override.categories;
      message.categories = override.categories; // Send to UI
    }
    metaPatch.aiStatus = { ...aiStatus };
    message.aiStatus = { ...aiStatus };
  }

  emitRuntimeMessage(message);
  void writeRunMeta(metaPatch);
}
```

---

### Step 4: Send Categories from AI Client

**File**: `lib/ai_client.js` (in categorizeBookmarks loop)

```javascript
for (let i = 0; i < chunks.length; i++) {
  ensureActive();
  const chunk = chunks[i];

  try {
    const result = await callOpenAI(OPENAI_KEY, chunk, false, signal);

    if (result.folders && Array.isArray(result.folders)) {
      allFolders.push(...result.folders);
    }

    // Extract category names for UI
    const categoryNames = result.folders
      ? result.folders.map((f) => f.name).filter(Boolean)
      : [];

    if (onProgress) {
      const progress = 80 + Math.floor(((i + 1) / totalChunks) * 15);
      onProgress({
        percent: progress,
        label: `AI analyzing chunk ${i + 1}/${totalChunks}`,
        chunk: i + 1,
        totalChunks,
        fastMode: false,
        categories: categoryNames, // NEW: Send categories
      });
    }
  } catch (error) {
    // ... error handling
  }
}
```

---

## 🧪 Testing Checklist

- [ ] AI status panel appears during "ai" stage
- [ ] Chunk progress shows: "3 / 6"
- [ ] Mode displays: "AI Mode" or "Fast Mode"
- [ ] Categories appear as tags as processing happens
- [ ] Category count updates: "12 found"
- [ ] Animations work: Tags fade in smoothly
- [ ] Duplicate categories: Only shown once
- [ ] After AI stage: Panels hide correctly
- [ ] Small run (1 chunk): Still shows status correctly
- [ ] Fast mode: Shows "Fast Mode" label

---

## 📊 Expected User Experience

### Before:
```
Processing... 85%
Stage: Analyzing with AI
[User has no idea what's happening]
```

### After:
```
Processing... 85%
Stage: AI analyzing chunk 4/6

Mode: 🤖 AI Mode
Chunks: 4 / 6
Categories: 8 found

Categories Being Created:
[Technology] [News] [Shopping] [Development]
[Entertainment] [Education] [Social Media] [Finance]
```

**Much more informative! User can see progress and results.**

---

## ⚠️ Important Notes

1. **Performance**: Adding many category tags (100+) could slow down UI slightly
   - Limit to first 50 categories if needed
2. **Memory**: Tracking categories in Set is lightweight
3. **Animation**: Fade-in effect makes UI feel responsive
4. **Duplicate Prevention**: Set ensures each category shown once
5. **Hidden by Default**: Only shows during AI processing stage

---

## 💡 Future Enhancements (Not in this issue)

- Show token usage and cost estimate
- Preview sample bookmarks for each category
- Progress ring animation around percentage
- Sound notification when complete
- Browser notification if window not focused

---

## 📦 Files to Modify

1. ✏️ `ui/page2.html` - Add AI status and category preview sections
2. ✏️ `ui/page2.js` - Render AI status and categories
3. ✏️ `background.js` - Include categories in progress messages
4. ✏️ `lib/ai_client.js` - Extract and send category names

---

## 🔗 Related Issues

- **Depends on**: None (can start immediately)
- **Blocks**: None
- **Works well with**: P0-02 (Time Estimation) - both improve feedback
- **Related**: P0-05 (Consistency) - shows which categories are being used

---

**Safe to implement in parallel with P0-01 and P0-02! No conflicts.**
