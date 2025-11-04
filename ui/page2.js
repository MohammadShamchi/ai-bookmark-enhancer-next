import { MSG } from '../lib/messages.js';

// Log when page loads
console.log('AI Bookmark Enhancer - Page 2 (Processing) loaded');

// Wire cancel button
const cancelBtn = document.getElementById('cancel-btn');
if (cancelBtn) {
  cancelBtn.addEventListener('click', () => {
    console.log('Cancel button clicked');
    chrome.runtime.sendMessage({ type: MSG.ORGANIZE_CANCEL });
    cancelBtn.disabled = true;
    cancelBtn.textContent = 'Cancelling...';
  });
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === MSG.PROGRESS_TICK) {
    const bar = document.getElementById('bar');
    const percent = document.getElementById('percent');
    const stage = document.getElementById('stage');

    if (bar) bar.style.width = message.percent + '%';
    if (percent) percent.textContent = message.percent + '%';
    if (stage) stage.textContent = 'Stage: ' + message.stage;

    console.log(`Progress: ${message.percent}% - ${message.stage}`);
  }
  if (message?.type === MSG.ORGANIZE_DONE) {
    console.log('Organization complete, navigating to results...');
    location.href = 'page3.html';
  }
  if (message?.type === MSG.ORGANIZE_ERROR) {
    console.error('Organization error:', message.reason);
    const errorPanel = document.getElementById('error-panel');
    const errorMsg = document.getElementById('error-msg');
    const statusSection = document.getElementById('status-section');
    const tasks = document.querySelector('.tasks');
    const actionsSection = document.getElementById('actions-section');

    if (errorPanel) errorPanel.classList.add('visible');
    if (statusSection) statusSection.style.display = 'none';
    if (tasks) tasks.style.display = 'none';
    if (actionsSection) actionsSection.style.display = 'none';

    if (errorMsg && message.reason === 'MISSING_KEY') {
      errorMsg.textContent = 'OpenAI API key not found. Please connect your API key to continue.';
    }
  }
  if (message?.type === MSG.ORGANIZE_CANCELLED) {
    console.log('Organization cancelled');
    const cancelledPanel = document.getElementById('cancelled-panel');
    const statusSection = document.getElementById('status-section');
    const tasks = document.querySelector('.tasks');
    const actionsSection = document.getElementById('actions-section');

    if (cancelledPanel) cancelledPanel.classList.add('visible');
    if (statusSection) statusSection.style.display = 'none';
    if (tasks) tasks.style.display = 'none';
    if (actionsSection) actionsSection.style.display = 'none';
  }
});
