# P0-01: Sequential Processing Bottleneck

**Priority**: P0 - CRITICAL
**Impact**: Processing 2,066 bookmarks takes 20-40 minutes
**Estimated Fix Time**: 2-3 hours
**Risk Level**: HIGH (core processing change)

---

## 🎯 Problem Description

The AI categorization process is **completely sequential** - it processes one chunk at a time, waiting for each API call to complete before starting the next. For a user with 2,066 bookmarks:

- Chunks: 2,066 ÷ 400 = ~6 chunks
- Time per chunk: 2-5 seconds (API call + parsing)
- **Total time: 12-30 minutes** just for AI processing
- Plus backup time, read time, etc. = **20-40 minutes total**

This is unacceptable for users with large bookmark collections.

### Current Code (`lib/ai_client.js:46-77`)

```javascript
for (let i = 0; i < chunks.length; i++) {
  ensureActive();
  const chunk = chunks[i];

  try {
    const result = await callOpenAI(OPENAI_KEY, chunk, false, signal);
    if (result.folders && Array.isArray(result.folders)) {
      allFolders.push(...result.folders);
    }
    // Progress update...
  } catch (error) {
    // Error handling...
  }
}
```

**Problem**: `await` inside loop = sequential execution

---

## 🔍 Root Cause

1. **Sequential loop** with `await` blocks next iteration
2. **No concurrency** or parallel API calls
3. **Conservative approach** prioritizes safety over speed
4. OpenAI API can handle concurrent requests (with rate limits)

---

## ✅ Acceptance Criteria

1. **Multiple chunks processed in parallel** (configurable concurrency)
2. **Respects rate limits** (default 3-5 concurrent requests)
3. **Progress updates still work** (shows chunk X/Y)
4. **Cancellation still works** (aborts all pending requests)
5. **Error handling preserved** (one chunk failing doesn't break others)
6. **Results order doesn't matter** (chunks can complete out of order)
7. **Total time reduced by 60-80%** for large collections

---

## 🔧 Suggested Implementation

### Approach: Promise.allSettled with Concurrency Limit

**File to Edit**: `lib/ai_client.js`

### Step 1: Add Concurrency Helper

```javascript
/**
 * Process promises with limited concurrency
 * @param {Array} tasks - Array of promise-returning functions
 * @param {number} limit - Max concurrent promises
 * @returns {Promise<Array>} Results array
 */
async function processConcurrent(tasks, limit = 3) {
  const results = new Array(tasks.length);
  let currentIndex = 0;

  async function processNext(workerIndex) {
    while (currentIndex < tasks.length) {
      const taskIndex = currentIndex++;
      const task = tasks[taskIndex];

      try {
        results[taskIndex] = { status: 'fulfilled', value: await task() };
      } catch (error) {
        results[taskIndex] = { status: 'rejected', reason: error };
      }
    }
  }

  // Start worker pool
  const workers = Array(Math.min(limit, tasks.length))
    .fill(null)
    .map((_, i) => processNext(i));

  await Promise.all(workers);
  return results;
}
```

### Step 2: Modify categorizeBookmarks Function

```javascript
export async function categorizeBookmarks(flatList, { onProgress = null, signal = null } = {}) {
  const { OPENAI_KEY } = await chrome.storage.local.get('OPENAI_KEY');
  if (!OPENAI_KEY) {
    throw new Error('OPENAI_KEY not found in chrome.storage.local. Please set it in extension settings.');
  }

  const { FAST_MODE, CONCURRENCY_LIMIT } = await chrome.storage.local.get(['FAST_MODE', 'CONCURRENCY_LIMIT']);
  if (FAST_MODE) {
    return simulateFastMode(flatList, { onProgress, signal });
  }

  const concurrencyLimit = CONCURRENCY_LIMIT || 3; // Default 3 concurrent requests
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

  let completedChunks = 0;

  // Create task functions for each chunk
  const tasks = chunks.map((chunk, index) => async () => {
    ensureActive(); // Check cancellation before starting

    const result = await callOpenAI(OPENAI_KEY, chunk, false, signal);

    // Update progress atomically
    completedChunks++;
    if (onProgress) {
      const progress = 80 + Math.floor((completedChunks / totalChunks) * 15);
      onProgress({
        percent: progress,
        label: `AI analyzing chunk ${completedChunks}/${totalChunks}`,
        chunk: completedChunks,
        totalChunks,
        fastMode: false,
      });
    }

    return result;
  });

  // Process with concurrency limit
  const results = await processConcurrent(tasks, concurrencyLimit);

  // Collect successful results
  const allFolders = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled' && result.value?.folders) {
      allFolders.push(...result.value.folders);
    } else if (result.status === 'rejected') {
      if (result.reason?.message === 'CANCELLED') {
        throw new Error('CANCELLED');
      }
      console.error(`[ai_client.js] Chunk ${i + 1} failed:`, result.reason);
      // Continue processing other chunks
    }
  }

  return {
    folders: allFolders,
    meta: {
      totalChunks,
      fastMode: false,
    },
  };
}
```

### Step 3: Add Concurrency Setting to UI

**File**: `ui/settings.html` (add after fast mode toggle)

```html
<div class="setting-row">
  <label for="concurrency-limit">API Concurrency</label>
  <select id="concurrency-limit">
    <option value="1">Conservative (1 request)</option>
    <option value="3" selected>Balanced (3 requests)</option>
    <option value="5">Fast (5 requests)</option>
    <option value="10">Maximum (10 requests)</option>
  </select>
  <p class="setting-hint">Higher values = faster processing, but may hit rate limits</p>
</div>
```

**File**: `ui/settings.js` (add to init and save functions)

```javascript
// In loadDeveloperSettings():
const { CONCURRENCY_LIMIT } = await chrome.storage.local.get('CONCURRENCY_LIMIT');
const concurrencySelect = document.getElementById('concurrency-limit');
if (concurrencySelect) {
  concurrencySelect.value = CONCURRENCY_LIMIT || 3;
}

// Add event listener:
if (concurrencySelect) {
  concurrencySelect.addEventListener('change', async (e) => {
    const limit = parseInt(e.target.value, 10);
    await chrome.storage.local.set({ CONCURRENCY_LIMIT: limit });
    showDevStatus(`Concurrency set to ${limit} concurrent requests.`);
  });
}
```

---

## 🧪 Testing Checklist

- [ ] Small collection (50 bookmarks, 1 chunk): Works normally
- [ ] Medium collection (600 bookmarks, 2 chunks): Both chunks process
- [ ] Large collection (2000+ bookmarks, 6+ chunks): All complete
- [ ] Cancellation: Aborts all pending requests
- [ ] Progress updates: Shows accurate chunk counts
- [ ] Error in one chunk: Others continue processing
- [ ] Rate limit hit: Graceful error (don't break extension)
- [ ] Different concurrency settings: All work correctly

---

## 📊 Expected Performance Improvement

**Before** (sequential):
- 6 chunks × 3 seconds = 18 seconds

**After** (concurrency = 3):
- 6 chunks ÷ 3 parallel = 2 batches × 3 seconds = 6 seconds
- **3x faster** 🚀

**After** (concurrency = 5):
- 6 chunks ÷ 5 parallel = ~2 batches × 3 seconds = 6 seconds
- **3x faster** 🚀

---

## ⚠️ Important Notes

1. **Rate Limits**: OpenAI has TPM (tokens per minute) and RPM (requests per minute) limits
   - Free tier: 60 RPM, 200K TPM
   - Default concurrency of 3 is safe

2. **Memory**: All chunks load in parallel = slightly higher memory usage (negligible)

3. **Error Handling**: Failed chunks are logged but don't block others

4. **Progress Updates**: `completedChunks++` must be atomic (it is in JS)

5. **Backwards Compat**: Works without CONCURRENCY_LIMIT setting (defaults to 3)

---

## 📦 Files to Modify

1. ✏️ `lib/ai_client.js` - Main implementation
2. ✏️ `ui/settings.html` - Add concurrency dropdown
3. ✏️ `ui/settings.js` - Load/save concurrency setting

---

## 🔗 Related Issues

- **Depends on**: None (can start immediately)
- **Blocks**: P0-03 (Fast Mode), P0-05 (AI Consistency)
- **Related**: P1-02 (Rate Limits) - should implement after this

---

**Ready to implement! This is the highest impact fix for performance.**
