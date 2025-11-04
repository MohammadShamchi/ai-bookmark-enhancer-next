import { MSG } from '../lib/messages.js';
import { getOrganized, getRunMeta, getLastApplyMeta } from '../lib/storage.js';
import { sendRuntimeMessage } from '../lib/runtime_bus.js';
import { markPageReady, navigateWithTransition } from '../lib/ui.js';

const statusPill = document.getElementById('status-pill');
const subtitleEl = document.getElementById('results-subtitle');
const metricEl = document.getElementById('metric-count');
const foldersContainer = document.getElementById('folders');
const emptyState = document.getElementById('empty-state');
const openBookmarksBtn = document.getElementById('open-bookmarks');
const downloadBackupBtn = document.getElementById('download-backup');
const rerunBtn = document.getElementById('rerun-analysis');
const applyStatusEl = document.getElementById('apply-status');
const previewBtn = document.getElementById('preview-apply');
const applyBtn = document.getElementById('apply-structure');
const rollbackBtn = document.getElementById('rollback-apply');
const applyMetaEl = document.getElementById('apply-meta');
const applySampleEl = document.getElementById('apply-sample');
const modal = document.getElementById('confirm-modal');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const modalConfirmBtn = document.getElementById('modal-confirm');
const modalCancelBtn = document.getElementById('modal-cancel');
const modalCloseBtn = document.getElementById('close-modal');
const settingsNav = document.getElementById('settings-nav');

const state = {
  runMeta: null,
  organized: null,
  lastApplyMeta: null,
  apply: { stage: 'idle', percent: 0, label: 'Idle' },
  modal: { context: null },
};

chrome.runtime.onMessage.addListener(handleRuntimeMessage);

init();

async function init() {
  markPageReady();
  state.runMeta = await getRunMeta();

  if (!state.runMeta || state.runMeta.status === 'idle') {
    renderIdleState();
    await hydrateApplyMeta();
    attachActions();
    return;
  }

  if (state.runMeta.status === 'running') {
    navigateWithTransition('page2.html', { replace: true });
    return;
  }

  state.organized = await getOrganized();
  await hydrateApplyMeta();
  renderSummary(state.runMeta, state.organized);
  renderFolders(state.runMeta, state.organized);
  attachActions();
}

function renderSummary(runMeta, organized) {
  const stats = runMeta?.stats ?? { total: 0, grouped: 0 };
  const total = stats.total ?? 0;
  const grouped = stats.grouped ?? 0;
  const success = runMeta?.status === 'success';

  if (metricEl) {
    metricEl.textContent = success ? `${total.toLocaleString()} → ${grouped.toLocaleString()}` : '—';
  }

  updateStatusPill(runMeta);

  if (emptyState && success) {
    emptyState.hidden = true;
  }

  if (subtitleEl) {
    if (runMeta.status === 'success') {
      subtitleEl.textContent = 'Organization complete.';
    } else if (runMeta.status === 'cancelled') {
      subtitleEl.textContent = 'Run cancelled before completion.';
    } else if (runMeta.status === 'error') {
      subtitleEl.textContent = describeError(runMeta.errorReason);
    }
  }

  if (!success && emptyState) {
    emptyState.textContent = runMeta.status === 'cancelled'
      ? 'No changes were made. Re-run analysis whenever you are ready.'
      : 'We could not complete this run. Check your API key and try again.';
    emptyState.hidden = false;
  }

  if (!success && foldersContainer) {
    foldersContainer.innerHTML = '';
    foldersContainer.hidden = true;
  }

  if (downloadBackupBtn) {
    downloadBackupBtn.disabled = !success;
  }

  if (applyBtn) {
    applyBtn.disabled = !success;
  }
  if (previewBtn) {
    previewBtn.disabled = !success;
  }
}

function renderFolders(runMeta, organized) {
  if (!foldersContainer) return;
  if (runMeta?.status !== 'success' || !organized?.folders) {
    foldersContainer.innerHTML = '';
    foldersContainer.hidden = true;
    if (emptyState) {
      emptyState.hidden = false;
      emptyState.textContent = 'No organized folders yet. Re-run analysis when ready.';
    }
    return;
  }

  foldersContainer.hidden = false;
  foldersContainer.innerHTML = '';

  organized.folders.forEach((folder) => {
    const folderDiv = document.createElement('div');
    folderDiv.className = 'folder';

    const name = document.createElement('div');
    name.className = 'folder-name';
    name.textContent = folder.name;

    const count = document.createElement('div');
    count.className = 'folder-count';
    count.textContent = `${folder.ids.length} bookmarks`;

    folderDiv.appendChild(name);
    folderDiv.appendChild(count);
    foldersContainer.appendChild(folderDiv);
  });
}

function renderIdleState() {
  if (statusPill) statusPill.hidden = true;
  if (metricEl) metricEl.textContent = '—';
  if (subtitleEl) subtitleEl.textContent = 'Run the organizer to see results.';
  if (emptyState) {
    emptyState.textContent = 'No runs yet. Start organizing to view results here.';
    emptyState.hidden = false;
  }
  if (foldersContainer) {
    foldersContainer.innerHTML = '';
    foldersContainer.hidden = true;
  }
  if (downloadBackupBtn) {
    downloadBackupBtn.disabled = true;
  }
  if (applyBtn) applyBtn.disabled = true;
  if (previewBtn) previewBtn.disabled = true;
}

function attachActions() {
  if (settingsNav) {
    settingsNav.addEventListener('click', () => navigateWithTransition('settings.html'));
  }

  if (openBookmarksBtn) {
    openBookmarksBtn.addEventListener('click', () => {
      const targetUrl = state.lastApplyMeta?.rootId
        ? `chrome://bookmarks/?id=${state.lastApplyMeta.rootId}`
        : 'chrome://bookmarks';
      chrome.tabs.create({ url: targetUrl });
      showToast(state.lastApplyMeta?.rootId
        ? `Opened ${state.lastApplyMeta.rootName} in Bookmark Manager.`
        : 'Bookmark Manager opened in a new tab.');
    });
  }

  if (downloadBackupBtn) {
    downloadBackupBtn.addEventListener('click', async () => {
      if (downloadBackupBtn.disabled) return;
      const original = downloadBackupBtn.textContent;
      downloadBackupBtn.disabled = true;
      downloadBackupBtn.textContent = 'Preparing...';
      try {
        const response = await sendRuntimeMessage({ type: MSG.DOWNLOAD_LATEST });
        if (!response?.ok) {
          throw new Error(response?.error || 'FAILED');
        }
        showToast('Backups saved to your Downloads folder.');
      } catch (error) {
        console.error('[page3] Backup download failed', error);
        showToast('Could not download backups. Try again.');
      } finally {
        downloadBackupBtn.disabled = false;
        downloadBackupBtn.textContent = original;
      }
    });
  }

  if (previewBtn) {
    previewBtn.addEventListener('click', handlePreviewRequest);
  }

  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      if (!state.runMeta || state.runMeta.status !== 'success') {
        showToast('Run the organizer before applying.');
        return;
      }
      openModal({
        context: 'apply',
        title: 'Apply AI structure?',
        body: 'This duplicates your organized folders into a new root named "AI Organized (date)". Originals stay untouched.',
        confirmLabel: 'Apply structure',
        variant: 'primary',
      });
    });
  }

  if (rollbackBtn) {
    rollbackBtn.addEventListener('click', () => {
      if (!state.lastApplyMeta) {
        showToast('No previous apply was found.');
        return;
      }
      openModal({
        context: 'rollback',
        title: 'Rollback applied structure?',
        body: `This removes "${state.lastApplyMeta.rootName}" forever. Original bookmarks remain untouched.`,
        confirmLabel: 'Remove applied folder',
        variant: 'danger',
      });
    });
  }

  if (rerunBtn) {
    rerunBtn.addEventListener('click', () => {
      openModal({
        context: 'rerun',
        title: 'Start a new analysis?',
        body: 'This will start a new run and replace the current AI results. Backups remain in Downloads.',
        confirmLabel: 'Yes, start over',
        variant: 'primary',
      });
    });
  }

  if (modalConfirmBtn) {
    modalConfirmBtn.addEventListener('click', async () => {
      if (state.modal.context === 'apply') {
        await startApply();
      } else if (state.modal.context === 'rollback') {
        await startRollback();
      } else if (state.modal.context === 'rerun') {
        await triggerRerun();
      }
    });
  }

  if (modalCancelBtn) {
    modalCancelBtn.addEventListener('click', closeModal);
  }

  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', closeModal);
  }

  if (modal) {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        closeModal();
      }
    });
  }

  updateRollbackAvailability();
  setApplyButtonsDisabled(false);
}

async function hydrateApplyMeta() {
  state.lastApplyMeta = await getLastApplyMeta();
  if (state.lastApplyMeta) {
    updateApplyStatusText(`Last applied: ${state.lastApplyMeta.rootName}`);
  } else {
    updateApplyStatusText('Idle');
  }
  updateRollbackAvailability();
}

function updateStatusPill(runMeta) {
  if (!statusPill) return;

  statusPill.hidden = false;
  statusPill.classList.remove('success', 'error', 'cancelled');

  switch (runMeta?.status) {
    case 'success':
      statusPill.classList.add('success');
      statusPill.textContent = '✓ Completed successfully';
      break;
    case 'cancelled':
      statusPill.classList.add('cancelled');
      statusPill.textContent = '⚑ Run cancelled';
      break;
    case 'error':
      statusPill.classList.add('error');
      statusPill.textContent = '⚠ Error during run';
      break;
    default:
      statusPill.hidden = true;
  }
}

function handleRuntimeMessage(message) {
  if (!message?.type) return;
  switch (message.type) {
    case MSG.APPLY_PROGRESS:
      handleApplyProgress(message);
      break;
    case MSG.APPLY_DONE:
      handleApplyDone(message.meta);
      break;
    case MSG.APPLY_ERROR:
      handleApplyError(message.error);
      break;
    case MSG.ROLLBACK_DONE:
      handleRollbackDone();
      break;
    case MSG.ROLLBACK_ERROR:
      handleRollbackError(message.error);
      break;
    default:
      break;
  }
}

function handleApplyProgress(message) {
  state.apply.stage = message.stage ?? state.apply.stage;
  state.apply.percent = typeof message.percent === 'number' ? message.percent : state.apply.percent;
  state.apply.label = message.label ?? state.apply.label;
  updateApplyStatusText(formatApplyStatus(state.apply));
  if (message.preview) {
    renderApplyPreview(message.preview);
  }
}

function handleApplyDone(meta) {
  if (meta) {
    state.lastApplyMeta = meta;
    updateApplyStatusText(`Applied: ${meta.rootName}`);
  } else {
    updateApplyStatusText('Apply complete');
  }
  setApplyButtonsDisabled(false);
  updateRollbackAvailability();
  renderApplyPreview(null);
  hydrateApplyMeta();
  showToast('Structure applied. Opening new folder in Bookmark Manager…');
  if (meta?.rootId) {
    chrome.tabs.create({ url: `chrome://bookmarks/?id=${meta.rootId}` });
  }
}

function handleApplyError(error) {
  setApplyButtonsDisabled(false);
  updateApplyStatusText('Apply failed');
  showToast(error || 'Apply failed. Check the console for details.');
}

function handleRollbackDone() {
  state.lastApplyMeta = null;
  updateApplyStatusText('Rollback complete');
  updateRollbackAvailability();
  setApplyButtonsDisabled(false);
  renderApplyPreview(null);
  hydrateApplyMeta();
  showToast('Last applied structure removed.');
}

function handleRollbackError(error) {
  setApplyButtonsDisabled(false);
  updateApplyStatusText('Rollback failed');
  showToast(error || 'Rollback failed.');
}

function renderApplyPreview(preview) {
  if (!applyMetaEl || !applySampleEl) return;
  if (!preview) {
    applyMetaEl.hidden = true;
    applySampleEl.hidden = true;
    applySampleEl.innerHTML = '';
    return;
  }

  applyMetaEl.hidden = false;
  applyMetaEl.innerHTML = `
    <span><strong>${preview.folders ?? 0}</strong> folders</span>
    <span><strong>${preview.bookmarks ?? 0}</strong> bookmarks</span>
  `;

  applySampleEl.innerHTML = '';
  if (Array.isArray(preview.sample) && preview.sample.length) {
    applySampleEl.hidden = false;
    preview.sample.forEach((item) => {
      const li = document.createElement('li');
      const title = document.createElement('div');
      title.className = 'sample-folder';
      title.textContent = item.folder;
      const bookmarkTitle = document.createElement('div');
      bookmarkTitle.textContent = item.title;
      const url = document.createElement('div');
      url.className = 'sample-url';
      url.textContent = item.url;
      li.append(title, bookmarkTitle, url);
      applySampleEl.appendChild(li);
    });
  } else {
    applySampleEl.hidden = true;
  }
}

function updateApplyStatusText(text) {
  if (applyStatusEl) {
    applyStatusEl.textContent = text;
  }
}

function formatApplyStatus(progress) {
  const stageLabels = {
    preview: 'Preview ready',
    init: 'Preparing apply',
    create_root: 'Creating root folder',
    create_folders: 'Creating folders',
    create_bookmarks: 'Duplicating bookmarks',
    finalize: 'Finalizing apply',
    rollback: 'Rolling back',
    idle: 'Idle',
  };
  const label = progress.label || stageLabels[progress.stage] || 'Applying';
  if (typeof progress.percent === 'number') {
    return `${label} — ${Math.min(100, Math.max(0, Math.round(progress.percent)))}%`;
  }
  return label;
}

function openModal({ context, title, body, confirmLabel, variant }) {
  if (!modal || !modalTitle || !modalBody || !modalConfirmBtn) {
    return;
  }
  state.modal.context = context;
  modalTitle.textContent = title;
  modalBody.textContent = body;
  modalConfirmBtn.textContent = confirmLabel ?? 'Confirm';
  modalConfirmBtn.classList.remove('btn-primary', 'btn-danger');
  modalConfirmBtn.classList.add(variant === 'danger' ? 'btn-danger' : 'btn-primary');
  modal.removeAttribute('hidden');
  requestAnimationFrame(() => modal.classList.add('visible'));
}

function closeModal() {
  if (!modal) return;
  modal.classList.remove('visible');
  setTimeout(() => modal.setAttribute('hidden', 'true'), 160);
  state.modal.context = null;
}

async function handlePreviewRequest() {
  if (previewBtn) previewBtn.disabled = true;
  updateApplyStatusText('Generating preview…');
  try {
    const response = await sendRuntimeMessage(
      { type: MSG.APPLY_PREVIEW },
      { timeout: 8000 }
    );
    if (response?.preview) {
      renderApplyPreview(response.preview);
      updateApplyStatusText('Preview ready');
    } else if (response?.ok === false) {
      showToast(response.error || 'Preview failed.');
      updateApplyStatusText('Preview failed');
    }
  } catch (error) {
    console.error('[page3] Preview apply failed', error);
    showToast('Unable to generate preview.');
    updateApplyStatusText('Preview failed');
  } finally {
    if (previewBtn) previewBtn.disabled = false;
  }
}

async function startApply() {
  closeModal();
  setApplyButtonsDisabled(true);
  updateApplyStatusText('Starting apply…');
  try {
    const response = await sendRuntimeMessage(
      { type: MSG.APPLY_START },
      { timeout: 4000 }
    );
    if (response?.ok === false) {
      if (response?.reason === 'ALREADY_APPLYING') {
        showToast('Apply already in progress.');
      } else {
        throw new Error(response?.error || 'Failed to start apply.');
      }
    }
  } catch (error) {
    console.error('[page3] Failed to start apply', error);
    showToast('Unable to start apply.');
    setApplyButtonsDisabled(false);
  }
}

async function startRollback() {
  closeModal();
  setApplyButtonsDisabled(true);
  updateApplyStatusText('Rolling back…');
  try {
    const response = await sendRuntimeMessage(
      { type: MSG.ROLLBACK_START },
      { timeout: 4000 }
    );
    if (response?.ok === false) {
      throw new Error(response?.error || 'Failed to start rollback.');
    }
  } catch (error) {
    console.error('[page3] Failed to start rollback', error);
    showToast('Unable to rollback.');
    setApplyButtonsDisabled(false);
  }
}

async function triggerRerun() {
  closeModal();
  if (!rerunBtn) return;
  const original = rerunBtn.textContent;
  rerunBtn.disabled = true;
  rerunBtn.textContent = 'Starting…';
  try {
    const result = await sendRuntimeMessage({ type: MSG.START_ORGANIZE });
    if (result?.ok || result?.reason === 'ALREADY_RUNNING') {
      navigateWithTransition('page2.html');
    } else if (result?.reason === 'MISSING_KEY') {
      showToast('Connect your OpenAI key in settings before running.');
    } else {
      showToast('Unable to start. Check your key and try again.');
    }
  } catch (error) {
    console.error('[page3] Failed to start new run', error);
    showToast('Unable to start. Check console for details.');
  } finally {
    rerunBtn.disabled = false;
    rerunBtn.textContent = original;
  }
}

function setApplyButtonsDisabled(disabled) {
  if (previewBtn) previewBtn.disabled = disabled;
  if (applyBtn) applyBtn.disabled = disabled;
  if (rollbackBtn) rollbackBtn.disabled = disabled || !state.lastApplyMeta;
}

function updateRollbackAvailability() {
  if (rollbackBtn) {
    rollbackBtn.disabled = !state.lastApplyMeta;
  }
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 250);
  }, 2000);
}

function describeError(reason) {
  switch (reason) {
    case 'MISSING_KEY':
      return 'Connect your OpenAI API key to run the organizer.';
    case 'INVALID_KEY':
      return 'OpenAI rejected the key used. Update it in settings.';
    default:
      return 'We hit an unexpected error during the last run.';
  }
}
