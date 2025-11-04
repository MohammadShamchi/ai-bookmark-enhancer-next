import { MSG } from '../lib/messages.js';
import { getOrganized, getRunMeta } from '../lib/storage.js';
import { sendRuntimeMessage } from '../lib/runtime_bus.js';

const statusPill = document.getElementById('status-pill');
const subtitleEl = document.getElementById('results-subtitle');
const metricEl = document.getElementById('metric-count');
const foldersContainer = document.getElementById('folders');
const emptyState = document.getElementById('empty-state');
const openBookmarksBtn = document.getElementById('open-bookmarks');
const downloadBackupBtn = document.getElementById('download-backup');
const rerunBtn = document.getElementById('rerun-analysis');

init();

async function init() {
  const runMeta = await getRunMeta();

  if (!runMeta || runMeta.status === 'idle') {
    renderIdleState();
    attachActions(runMeta);
    return;
  }

  if (runMeta.status === 'running') {
    location.replace('page2.html');
    return;
  }

  const organized = await getOrganized();
  renderSummary(runMeta, organized);
  renderFolders(runMeta, organized);
  attachActions(runMeta);
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
}

function renderFolders(runMeta, organized) {
  if (!foldersContainer) return;
  if (runMeta?.status !== 'success' || !organized?.folders) {
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
}

function attachActions(runMeta) {
  if (openBookmarksBtn) {
    openBookmarksBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'chrome://bookmarks' });
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

  if (rerunBtn) {
    rerunBtn.addEventListener('click', async () => {
      if (!confirm('Re-run analysis? This will start a new organization pass.')) {
        return;
      }
      const original = rerunBtn.textContent;
      rerunBtn.disabled = true;
      rerunBtn.textContent = 'Starting...';
      try {
        const result = await sendRuntimeMessage({ type: MSG.START_ORGANIZE });
        if (result?.ok || result?.reason === 'ALREADY_RUNNING') {
          location.href = 'page2.html';
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
    });
  }
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
