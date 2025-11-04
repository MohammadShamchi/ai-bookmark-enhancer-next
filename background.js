import { MSG } from './lib/messages.js';
import { PROGRESS_STEPS, stepById } from './lib/progress_steps.js';
import { readBookmarks } from './lib/bookmarks.js';
import { exportJson, exportHtml, downloadLatest } from './lib/backup.js';
import { categorizeBookmarks } from './lib/ai_client.js';
import { mergeSuggestions } from './lib/organizer.js';
import { setOrganized, setRunMeta, getRunMeta } from './lib/storage.js';
import { emitRuntimeMessage, addRuntimeMessageListener } from './lib/runtime_bus.js';

// Open full-screen tab when extension icon is clicked
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('ui/page1.html') });
});

let isRunning = false;
let aborter = null;
let cancelRequested = false;
let lastProgress = {
  stageId: 'read',
  percent: 0,
  label: stepById('read').label,
};
let lastFlatList = [];
let currentRunMeta = null;

await restoreRunState();

addRuntimeMessageListener((message) => {
  if (!message?.type) {
    return undefined;
  }

  if (message.type === MSG.START_ORGANIZE) {
    return startOrganize();
  }

  if (message.type === MSG.PROGRESS_SYNC) {
    return (async () => {
      const runMeta = await getRunMeta();
      return {
        progress: lastProgress ?? runMeta?.progress ?? null,
        runMeta,
        isRunning,
        steps: PROGRESS_STEPS,
      };
    })();
  }

  if (message.type === MSG.ORGANIZE_CANCEL) {
    return (async () => {
      await handleCancel();
      return { ok: true };
    })();
  }

  if (message.type === MSG.DOWNLOAD_LATEST) {
    return (async () => {
      try {
        const result = await handleDownloadLatest();
        return { ok: true, result };
      } catch (error) {
        return { ok: false, error: error.message };
      }
    })();
  }

  return undefined;
});

async function startOrganize() {
  if (isRunning) {
    return { ok: false, reason: 'ALREADY_RUNNING' };
  }

  isRunning = true;
  cancelRequested = false;
  aborter = new AbortController();
  lastFlatList = [];

  currentRunMeta = {
    status: 'running',
    startedAt: Date.now(),
    stats: { total: 0, grouped: 0 },
    errorReason: null,
    progress: lastProgress,
  };
  currentRunMeta = await setRunMeta(currentRunMeta);

  const { OPENAI_KEY } = await chrome.storage.local.get('OPENAI_KEY');
  if (!OPENAI_KEY) {
    await writeRunMeta({
      status: 'error',
      endedAt: Date.now(),
      errorReason: 'MISSING_KEY',
    });
    emitRuntimeMessage({ type: MSG.ORGANIZE_ERROR, reason: 'MISSING_KEY' });
    resetState();
    return { ok: false, reason: 'MISSING_KEY' };
  }

  try {
    tick('read');
    const { flatList } = await readBookmarks();
    lastFlatList = flatList;
    await writeRunMeta({ stats: { total: flatList.length } });
    if (cancelRequested) {
      throw new Error('CANCELLED');
    }

    tick('bkp_json');
    await exportJson(flatList);
    if (cancelRequested) {
      throw new Error('CANCELLED');
    }

    tick('bkp_html');
    await exportHtml(flatList);
    if (cancelRequested) {
      throw new Error('CANCELLED');
    }

    tick('ai');
    const aiResult = await categorizeBookmarks(flatList, {
      signal: aborter.signal,
      onProgress: (percent, label) => tick('ai', { percent, label }),
    });
    if (cancelRequested) {
      throw new Error('CANCELLED');
    }

    const organized = mergeSuggestions(aiResult, flatList);
    await setOrganized(organized);

    const groupedCount = countGrouped(organized);

    tick('done');
    await writeRunMeta({
      status: 'success',
      endedAt: Date.now(),
      stats: {
        total: flatList.length,
        grouped: groupedCount,
      },
    });
    emitRuntimeMessage({ type: MSG.ORGANIZE_DONE });
    return { ok: true };
  } catch (error) {
    if (error.message === 'CANCELLED') {
      await writeRunMeta({
        status: 'cancelled',
        endedAt: Date.now(),
      });
      emitRuntimeMessage({ type: MSG.ORGANIZE_CANCELLED });
      return { ok: false, reason: 'CANCELLED' };
    }

    const reason = error.message === 'INVALID_KEY' ? 'INVALID_KEY' : 'UNKNOWN';
    await writeRunMeta({
      status: 'error',
      endedAt: Date.now(),
      errorReason: reason,
    });
    emitRuntimeMessage({ type: MSG.ORGANIZE_ERROR, reason });
    return { ok: false, reason };
  } finally {
    resetState();
  }
}

async function handleCancel() {
  cancelRequested = true;
  aborter?.abort();

  if (!isRunning && currentRunMeta?.status === 'running') {
    await writeRunMeta({
      status: 'cancelled',
      endedAt: Date.now(),
    });
    emitRuntimeMessage({ type: MSG.ORGANIZE_CANCELLED });
  }
}

async function handleDownloadLatest() {
  return downloadLatest(lastFlatList.length ? lastFlatList : null);
}

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
  emitRuntimeMessage({ type: MSG.PROGRESS_TICK, ...lastProgress });
  void writeRunMeta({ progress: lastProgress });
}

function countGrouped(organized) {
  if (!organized?.folders?.length) {
    return 0;
  }

  const assigned = new Set();
  organized.folders.forEach((folder) => {
    if (folder.name === 'Unsorted') {
      return;
    }
    folder.ids.forEach((id) => assigned.add(String(id)));
  });
  return assigned.size;
}

async function writeRunMeta(patch) {
  const next = {
    status: 'idle',
    startedAt: null,
    endedAt: null,
    errorReason: null,
    progress: lastProgress,
    stats: { total: 0, grouped: 0 },
    ...(currentRunMeta ?? {}),
    ...patch,
    stats: {
      ...(currentRunMeta?.stats ?? { total: 0, grouped: 0 }),
      ...(patch.stats ?? {}),
    },
  };
  if (patch.progress) {
    next.progress = { ...patch.progress };
  }
  const normalized = await setRunMeta(next);
  currentRunMeta = normalized;
  return normalized;
}

function resetState() {
  isRunning = false;
  cancelRequested = false;
  aborter = null;
}

async function restoreRunState() {
  try {
    const stored = await getRunMeta();
    if (!stored) {
      return;
    }
    currentRunMeta = stored;
    if (stored?.progress) {
      lastProgress = { ...stored.progress };
    }
    if (stored.status === 'running') {
      isRunning = true;
    }
  } catch (error) {
    console.warn('[background] Failed to restore run state', error);
  }
}
