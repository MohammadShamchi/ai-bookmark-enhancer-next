import { MSG } from '../lib/messages.js';
import { readBookmarks } from '../lib/bookmarks.js';
import { sendRuntimeMessage } from '../lib/runtime_bus.js';
import { markPageReady, navigateWithTransition } from '../lib/ui.js';

const organizeBtn = document.getElementById('organize-btn');
const connectBtn = document.getElementById('connect-key');
const keyHint = document.getElementById('key-hint');
const metricEl = document.querySelector('.metric');
const settingsNav = document.getElementById('settings-nav');

init();

async function init() {
  markPageReady();
  await hydrateBookmarkCount();
  await hydrateKeyState();
  await resumeIfRunning();
  bindEvents();
  watchKeyChanges();
  handleRedirectToast();
}

async function hydrateBookmarkCount() {
  try {
    const { totals } = await readBookmarks();
    if (metricEl) {
      const total = totals?.total ?? 0;
      metricEl.textContent = total.toLocaleString();
    }
  } catch (error) {
    console.error('[page1] Failed to read bookmarks:', error);
  }
}

async function hydrateKeyState() {
  const { OPENAI_KEY } = await chrome.storage.local.get('OPENAI_KEY');
  updateKeyUI(Boolean(OPENAI_KEY));
}

async function resumeIfRunning() {
  try {
    const response = await sendRuntimeMessage({ type: MSG.PROGRESS_SYNC });
    if (response?.runMeta?.status === 'running' || response?.isRunning) {
      navigateWithTransition('page2.html', { replace: true });
    }
  } catch (error) {
    console.warn('[page1] Unable to sync progress', error);
  }
}

function bindEvents() {
  if (organizeBtn) {
    organizeBtn.addEventListener('click', async () => {
      if (organizeBtn.disabled) return;
      setOrganizeLoading(true);
      try {
        const result = await sendRuntimeMessage({ type: MSG.START_ORGANIZE });
        if (result?.ok || result?.reason === 'ALREADY_RUNNING') {
          navigateWithTransition('page2.html');
          return;
        }
        if (result?.reason === 'MISSING_KEY') {
          updateKeyUI(false);
          showToast('Connect your OpenAI key to start.');
          return;
        }
        showToast('Something went wrong starting the run.');
      } catch (error) {
        console.error('[page1] Failed to start run', error);
        showToast('Unable to start. Check console for details.');
      } finally {
        setOrganizeLoading(false);
      }
    });
  }

  if (connectBtn) {
    connectBtn.addEventListener('click', () => {
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        navigateWithTransition('settings.html');
      }
    });
  }

  if (settingsNav) {
    settingsNav.addEventListener('click', () => navigateWithTransition('settings.html'));
  }

  document.querySelectorAll('.accordion-header').forEach((header) => {
    header.addEventListener('click', () => {
      const item = header.parentElement;
      const openItem = document.querySelector('.accordion-item.open');
      if (openItem && openItem !== item) openItem.classList.remove('open');
      item.classList.toggle('open');
    });
  });
}

function watchKeyChanges() {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes.OPENAI_KEY) {
      return;
    }
    updateKeyUI(Boolean(changes.OPENAI_KEY.newValue));
  });
}

function handleRedirectToast() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('keySaved') === 'true') {
    showToast('✓ API key connected');
    window.history.replaceState({}, '', window.location.pathname);
  }
}

function updateKeyUI(hasKey) {
  if (organizeBtn) {
    organizeBtn.dataset.hasKey = hasKey ? 'true' : '';
    const isLoading = organizeBtn.dataset.loading === 'true';
    organizeBtn.disabled = !hasKey || isLoading;
  }
  if (connectBtn) {
    connectBtn.hidden = hasKey;
  }
  if (keyHint) {
    keyHint.hidden = hasKey;
  }
}

function setOrganizeLoading(isLoading) {
  if (!organizeBtn) return;
  organizeBtn.dataset.loading = isLoading ? 'true' : '';
  const hasKey = organizeBtn.dataset.hasKey === 'true';
  organizeBtn.disabled = isLoading || !hasKey;

  if (isLoading) {
    organizeBtn.dataset.originalLabel = organizeBtn.textContent;
    organizeBtn.textContent = 'Starting...';
  } else {
    const label = organizeBtn.dataset.originalLabel || 'Organize bookmarks';
    organizeBtn.textContent = label;
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
    setTimeout(() => toast.remove(), 300);
  }, 1800);
}
