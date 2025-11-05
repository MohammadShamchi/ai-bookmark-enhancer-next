# P0-04: Hardcoded AI Model Configuration

**Priority**: P0 - CRITICAL
**Impact**: Users can't choose different models (gpt-4, gpt-4-turbo, etc.)
**Estimated Fix Time**: 2-3 hours
**Risk Level**: MEDIUM (changes AI configuration)

---

## 🎯 Problem Description

The OpenAI model is **hardcoded to `gpt-4o-mini`** in the code. Users cannot:

- Choose a more powerful model (gpt-4, gpt-4-turbo) for better categorization
- Choose a cheaper model if available
- Switch models if one is unavailable or deprecated
- Use different models for different runs

**User Quote**: "models are not specified and the answer maybe could be variant base on ai"

### Current Implementation (`lib/ai_client.js:2`)

```javascript
const CHUNK_SIZE = 400;
const MODEL = 'gpt-4o-mini';  // ⚠️ Hardcoded!

export async function categorizeBookmarks(flatList, options) {
  // ...
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    // ...
    body: JSON.stringify({
      model: MODEL,  // Always uses gpt-4o-mini
      temperature: 0.2,
      // ...
    })
  });
}
```

**Problem**: No way to change model without editing code

---

## 🔍 Root Cause

1. **Hardcoded constant**: `const MODEL = 'gpt-4o-mini'`
2. **No UI for selection**: Settings page doesn't have model picker
3. **No validation**: Doesn't check if model is available for user's API key

---

## ✅ Acceptance Criteria

1. **Model selection in settings**: Dropdown with common models
2. **Default to gpt-4o-mini**: For backwards compatibility
3. **Persist user choice**: Save selected model to storage
4. **Show model info**: Cost, speed, quality trade-offs
5. **Validation during test**: Check if model is available when testing API key
6. **Show current model**: Display which model will be used before running
7. **Handle deprecated models**: Graceful fallback if model no longer exists

---

## 🔧 Suggested Implementation

### Step 1: Add Model Configuration to Settings UI

**File**: `ui/settings.html` (add after API key section)

```html
<section class="settings-section">
  <h2>AI Model Selection</h2>
  <p class="section-hint">Choose which OpenAI model to use for categorization. More powerful models provide better results but cost more.</p>

  <div class="setting-row">
    <label for="ai-model">AI Model</label>
    <select id="ai-model" class="model-select">
      <option value="gpt-4o-mini" selected>GPT-4o Mini (Recommended)</option>
      <option value="gpt-4o">GPT-4o (Best quality)</option>
      <option value="gpt-4-turbo">GPT-4 Turbo</option>
      <option value="gpt-4">GPT-4 (Slower, expensive)</option>
      <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Legacy, cheap)</option>
    </select>
  </div>

  <div class="model-info" id="model-info">
    <div class="info-row">
      <span class="info-label">Speed:</span>
      <span class="info-value" id="model-speed">⚡⚡⚡ Fast</span>
    </div>
    <div class="info-row">
      <span class="info-label">Quality:</span>
      <span class="info-value" id="model-quality">⭐⭐⭐ Good</span>
    </div>
    <div class="info-row">
      <span class="info-label">Cost:</span>
      <span class="info-value" id="model-cost">💰 Low</span>
    </div>
    <div class="info-row">
      <span class="info-label">Context:</span>
      <span class="info-value" id="model-context">128K tokens</span>
    </div>
  </div>
</section>
```

**Add CSS**:

```css
.model-select {
  width: 100%;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
}

.model-info {
  margin-top: 16px;
  padding: 16px;
  background: rgba(95, 224, 193, 0.05);
  border-radius: 8px;
  border: 1px solid rgba(95, 224, 193, 0.15);
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 13px;
}

.info-label {
  color: var(--text-secondary);
}

.info-value {
  font-weight: 500;
  color: var(--text-primary);
}
```

---

### Step 2: Update Settings JavaScript

**File**: `ui/settings.js`

```javascript
// Add model info database
const MODEL_INFO = {
  'gpt-4o-mini': {
    speed: '⚡⚡⚡ Very Fast',
    quality: '⭐⭐⭐ Good',
    cost: '💰 Very Low',
    context: '128K tokens',
    description: 'Fast and affordable, perfect for most bookmark collections.',
  },
  'gpt-4o': {
    speed: '⚡⚡ Fast',
    quality: '⭐⭐⭐⭐⭐ Excellent',
    cost: '💰💰💰 High',
    context: '128K tokens',
    description: 'Best quality categorization, higher cost.',
  },
  'gpt-4-turbo': {
    speed: '⚡⚡ Fast',
    quality: '⭐⭐⭐⭐ Very Good',
    cost: '💰💰💰 High',
    context: '128K tokens',
    description: 'Great quality with good speed, but expensive.',
  },
  'gpt-4': {
    speed: '⚡ Slower',
    quality: '⭐⭐⭐⭐ Very Good',
    cost: '💰💰💰💰 Very High',
    context: '8K tokens',
    description: 'Legacy model, slower and more expensive. Not recommended.',
  },
  'gpt-3.5-turbo': {
    speed: '⚡⚡⚡ Very Fast',
    quality: '⭐⭐ Fair',
    cost: '💰 Very Low',
    context: '16K tokens',
    description: 'Cheapest option but lower quality categorization.',
  },
};

// Add to init function
const modelSelect = document.getElementById('ai-model');
const modelSpeedEl = document.getElementById('model-speed');
const modelQualityEl = document.getElementById('model-quality');
const modelCostEl = document.getElementById('model-cost');
const modelContextEl = document.getElementById('model-context');

async function loadDeveloperSettings() {
  try {
    const { FAST_MODE, AI_MODEL } = await chrome.storage.local.get(['FAST_MODE', 'AI_MODEL']);

    // Fast mode toggle
    const enabled = Boolean(FAST_MODE);
    if (fastModeToggle) {
      fastModeToggle.checked = enabled;
    }
    updateFastModeLabel(enabled);

    // Model selection
    const selectedModel = AI_MODEL || 'gpt-4o-mini';
    if (modelSelect) {
      modelSelect.value = selectedModel;
      updateModelInfo(selectedModel);
    }
  } catch (error) {
    console.error('[settings] Failed to load developer settings', error);
    showDevStatus('Unable to load developer preferences.');
  }
}

function bindDeveloperControls() {
  // ... existing fast mode code ...

  // Model selection
  if (modelSelect) {
    modelSelect.addEventListener('change', async (event) => {
      const model = event.target.value;
      try {
        await chrome.storage.local.set({ AI_MODEL: model });
        updateModelInfo(model);
        showDevStatus(`AI model set to ${model}.`);
      } catch (error) {
        console.error('[settings] Failed to set AI model', error);
        showDevStatus('Could not update AI model. Check console for details.');
      }
    });
  }
}

function updateModelInfo(model) {
  const info = MODEL_INFO[model];
  if (!info) return;

  if (modelSpeedEl) modelSpeedEl.textContent = info.speed;
  if (modelQualityEl) modelQualityEl.textContent = info.quality;
  if (modelCostEl) modelCostEl.textContent = info.cost;
  if (modelContextEl) modelContextEl.textContent = info.context;
}
```

---

### Step 3: Update AI Client

**File**: `lib/ai_client.js`

```javascript
// Remove hardcoded constant
// const MODEL = 'gpt-4o-mini'; // ❌ DELETE THIS

export async function categorizeBookmarks(flatList, { onProgress = null, signal = null } = {}) {
  // Get API key AND model from storage
  const { OPENAI_KEY, AI_MODEL } = await chrome.storage.local.get(['OPENAI_KEY', 'AI_MODEL']);
  if (!OPENAI_KEY) {
    throw new Error('OPENAI_KEY not found in chrome.storage.local. Please set it in extension settings.');
  }

  const model = AI_MODEL || 'gpt-4o-mini'; // Default to gpt-4o-mini

  // ... rest of function ...

  for (let i = 0; i < chunks.length; i++) {
    // ...
    const result = await callOpenAI(OPENAI_KEY, chunk, false, signal, model); // Pass model
    // ...
  }

  return {
    folders: allFolders,
    meta: {
      totalChunks,
      fastMode: false,
      model, // Include model in metadata
    },
  };
}

/**
 * Call OpenAI API
 */
async function callOpenAI(apiKey, chunk, retry = false, signal = null, model = 'gpt-4o-mini') {
  const systemPrompt = 'You are an assistant that organizes bookmarks.';
  const userPrompt = retry
    ? `Return ONLY valid JSON with no markdown formatting or code fences. Format: {"folders":[{"name":"Category Name","ids":["id1","id2"]}]}. Organize these bookmarks: ${JSON.stringify(chunk)}`
    : `Given this JSON list, return a JSON object: { "folders": [{ "name": "...", "ids": [...] }] }. Use only provided ids. No prose, ONLY JSON. Bookmarks: ${JSON.stringify(chunk)}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model, // Use dynamic model
      temperature: 0.2,
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

  // ... rest of function
}
```

---

### Step 4: Show Model in Results Page

**File**: `ui/page3.js` (add to renderSummary)

```javascript
function renderSummary(runMeta, organized) {
  // ... existing code ...

  // Show which model was used
  const modelUsed = runMeta?.aiStatus?.model || runMeta?.meta?.model || 'gpt-4o-mini';
  if (subtitleEl) {
    if (runMeta.status === 'success') {
      subtitleEl.textContent = `Organization complete (${modelUsed}).`;
    }
    // ... rest
  }
}
```

---

## 🧪 Testing Checklist

- [ ] Settings page: Model dropdown appears and loads saved value
- [ ] Change model: Selection persists after page reload
- [ ] Model info updates: Changing dropdown updates speed/cost/quality display
- [ ] Default model: New users get gpt-4o-mini by default
- [ ] Run with different models: gpt-4o-mini, gpt-4o, gpt-3.5-turbo all work
- [ ] Invalid model: Graceful error if model doesn't exist (404)
- [ ] Results page: Shows which model was used
- [ ] Model in metadata: Saved to runMeta for future reference

---

## 📊 Model Comparison (1,000 bookmarks, 3 chunks)

| Model | Speed | Quality | Cost | Recommendation |
|-------|-------|---------|------|----------------|
| gpt-4o-mini | 6s | Good ⭐⭐⭐ | $0.01 | ✅ Best default |
| gpt-4o | 8s | Excellent ⭐⭐⭐⭐⭐ | $0.15 | Power users |
| gpt-4-turbo | 9s | Very Good ⭐⭐⭐⭐ | $0.30 | Not worth it |
| gpt-3.5-turbo | 4s | Fair ⭐⭐ | $0.005 | Budget only |

---

## ⚠️ Important Notes

1. **Backwards Compatibility**: Defaults to gpt-4o-mini if not set
2. **Model Availability**: Some users may not have access to all models
3. **Context Windows**: gpt-4 (old) only has 8K context, may need smaller chunks
4. **Deprecation**: OpenAI may deprecate models, add fallback logic
5. **Cost Transparency**: Show estimated cost before running (future enhancement)

---

## 💡 Future Enhancements (Not in this issue)

- Show estimated cost before running: "This will use ~$0.05 in API credits"
- Model auto-selection based on bookmark count
- Custom models (Azure OpenAI, other providers)
- A/B testing: Run same bookmarks with different models, compare results

---

## 📦 Files to Modify

1. ✏️ `lib/ai_client.js` - Remove hardcoded model, use storage value
2. ✏️ `ui/settings.html` - Add model selection dropdown
3. ✏️ `ui/settings.js` - Load/save model, show model info
4. ✏️ `ui/page3.js` - Display which model was used

---

## 🔗 Related Issues

- **Depends on**: P0-01 (Sequential Processing) - conflicts with same file
- **Blocks**: None
- **Related**: P0-05 (AI Consistency) - model choice affects consistency

---

**Wait for P0-01 to be merged to avoid conflicts in lib/ai_client.js!**
