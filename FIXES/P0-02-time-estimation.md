# P0-02: No Time Estimation During Processing

**Priority**: P0 - CRITICAL
**Impact**: Users have no idea if process will take 30 seconds or 30 minutes
**Estimated Fix Time**: 1-2 hours
**Risk Level**: LOW (UI-only change)

---

## 🎯 Problem Description

During organization, users see a progress bar and percentage, but **no estimated time remaining (ETA)**. For large collections (2,000+ bookmarks), the process can take 20-40 minutes, but users have no way to know:

- How much longer until completion?
- Should I wait or come back later?
- Is it stuck or still working?

**User Quote**: "no ui feedback which this process can makes long time or couple of minutes be patient"

### Current UI (`ui/page2.html:290-297`)

```html
<div class="status" id="status-section">
  <div class="status-header">
    <span>Processing</span>
    <span id="percent">0%</span> <!-- Only percentage shown -->
  </div>
  <div class="progress"><div class="progress-bar" id="bar"></div></div>
  <div class="stage" id="stage">Stage: Collecting bookmarks</div>
</div>
```

**Missing**: ETA, elapsed time, estimated total time

---

## 🔍 Root Cause

1. **No time tracking** in background.js
2. **No ETA calculation** based on progress
3. **No display element** for time info in page2.html

---

## ✅ Acceptance Criteria

1. **Show elapsed time** - "Elapsed: 2m 34s"
2. **Show estimated time remaining** - "~3 minutes remaining"
3. **ETA becomes more accurate** as processing progresses
4. **Handle edge cases**: Very slow AI responses, cancellation, errors
5. **Responsive updates** - Update every 1-2 seconds
6. **Graceful degradation** - If ETA can't be calculated, show "Calculating..."

---

## 🔧 Suggested Implementation

### Step 1: Add Time Tracking to Background Script

**File**: `background.js`

#### Add to state (line ~33):

```javascript
let timeTracker = {
  startTime: null,
  stageStartTimes: {},
  etaEstimate: null,
};
```

#### Add ETA calculation helper:

```javascript
/**
 * Calculate estimated time remaining
 * @param {number} startTime - Process start timestamp
 * @param {number} currentPercent - Current progress (0-100)
 * @returns {number|null} Estimated seconds remaining, or null if can't calculate
 */
function calculateETA(startTime, currentPercent) {
  if (!startTime || currentPercent <= 0) {
    return null;
  }

  const elapsed = Date.now() - startTime;
  const rate = currentPercent / elapsed; // percent per ms
  const remaining = 100 - currentPercent;
  const etaMs = remaining / rate;

  // Only show ETA if at least 5% progress to avoid wild estimates
  if (currentPercent < 5) {
    return null;
  }

  return Math.ceil(etaMs / 1000); // Convert to seconds
}

/**
 * Format seconds into human-readable string
 * @param {number} seconds
 * @returns {string}
 */
function formatDuration(seconds) {
  if (seconds < 60) {
    return `${seconds}s`;
  } else if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  }
}
```

#### Modify startOrganize() (line 159):

```javascript
async function startOrganize() {
  if (isRunning) {
    return { ok: false, reason: 'ALREADY_RUNNING' };
  }

  isRunning = true;
  cancelRequested = false;
  aborter = new AbortController();
  lastFlatList = [];
  aiStatus = createDefaultAiStatus();

  // Initialize time tracker
  timeTracker = {
    startTime: Date.now(),
    stageStartTimes: {},
    etaEstimate: null,
  };

  // ... rest of function
}
```

#### Modify tick() function (line 299):

```javascript
function tick(stageId, override = {}) {
  const step = stepById(stageId);
  const rawPercent = typeof override.percent === 'number' ? override.percent : step.percent;
  const percent = Math.max(0, Math.min(100, rawPercent));
  const resolvedLabel =
    typeof override.label === 'string' && override.label.trim().length
      ? override.label
      : step.label;

  // Calculate time metrics
  const now = Date.now();
  const elapsed = timeTracker.startTime ? Math.floor((now - timeTracker.startTime) / 1000) : 0;
  const etaSeconds = calculateETA(timeTracker.startTime, percent);

  lastProgress = {
    stageId,
    percent,
    label: resolvedLabel,
    elapsed,
    eta: etaSeconds,
    timestamp: now,
  };

  const metaPatch = { progress: lastProgress };
  const message = { type: MSG.PROGRESS_TICK, ...lastProgress };

  // ... rest of function (AI status handling, etc.)

  emitRuntimeMessage(message);
  void writeRunMeta(metaPatch);
}
```

---

### Step 2: Update Progress Display UI

**File**: `ui/page2.html`

#### Modify status section (line 290):

```html
<div class="status" id="status-section">
  <div class="status-header">
    <span>Processing</span>
    <span id="percent">0%</span>
  </div>
  <div class="progress"><div class="progress-bar" id="bar"></div></div>
  <div class="stage" id="stage">Stage: Collecting bookmarks</div>

  <!-- NEW: Time info row -->
  <div class="time-info" id="time-info">
    <span class="elapsed" id="elapsed-time">Elapsed: 0s</span>
    <span class="eta" id="eta-time">Calculating...</span>
  </div>
</div>
```

#### Add CSS styles (in `<style>` block):

```css
.time-info {
  display: flex;
  justify-content: space-between;
  margin-top: 12px;
  font-size: 12px;
  color: var(--text-secondary);
  opacity: 0.8;
}

.time-info .elapsed {
  color: var(--accent);
}

.time-info .eta {
  font-weight: 500;
}
```

---

### Step 3: Update Page2 JavaScript

**File**: `ui/page2.js`

#### Add UI element references (line 6-19):

```javascript
const elapsedTimeEl = document.getElementById('elapsed-time');
const etaTimeEl = document.getElementById('eta-time');
```

#### Modify renderProgress function (line 113):

```javascript
function renderProgress(progress) {
  if (!progress) return;

  // Update progress bar
  if (barEl) {
    barEl.style.width = `${progress.percent ?? 0}%`;
  }
  if (percentEl) {
    percentEl.textContent = `${progress.percent ?? 0}%`;
  }
  if (stageEl) {
    stageEl.textContent = progress.label ? `Stage: ${progress.label}` : 'Stage: —';
  }

  // NEW: Update time info
  if (elapsedTimeEl && typeof progress.elapsed === 'number') {
    elapsedTimeEl.textContent = `Elapsed: ${formatDuration(progress.elapsed)}`;
  }

  if (etaTimeEl) {
    if (progress.eta && progress.eta > 0) {
      etaTimeEl.textContent = `~${formatDuration(progress.eta)} remaining`;
    } else if (progress.percent >= 95) {
      etaTimeEl.textContent = 'Almost done...';
    } else {
      etaTimeEl.textContent = 'Calculating...';
    }
  }
}

/**
 * Format seconds into human-readable duration
 * @param {number} seconds
 * @returns {string}
 */
function formatDuration(seconds) {
  if (seconds < 60) {
    return `${seconds}s`;
  } else if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  }
}
```

---

## 🧪 Testing Checklist

- [ ] Small run (50 bookmarks): Shows elapsed time, ETA appears quickly
- [ ] Large run (2000+ bookmarks): ETA stabilizes after ~10% progress
- [ ] ETA accuracy: Within 20% of actual completion time
- [ ] Elapsed time updates: Every 1-2 seconds
- [ ] Edge case - Very slow stage: ETA adjusts upward
- [ ] Edge case - Fast stage: ETA adjusts downward
- [ ] Cancellation: Time display freezes at last value
- [ ] Error: Time display shows final elapsed time
- [ ] Page reload during run: Time resumes from current elapsed

---

## 📊 Expected User Experience

### Before:
```
Processing... 23%
Stage: Analyzing with AI
[No idea how long this will take]
```

### After:
```
Processing... 23%
Stage: Analyzing with AI (chunk 2/6)
Elapsed: 45s    ~2m 15s remaining
```

### Late in process:
```
Processing... 94%
Stage: Finalizing
Elapsed: 3m 12s    ~12s remaining
```

---

## ⚠️ Important Notes

1. **ETA Accuracy**: Early estimates (< 5% progress) are unreliable, so show "Calculating..."
2. **Stage Variations**: AI stage takes 80% of time, so ETA will jump around
3. **Memory**: Storing timestamps has negligible memory impact
4. **Time Zones**: Using Date.now() (UTC ms) so no timezone issues
5. **Long Waits**: For 40+ minute processes, showing hours is important

---

## 💡 Future Enhancements (Not in this issue)

- Show estimated cost in API tokens
- Historical average times: "Usually takes 5-10 minutes for your collection size"
- Detailed breakdown: "Reading: 5s, AI: 3m 45s, Apply: 1m 20s"

---

## 📦 Files to Modify

1. ✏️ `background.js` - Add time tracking and ETA calculation
2. ✏️ `ui/page2.html` - Add time display elements and CSS
3. ✏️ `ui/page2.js` - Render time information

---

## 🔗 Related Issues

- **Depends on**: None (can start immediately)
- **Blocks**: None
- **Enhances**: P0-06 (Processing Feedback) - works well together

---

**Safe to implement in parallel with P0-01! Low risk, high user satisfaction impact.**
