import { stepById } from './progress_steps.js';

const DEFAULT_STATS = { total: 0, grouped: 0 };
const DEFAULT_PROGRESS = {
  stageId: 'read',
  percent: 0,
  label: stepById('read').label,
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
  };
  return setRunMeta(base);
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

  return {
    status: meta.status ?? 'idle',
    startedAt: typeof meta.startedAt === 'number' ? meta.startedAt : null,
    endedAt: typeof meta.endedAt === 'number' ? meta.endedAt : null,
    errorReason: meta.errorReason ?? null,
    stats,
    progress,
  };
}
