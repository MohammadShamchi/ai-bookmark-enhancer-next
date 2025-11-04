import { MSG } from '../lib/messages.js';
import { PROGRESS_STEPS } from '../lib/progress_steps.js';
import { sendRuntimeMessage } from '../lib/runtime_bus.js';
import { markPageReady, navigateWithTransition } from '../lib/ui.js';

const barEl = document.getElementById('bar');
const percentEl = document.getElementById('percent');
const stageEl = document.getElementById('stage');
const statusSection = document.getElementById('status-section');
const tasksSection = document.getElementById('tasks-section');
const tasksList = document.getElementById('tasks-list');
const actionsSection = document.getElementById('actions-section');
const cancelBtn = document.getElementById('cancel-btn');
const errorPanel = document.getElementById('error-panel');
const errorMsg = document.getElementById('error-msg');
const cancelledPanel = document.getElementById('cancelled-panel');
const settingsNav = document.getElementById('settings-nav');
const errorSettingsBtn = document.getElementById('error-settings');
const cancelledHomeBtn = document.getElementById('cancelled-home');

const state = {
  stageId: 'read',
  runMeta: null,
};

init();

async function init() {
  markPageReady();
  bindCancel();
  chrome.runtime.onMessage.addListener(handleRuntimeMessage);
  renderTasks(state.stageId);
  await hydrateFromSync();
  bindNav();
}

function bindCancel() {
  if (!cancelBtn) return;
  cancelBtn.addEventListener('click', async () => {
    cancelBtn.disabled = true;
    const original = cancelBtn.textContent;
    cancelBtn.textContent = 'Cancelling...';
    try {
      await sendRuntimeMessage({ type: MSG.ORGANIZE_CANCEL });
    } catch (error) {
      console.error('[page2] Failed to send cancel request', error);
      cancelBtn.disabled = false;
      cancelBtn.textContent = original;
    }
  });
}

async function hydrateFromSync() {
  try {
    const response = await sendRuntimeMessage({ type: MSG.PROGRESS_SYNC });
    if (!response?.runMeta) {
      navigateWithTransition('page1.html', { replace: true });
      return;
    }

    state.runMeta = response.runMeta;
    if (state.runMeta.status === 'success') {
      navigateWithTransition('page3.html', { replace: true });
      return;
    }

    if (state.runMeta.status === 'error') {
      showError(state.runMeta.errorReason);
      return;
    }

    if (state.runMeta.status === 'cancelled') {
      showCancelled();
      return;
    }

    state.stageId = response.progress?.stageId ?? 'read';
    renderProgress(response.progress);
    renderTasks(state.stageId);
    showProcessing();
  } catch (error) {
    console.error('[page2] Failed to sync progress', error);
    navigateWithTransition('page1.html', { replace: true });
  }
}

function handleRuntimeMessage(message) {
  if (!message?.type) return;

  if (message.type === MSG.PROGRESS_TICK) {
    state.stageId = message.stageId ?? state.stageId;
    renderProgress(message);
    renderTasks(state.stageId);
    showProcessing();
    return;
  }

  if (message.type === MSG.ORGANIZE_DONE) {
    navigateWithTransition('page3.html');
    return;
  }

  if (message.type === MSG.ORGANIZE_ERROR) {
    showError(message.reason);
    return;
  }

  if (message.type === MSG.ORGANIZE_CANCELLED) {
    showCancelled();
  }
}

function renderProgress(progress) {
  if (!progress) return;
  if (barEl) {
    barEl.style.width = `${progress.percent ?? 0}%`;
  }
  if (percentEl) {
    percentEl.textContent = `${progress.percent ?? 0}%`;
  }
  if (stageEl) {
    stageEl.textContent = progress.label ? `Stage: ${progress.label}` : 'Stage: —';
  }
}

function renderTasks(activeStageId) {
  if (!tasksList) return;
  tasksList.innerHTML = '';

  const stageIndex = Math.max(PROGRESS_STEPS.findIndex((s) => s.id === activeStageId), 0);

  PROGRESS_STEPS.forEach((step, currentIndex) => {
    const task = document.createElement('div');
    task.className = 'task';

    if (currentIndex < stageIndex) {
      task.classList.add('done');
    } else if (currentIndex === stageIndex) {
      task.classList.add('current');
    } else {
      task.classList.add('pending');
    }

    const label = document.createElement('span');
    const dot = document.createElement('span');
    dot.className = 'dot';
    const text = document.createElement('span');
    text.textContent = step.label;
    label.appendChild(dot);
    label.appendChild(text);

    const status = document.createElement('span');
    status.textContent = currentIndex < stageIndex ? 'done' : currentIndex === stageIndex ? 'in progress' : 'pending';

    task.appendChild(label);
    task.appendChild(status);
    tasksList.appendChild(task);
  });
}

function showProcessing() {
  togglePanels({ status: true, tasks: true, actions: true, error: false, cancelled: false });
  if (cancelBtn) {
    cancelBtn.dataset.locked = '';
    cancelBtn.disabled = false;
    cancelBtn.textContent = 'Cancel run';
  }
}

function showError(reason) {
  togglePanels({ status: false, tasks: false, actions: false, error: true, cancelled: false });
  if (errorMsg) {
    errorMsg.textContent = getErrorMessage(reason);
  }
}

function showCancelled() {
  togglePanels({ status: false, tasks: false, actions: false, error: false, cancelled: true });
  if (cancelBtn) {
    cancelBtn.dataset.locked = 'yes';
  }
}

function togglePanels({ status, tasks, actions, error, cancelled }) {
  if (statusSection) statusSection.style.display = status ? '' : 'none';
  if (tasksSection) tasksSection.style.display = tasks ? '' : 'none';
  if (actionsSection) actionsSection.style.display = actions ? '' : 'none';
  if (errorPanel) errorPanel.classList.toggle('visible', error);
  if (cancelledPanel) cancelledPanel.classList.toggle('visible', cancelled);
}

function getErrorMessage(code) {
  switch (code) {
    case 'MISSING_KEY':
      return 'OpenAI API key not found. Connect your key in settings to continue.';
    case 'INVALID_KEY':
      return 'Your OpenAI API key is invalid. Double-check or generate a new key.';
    default:
      return 'Something went wrong while organizing. Try again or check the console for details.';
  }
}

function bindNav() {
  if (settingsNav) {
    settingsNav.addEventListener('click', () => navigateWithTransition('settings.html'));
  }
  if (errorSettingsBtn) {
    errorSettingsBtn.addEventListener('click', () => navigateWithTransition('settings.html'));
  }
  if (cancelledHomeBtn) {
    cancelledHomeBtn.addEventListener('click', () => navigateWithTransition('page1.html'));
  }
}
