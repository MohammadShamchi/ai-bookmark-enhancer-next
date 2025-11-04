import { MSG } from '../lib/messages.js';
import { readBookmarks } from '../lib/bookmarks.js';

// Log when tab opens
console.log('AI Bookmark Enhancer - Page 1 loaded');

const organizeBtn = document.getElementById('organize-btn');
const connectBtn = document.getElementById('connect-key');
const keyHint = document.getElementById('key-hint');
const metricEl = document.querySelector('.metric');

// Load dynamic bookmark count
(async () => {
  try {
    const { flatList } = await readBookmarks();
    if (metricEl) metricEl.textContent = flatList.length;
  } catch (error) {
    console.error('Failed to read bookmarks:', error);
  }
})();

// Check for API key and toggle UI
chrome.storage.local.get('OPENAI_KEY', ({ OPENAI_KEY }) => {
  const hasKey = Boolean(OPENAI_KEY);

  if (organizeBtn) organizeBtn.disabled = !hasKey;
  if (connectBtn) connectBtn.hidden = hasKey;
  if (keyHint) keyHint.hidden = hasKey;

  console.log(`API key status: ${hasKey ? 'present' : 'missing'}`);
});

// Show toast if redirected after key save
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('keySaved') === 'true') {
  showToast('✓ API key connected');
  // Clean URL without reload
  window.history.replaceState({}, '', window.location.pathname);
}

// Organize button click handler
if (organizeBtn) {
  organizeBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: MSG.START_ORGANIZE });
    location.href = 'page2.html';
  });
}

// Connect key button click handler
if (connectBtn) {
  connectBtn.addEventListener('click', () => {
    location.href = 'onboarding.html';
  });
}

// Accordion toggle logic
document.querySelectorAll('.accordion-header').forEach((header) => {
  header.addEventListener('click', () => {
    const item = header.parentElement;
    const openItem = document.querySelector('.accordion-item.open');
    if (openItem && openItem !== item) openItem.classList.remove('open');
    item.classList.toggle('open');
  });
});

// Toast notification
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 1500);
}
