import { MSG } from '../lib/messages.js';

console.log('AI Bookmark Enhancer - Onboarding loaded');

const input = document.getElementById('key');
const save = document.getElementById('save');

save.addEventListener('click', async () => {
  const value = (input?.value || '').trim();
  if (!value) return; // keep minimal validation

  await chrome.storage.local.set({ OPENAI_KEY: value });
  chrome.runtime.sendMessage({ type: MSG.KEY_SAVED }); // optional, harmless if unused

  window.location.href = 'page1.html?keySaved=true';
});

// Also allow Enter key to submit
input?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    save.click();
  }
});
