import { stepById } from './progress_steps.js';

const DEFAULT_STATS = { total: 0, grouped: 0 };
const DEFAULT_PROGRESS = {
  stageId: 'read',
  percent: 0,
  label: stepById('read').label,
};
const DEFAULT_AI_STATUS = {
  chunk: 0,
  totalChunks: 0,
  label: 'Preparing',
  fastMode: false,
};

export async function getOrganized() {
  const { organized } = await chrome.storage.local.get('organized');
  return organized;
}

export async function setOrganized(organized) {
  await chrome.storage.local.set({ organized });
}

export async function setRunMeta(meta) {
  const normalized = normalizeRunMeta(meta);
  await chrome.storage.local.set({ runMeta: normalized });
  return normalized;
}

export async function getRunMeta() {
  const { runMeta } = await chrome.storage.local.get('runMeta');
  return normalizeRunMeta(runMeta);
}

export async function clearRunMeta() {
  return chrome.storage.local.remove('runMeta');
}

export async function resetRunMeta(progress = DEFAULT_PROGRESS) {
  const base = {
    status: 'idle',
    startedAt: null,
    endedAt: null,
    errorReason: null,
    stats: { ...DEFAULT_STATS },
    progress,
    aiStatus: { ...DEFAULT_AI_STATUS },
  };
  return setRunMeta(base);
}

export async function setLastApplyMeta(meta) {
  await chrome.storage.local.set({ lastApplyMeta: meta });
  return meta;
}

export async function getLastApplyMeta() {
  const { lastApplyMeta } = await chrome.storage.local.get('lastApplyMeta');
  return lastApplyMeta ?? null;
}

export async function clearLastApplyMeta() {
  return chrome.storage.local.remove('lastApplyMeta');
}

function normalizeRunMeta(meta) {
  if (!meta) {
    return null;
  }

  const statsSource = meta.stats ?? {};
  const stats = {
    total: Number.isFinite(statsSource.total) ? statsSource.total : 0,
    grouped: Number.isFinite(statsSource.grouped) ? statsSource.grouped : 0,
  };

  const progressSource = meta.progress ?? {};
  const rawPercent = Number.isFinite(progressSource.percent) ? progressSource.percent : DEFAULT_PROGRESS.percent;
  const progress = {
    stageId: typeof progressSource.stageId === 'string' ? progressSource.stageId : DEFAULT_PROGRESS.stageId,
    percent: Math.max(0, Math.min(100, rawPercent)),
    label: typeof progressSource.label === 'string' && progressSource.label.length
      ? progressSource.label
      : stepById(progressSource.stageId ?? DEFAULT_PROGRESS.stageId).label,
  };

  const aiSource = meta.aiStatus ?? {};
  const aiStatus = {
    chunk: Number.isFinite(aiSource.chunk) ? Math.max(0, aiSource.chunk) : DEFAULT_AI_STATUS.chunk,
    totalChunks: Number.isFinite(aiSource.totalChunks) ? Math.max(0, aiSource.totalChunks) : DEFAULT_AI_STATUS.totalChunks,
    label: typeof aiSource.label === 'string' && aiSource.label.length ? aiSource.label : DEFAULT_AI_STATUS.label,
    fastMode: Boolean(aiSource.fastMode),
  };

  return {
    status: meta.status ?? 'idle',
    startedAt: typeof meta.startedAt === 'number' ? meta.startedAt : null,
    endedAt: typeof meta.endedAt === 'number' ? meta.endedAt : null,
    errorReason: meta.errorReason ?? null,
    stats,
    progress,
    aiStatus,
  };
}
