import { MSG } from './lib/messages.js';
import { PROGRESS_STEPS, stepById } from './lib/progress_steps.js';
import { readBookmarks } from './lib/bookmarks.js';
import { exportJson, exportHtml, downloadLatest } from './lib/backup.js';
import { categorizeBookmarks } from './lib/ai_client.js';
import { mergeSuggestions } from './lib/organizer.js';
import {
  getOrganized,
  setOrganized,
  setRunMeta,
  getRunMeta,
  setLastApplyMeta,
  getLastApplyMeta,
  clearLastApplyMeta,
} from './lib/storage.js';
import { applyStructure, previewApply, rollbackApply } from './lib/apply.js';
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
let aiStatus = createDefaultAiStatus();
let applying = false;
let applyProgress = { stage: 'idle', percent: 0 };

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

  if (message.type === MSG.APPLY_PREVIEW) {
    return (async () => {
      const organized = await getOrganized();
      if (!organized?.folders?.length) {
        throw new Error('No organized results to preview. Run the enhancer first.');
      }
      const preview = await previewApply(organized);
      emitApplyProgress('preview', 5, { label: 'Preview ready', preview });
      return { ok: true, preview };
    })();
  }

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
        const meta = await applyStructure({
          organized,
          parentId: '1',
          batchSize: message?.batchSize ?? 150,
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

  if (message.type === MSG.ROLLBACK_START) {
    (async () => {
      try {
        if (applying) {
          throw new Error('Apply operation in progress. Wait until it completes.');
        }
        const meta = await getLastApplyMeta();
        if (!meta?.rootId) {
          throw new Error('No previous apply to rollback.');
        }
        emitApplyProgress('rollback', 10, { label: 'Removing applied folder' });
        await rollbackApply(meta.rootId);
        await clearLastApplyMeta();
        emitApplyProgress('idle', 0, { label: 'Rollback complete' });
        emitRuntimeMessage({ type: MSG.ROLLBACK_DONE });
      } catch (error) {
        emitApplyProgress('error', applyProgress.percent, { label: 'Rollback failed' });
        emitRuntimeMessage({ type: MSG.ROLLBACK_ERROR, error: error?.message ?? 'Rollback failed.' });
      }
    })();
    return { ok: true };
  }

  if (message.type === MSG.REQUEST_STATUS) {
    return (async () => ({
      isRunning,
      progress: lastProgress,
      status: currentRunMeta?.status ?? 'idle',
      aiStatus,
      runMeta: currentRunMeta,
    }))();
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
  aiStatus = createDefaultAiStatus();

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
      onProgress: (update) => tick('ai', update),
    });
    if (cancelRequested) {
      throw new Error('CANCELLED');
    }
    if (aiResult?.meta) {
      const { totalChunks, fastMode } = aiResult.meta;
      aiStatus = {
        ...aiStatus,
        totalChunks: typeof totalChunks === 'number' ? Math.max(0, totalChunks) : aiStatus.totalChunks,
        fastMode: typeof fastMode === 'boolean' ? fastMode : aiStatus.fastMode,
      };
      await writeRunMeta({ aiStatus });
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
      aiStatus: {
        ...aiStatus,
        chunk: aiStatus.totalChunks,
        label: 'Completed',
      },
    });
    emitRuntimeMessage({ type: MSG.ORGANIZE_DONE });
    return { ok: true };
  } catch (error) {
    if (error.message === 'CANCELLED') {
      await writeRunMeta({
        status: 'cancelled',
        endedAt: Date.now(),
        aiStatus: {
          ...aiStatus,
          label: 'Cancelled',
        },
      });
      emitRuntimeMessage({ type: MSG.ORGANIZE_CANCELLED });
      return { ok: false, reason: 'CANCELLED' };
    }

    const reason = error.message === 'INVALID_KEY' ? 'INVALID_KEY' : 'UNKNOWN';
    await writeRunMeta({
      status: 'error',
      endedAt: Date.now(),
      errorReason: reason,
      aiStatus: {
        ...aiStatus,
        label: 'Error',
      },
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
    metaPatch.aiStatus = { ...aiStatus };
    message.aiStatus = { ...aiStatus };
  }

  emitRuntimeMessage(message);
  void writeRunMeta(metaPatch);
}

function emitApplyProgress(stage, percent, extra = {}) {
  applyProgress = { stage, percent };
  emitRuntimeMessage({ type: MSG.APPLY_PROGRESS, stage, percent, ...extra });
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
    aiStatus,
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
  if (patch.aiStatus) {
    next.aiStatus = { ...(currentRunMeta?.aiStatus ?? createDefaultAiStatus()), ...patch.aiStatus };
  }
  const normalized = await setRunMeta(next);
  currentRunMeta = normalized;
  if (normalized?.aiStatus) {
    aiStatus = { ...normalized.aiStatus };
  }
  return normalized;
}

function resetState() {
  isRunning = false;
  cancelRequested = false;
  aborter = null;
  aiStatus = createDefaultAiStatus();
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
    if (stored.aiStatus) {
      aiStatus = { ...stored.aiStatus };
    }
  } catch (error) {
    console.warn('[background] Failed to restore run state', error);
  }
}

restoreRunState();

function createDefaultAiStatus() {
  return {
    chunk: 0,
    totalChunks: 0,
    label: 'Preparing',
    fastMode: false,
  };
}
