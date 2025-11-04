import { validateKey } from '../lib/ai_client.js';
import { getRunMeta } from '../lib/storage.js';
import { MSG } from '../lib/messages.js';
import { sendRuntimeMessage } from '../lib/runtime_bus.js';
import { markPageReady, navigateWithTransition } from '../lib/ui.js';

const apiKeyInput = document.getElementById('apiKey');
const saveBtn = document.getElementById('saveBtn');
const testBtn = document.getElementById('testBtn');
const toggleBtn = document.getElementById('toggleVisibility');
const backBtn = document.getElementById('backBtn');
const statusDiv = document.getElementById('status');
const fastModeToggle = document.getElementById('fast-mode-toggle');
const fastModeLabel = document.getElementById('fast-mode-label');
const devStatus = document.getElementById('dev-status');
const statusBtn = document.getElementById('status-btn');

init();

async function init() {
  markPageReady();
  await loadExistingKey();
  await loadDeveloperSettings();
  bindEvents();
  bindDeveloperControls();
}

async function loadExistingKey() {
  try {
    const { OPENAI_KEY } = await chrome.storage.local.get('OPENAI_KEY');
    if (OPENAI_KEY && apiKeyInput) {
      apiKeyInput.value = OPENAI_KEY;
    }
  } catch (error) {
    console.error('[settings] Failed to load saved key', error);
    setStatus('Unable to load saved key. Try again.', 'error');
  }
}

async function loadDeveloperSettings() {
  try {
    const { FAST_MODE } = await chrome.storage.local.get('FAST_MODE');
    const enabled = Boolean(FAST_MODE);
    if (fastModeToggle) {
      fastModeToggle.checked = enabled;
    }
    updateFastModeLabel(enabled);
  } catch (error) {
    console.error('[settings] Failed to load developer settings', error);
    showDevStatus('Unable to load developer preferences.');
  }
}

function bindEvents() {
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const key = apiKeyInput?.value.trim();
      if (!key) {
        setStatus('Please enter an API key before saving.', 'error');
        return;
      }
      await persistKey(key);
    });
  }

  if (testBtn) {
    testBtn.addEventListener('click', async () => {
      const key = apiKeyInput?.value.trim();
      if (!key) {
        setStatus('Enter an API key to test the connection.', 'error');
        return;
      }
      await testConnection(key);
    });
  }

  if (toggleBtn && apiKeyInput) {
    toggleBtn.addEventListener('click', () => {
      const showing = apiKeyInput.type === 'text';
      apiKeyInput.type = showing ? 'password' : 'text';
      toggleBtn.textContent = showing ? 'Show' : 'Hide';
    });
  }

  if (backBtn) {
    backBtn.addEventListener('click', navigateBack);
  }
}

function bindDeveloperControls() {
  if (fastModeToggle) {
    fastModeToggle.addEventListener('change', async (event) => {
      const enabled = event.target.checked;
      try {
        await chrome.storage.local.set({ FAST_MODE: enabled });
        updateFastModeLabel(enabled);
        showDevStatus(enabled ? 'Fast mode enabled (simulated AI responses).' : 'Fast mode disabled (real API calls).');
      } catch (error) {
        console.error('[settings] Failed to set fast mode', error);
        showDevStatus('Could not update fast mode. Check console for details.');
      }
    });
  }

  if (statusBtn) {
    statusBtn.addEventListener('click', async () => {
      statusBtn.disabled = true;
      showDevStatus('Fetching current run status…');
      try {
        const response = await sendRuntimeMessage({ type: MSG.REQUEST_STATUS }, { timeout: 1500 });
        showDevStatus(formatStatus(response));
      } catch (error) {
        console.error('[settings] Failed to request status', error);
        showDevStatus('Unable to fetch status from background.');
      } finally {
        statusBtn.disabled = false;
      }
    });
  }
}

async function persistKey(key) {
  setStatus('Saving key...', 'info');
  toggleControls(true);
  try {
    await chrome.storage.local.set({ OPENAI_KEY: key });
    setStatus('API key saved locally.', 'success');
  } catch (error) {
    console.error('[settings] Failed to save key', error);
    setStatus(`Error saving key: ${error.message}`, 'error');
  } finally {
    toggleControls(false);
  }
}

async function testConnection(key) {
  setStatus('Testing connection...', 'info');
  toggleControls(true);
  try {
    await chrome.storage.local.set({ OPENAI_KEY: key });
    const response = await validateKey(key);
    const models = Array.isArray(response?.data) ? response.data.length : 0;
    setStatus(`Connection verified (${models} models available).`, 'success');
    showToast('API key verified');
    setTimeout(navigateBack, 1500);
  } catch (error) {
    if (error.status === 401 || error.code === 'VALIDATION_FAILED') {
      setStatus('OpenAI rejected this key. Double-check and try again.', 'error');
    } else if (error.code === 'KEY_REQUIRED') {
      setStatus('Please enter an API key before testing.', 'error');
    } else {
      setStatus('Could not reach OpenAI. Check your network and try again.', 'error');
    }
    console.error('[settings] Validation failed', error);
  } finally {
    toggleControls(false);
  }
}

async function navigateBack() {
  const runMeta = await getRunMeta();
  if (runMeta?.status === 'success' || runMeta?.status === 'error' || runMeta?.status === 'cancelled') {
    navigateWithTransition('page3.html');
  } else {
    navigateWithTransition('page1.html');
  }
}

function toggleControls(disabled) {
  if (saveBtn) saveBtn.disabled = disabled;
  if (testBtn) testBtn.disabled = disabled;
  if (toggleBtn) toggleBtn.disabled = disabled;
}

function setStatus(message, type) {
  if (!statusDiv) return;
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  statusDiv.style.display = 'block';
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 200);
  }, 1800);
}

function updateFastModeLabel(enabled) {
  if (!fastModeLabel) return;
  fastModeLabel.textContent = enabled
    ? 'Fast mode is ON — runs complete using simulated AI output.'
    : 'Fast mode is OFF — runs call the live OpenAI API.';
}

function showDevStatus(message) {
  if (!devStatus) return;
  devStatus.textContent = message;
  devStatus.classList.add('visible');
}

function formatStatus(status) {
  if (!status) {
    return 'No active run. Everything is idle.';
  }
  const phase = status.progress?.label ?? 'Idle';
  const percent = typeof status.progress?.percent === 'number' ? `${status.progress.percent}%` : '—';
  const chunk = status.aiStatus?.chunk ?? 0;
  const total = status.aiStatus?.totalChunks ?? 0;
  const fastMode = status.aiStatus?.fastMode ? 'fast mode' : 'standard mode';
  if (!status.isRunning) {
    return `Status: ${status.status ?? 'idle'} · Last phase: ${phase} (${percent}).`;
  }
  return `Status: running in ${fastMode}. Phase "${phase}" ${percent}. Chunk ${chunk}/${total}.`;
}
