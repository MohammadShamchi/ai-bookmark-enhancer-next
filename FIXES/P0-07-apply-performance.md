# P0-07: Slow Apply Process

**Priority**: P0 - CRITICAL
**Impact**: Applying organized structure takes 5-10+ minutes for 2,000 bookmarks
**Estimated Fix Time**: 2-3 hours
**Risk Level**: MEDIUM (changes bookmark creation logic)

---

## 🎯 Problem Description

After AI organization completes, **applying the structure** to Chrome bookmarks takes another 5-10 minutes for large collections. The process creates bookmarks **one by one sequentially**, causing:

- Long wait times after analysis is done
- User frustration ("I thought it was finished!")
- Perceived slowness of the entire extension

For 2,066 bookmarks:
- AI processing: 10-20 minutes
- **Apply: 5-10 minutes** ← This issue
- Total: 15-30 minutes

### Current Implementation (`lib/apply.js:119-138`)

```javascript
const batches = chunk(toCreate, Math.max(1, batchSize));
const totalBatches = batches.length || 1;
for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
  const batch = batches[batchIndex];
  for (const payload of batch) {  // ⚠️ Sequential loop!
    const created = await createBookmark(payload.parentId, {
      title: payload.title,
      url: payload.url,
    });
    // ...
  }
  await sleep(0);  // Yield control but still sequential
}
```

**Problem**: Each bookmark created one-by-one, no parallelization

---

## 🔍 Root Cause

1. **Nested sequential loops**: Batches → Items in batch
2. **Chrome API callback-based**: Each `chrome.bookmarks.create()` waits for response
3. **No concurrency**: Despite batching, still processes sequentially
4. **Conservative approach**: Avoids overwhelming Chrome API

---

## ✅ Acceptance Criteria

1. **Parallel bookmark creation**: Create multiple bookmarks simultaneously
2. **Configurable concurrency**: Limit to avoid rate limits (e.g., 10-20 concurrent)
3. **Progress updates**: Show current batch and percentage
4. **Error resilience**: Failed bookmarks don't stop entire process
5. **Chrome API safety**: Respect Chrome's internal limits
6. **60-80% faster**: 2,000 bookmarks in 1-2 minutes instead of 5-10

---

## 🔧 Suggested Implementation

### Approach: Promise-Based Batching with Concurrency

**File**: `lib/apply.js`

### Step 1: Add Concurrency Helper

```javascript
/**
 * Process array of tasks with limited concurrency
 * @param {Array<Function>} tasks - Array of promise-returning functions
 * @param {number} concurrency - Max concurrent operations
 * @param {Function} onBatchComplete - Callback after each batch
 * @returns {Promise<Array>} Results
 */
async function processConcurrentBatches(tasks, concurrency = 10, onBatchComplete = null) {
  const results = [];
  let completed = 0;

  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency);

    // Execute batch in parallel
    const batchResults = await Promise.allSettled(
      batch.map((task) => task())
    );

    results.push(...batchResults);
    completed += batch.length;

    // Callback for progress
    if (onBatchComplete) {
      onBatchComplete(completed, tasks.length);
    }

    // Small delay between batches to avoid overwhelming Chrome
    if (i + concurrency < tasks.length) {
      await sleep(10); // 10ms delay
    }
  }

  return results;
}
```

---

### Step 2: Refactor applyStructure Function

```javascript
export async function applyStructure({
  organized,
  parentId = DEFAULT_PARENT_ID,
  batchSize = 150, // Deprecated, keeping for backwards compat
  concurrency = 15, // NEW: Concurrent bookmark creations
  onProgress = null
}) {
  const folders = Array.isArray(organized?.folders) ? organized.folders : [];
  if (!folders.length) {
    throw new Error('No organized folders available to apply.');
  }

  const emit = (payload) => {
    if (typeof onProgress === 'function') {
      onProgress(payload);
    }
  };

  const timestamp = formatTimestamp(new Date());
  const rootName = `AI Organized (${timestamp})`;
  emit({ stage: 'create_root', percent: 10, label: 'Creating root folder' });
  const rootId = await createFolder(parentId, rootName);

  // Create folders (still sequential, fast anyway)
  const folderIdByName = Object.create(null);
  const usedNames = new Set();
  emit({ stage: 'create_folders', percent: 15, label: 'Creating folders' });
  const folderRecords = [];

  for (let index = 0; index < folders.length; index += 1) {
    const folder = folders[index];
    const uniqueName = uniqueFolderName(sanitizeName(folder?.name ?? 'Miscellaneous'), usedNames);
    const folderId = await createFolder(rootId, uniqueName);
    folderIdByName[uniqueName] = folderId;
    folderRecords.push({ folder, folderId, name: uniqueName });
    emit({
      stage: 'create_folders',
      percent: 15 + Math.floor(((index + 1) / folders.length) * 25),
      label: `Creating folder ${index + 1}/${folders.length}`,
    });
  }

  // Load original bookmarks
  const allIds = [];
  folders.forEach((folder) => {
    (folder?.ids ?? []).forEach((id) => allIds.push(String(id)));
  });
  const originals = await loadBookmarkNodes(allIds);

  // Build bookmark creation tasks
  const toCreate = [];
  folderRecords.forEach((record) => {
    const folder = record.folder;
    const folderId = record.folderId;
    const seenUrls = new Set();

    (folder?.ids ?? []).forEach((rawId) => {
      const id = String(rawId);
      const node = originals[id];
      if (!node || !node.url) return;
      if (seenUrls.has(node.url)) return;

      seenUrls.add(node.url);
      toCreate.push({
        parentId: folderId,
        title: node.title || node.url,
        url: node.url,
        origId: id,
      });
    });
  });

  emit({ stage: 'create_bookmarks', percent: 45, label: 'Duplicating bookmarks' });

  // NEW: Create bookmark tasks for parallel execution
  const map = {};
  const tasks = toCreate.map((payload) => async () => {
    try {
      const created = await createBookmark(payload.parentId, {
        title: payload.title,
        url: payload.url,
      });

      if (!map[payload.origId]) {
        map[payload.origId] = [];
      }
      map[payload.origId].push(created);

      return { success: true, id: created };
    } catch (error) {
      console.error('[apply.js] Failed to create bookmark:', payload.title, error);
      return { success: false, error: error.message };
    }
  });

  // Process with concurrency and progress tracking
  const totalBookmarks = tasks.length;
  let lastPercent = 45;

  await processConcurrentBatches(tasks, concurrency, (completed, total) => {
    const percent = 45 + Math.floor((completed / total) * 45);
    if (percent !== lastPercent) {
      lastPercent = percent;
      emit({
        stage: 'create_bookmarks',
        percent,
        label: `Duplicating bookmarks ${completed} / ${total}`,
      });
    }
  });

  emit({ stage: 'finalize', percent: 100, label: 'Finalizing apply' });

  return {
    rootId,
    rootName,
    parentId,
    totalFolders: folderRecords.length,
    totalBookmarks: toCreate.length,
    map,
    createdAt: Date.now(),
    strategy: 'duplicate',
  };
}
```

---

### Step 3: Add Concurrency Setting to Settings UI

**File**: `ui/settings.html` (add to developer section)

```html
<div class="setting-row">
  <label for="apply-concurrency">Apply Concurrency</label>
  <select id="apply-concurrency">
    <option value="5">Conservative (5)</option>
    <option value="10">Balanced (10)</option>
    <option value="15" selected>Fast (15)</option>
    <option value="25">Maximum (25)</option>
  </select>
  <p class="setting-hint">Higher values = faster applying, but may stress Chrome</p>
</div>
```

**File**: `ui/settings.js` (load/save)

```javascript
// In loadDeveloperSettings():
const { APPLY_CONCURRENCY } = await chrome.storage.local.get('APPLY_CONCURRENCY');
const applySelect = document.getElementById('apply-concurrency');
if (applySelect) {
  applySelect.value = APPLY_CONCURRENCY || 15;
}

// Add event listener:
if (applySelect) {
  applySelect.addEventListener('change', async (e) => {
    const limit = parseInt(e.target.value, 10);
    await chrome.storage.local.set({ APPLY_CONCURRENCY: limit });
    showDevStatus(`Apply concurrency set to ${limit}.`);
  });
}
```

---

### Step 4: Use Setting in Background.js

**File**: `background.js` (modify MSG.APPLY_START handler ~line 71)

```javascript
if (message.type === MSG.APPLY_START) {
  if (applying) {
    return { ok: false, reason: 'ALREADY_APPLYING' };
  }
  applying = true;
  emitApplyProgress('init', 5, { label: 'Preparing apply' });
  (async () => {
    try {
      const organized = await getOrganized();
      if (!organized?.folders?.length) {
        throw new Error('No organized results to apply. Run analysis first.');
      }

      // Get concurrency setting
      const { APPLY_CONCURRENCY } = await chrome.storage.local.get('APPLY_CONCURRENCY');
      const concurrency = APPLY_CONCURRENCY || 15;

      const meta = await applyStructure({
        organized,
        parentId: '1',
        concurrency, // NEW: Pass concurrency
        onProgress: (payload = {}) => {
          const { stage = 'apply', percent = applyProgress.percent, label, preview, ...rest } = payload;
          emitApplyProgress(stage, percent, { label, preview, ...rest });
        },
      });

      await setLastApplyMeta(meta);
      emitApplyProgress('finalize', 100, { label: 'Apply complete', meta });
      emitRuntimeMessage({ type: MSG.APPLY_DONE, meta });
    } catch (error) {
      emitApplyProgress('error', applyProgress.percent, { label: error?.message ?? 'Apply failed' });
      emitRuntimeMessage({ type: MSG.APPLY_ERROR, error: error?.message ?? 'Apply failed unexpectedly.' });
    } finally {
      applying = false;
    }
  })();
  return { ok: true };
}
```

---

## 🧪 Testing Checklist

- [ ] Small collection (50 bookmarks): Completes in < 5 seconds
- [ ] Medium collection (500 bookmarks): Completes in < 30 seconds
- [ ] Large collection (2,000 bookmarks): Completes in < 2 minutes
- [ ] Progress updates: Show smooth progression from 45% → 90%
- [ ] Failed bookmarks: Don't crash entire process
- [ ] Concurrency = 5: Slower but safe
- [ ] Concurrency = 25: Faster, still stable
- [ ] Duplicate URLs: Still deduped correctly
- [ ] Chrome doesn't crash: No overwhelming of API
- [ ] All bookmarks created: Verify count matches expected

---

## 📊 Expected Performance Improvement

### Before (sequential):
```
2,000 bookmarks
- Time: ~10 minutes
- Rate: 3-4 bookmarks/second
```

### After (concurrency = 15):
```
2,000 bookmarks
- Time: ~1-2 minutes
- Rate: 15-30 bookmarks/second
- Improvement: 5-10x faster 🚀
```

### Detailed Breakdown:
| Bookmarks | Before | After (c=15) | Speedup |
|-----------|--------|--------------|---------|
| 100 | 30s | 5s | 6x |
| 500 | 2m 30s | 25s | 6x |
| 2,000 | 10m | 1m 30s | 6.7x |
| 5,000 | 25m | 4m | 6.25x |

---

## ⚠️ Important Notes

1. **Chrome API Limits**: Unofficial limit seems to be ~50 concurrent operations
   - Default of 15 is safe
   - 25 is aggressive but should work
   - 50+ may cause issues

2. **Error Handling**: Failed bookmarks logged but don't stop process
   - Could add retry logic (future enhancement)
   - Could show "X bookmarks failed" message

3. **Memory**: All bookmark creation promises in memory simultaneously
   - For 2,000 bookmarks: negligible memory impact

4. **Progress Updates**: Update every N completions, not every single one
   - Reduces message overhead

5. **Backwards Compatibility**: `batchSize` parameter kept but ignored

---

## 💡 Future Enhancements (Not in this issue)

- Retry failed bookmarks automatically
- Show list of failed bookmarks to user
- Adaptive concurrency (start slow, speed up if no errors)
- Parallel folder creation too (currently sequential)
- Estimate apply time before starting

---

## 📦 Files to Modify

1. ✏️ `lib/apply.js` - Add concurrent processing
2. ✏️ `ui/settings.html` - Add concurrency setting
3. ✏️ `ui/settings.js` - Load/save concurrency
4. ✏️ `background.js` - Pass concurrency to applyStructure

---

## 🔗 Related Issues

- **Depends on**: None (can start immediately)
- **Blocks**: None
- **Related**: P0-01 (Sequential Processing) - Similar optimization pattern

---

**High impact, medium risk. Can work in parallel with most other issues!**
