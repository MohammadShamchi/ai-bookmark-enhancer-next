import { MSG } from './lib/messages.js';
import { setOrganized } from './lib/storage.js';
import { readBookmarks } from './lib/bookmarks.js';
import { exportJson, exportHtml } from './lib/backup.js';
import { categorizeBookmarks, cancelCategorization } from './lib/ai_client.js';
import { mergeSuggestions } from './lib/organizer.js';

// Open full-screen tab when extension icon is clicked
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('ui/page1.html') });
  console.log('AI Bookmark Enhancer opened in new tab');
});

// Track organize state
let isOrganizing = false;

// Listen for organize request from page1
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === MSG.START_ORGANIZE) {
    startOrganize();
  }
  if (message?.type === MSG.ORGANIZE_CANCEL) {
    handleCancel();
  }
});

async function startOrganize() {
  const { OPENAI_KEY } = await chrome.storage.local.get('OPENAI_KEY');
  if (!OPENAI_KEY) {
    console.error('[Error] OPENAI_KEY not found');
    safeSend({ type: MSG.ORGANIZE_ERROR, reason: 'MISSING_KEY' });
    return;
  }

  isOrganizing = true;

  console.log('[Start] Reading bookmarks');
  sendTick('Reading bookmarks', 20);
  const { flatList } = await readBookmarks();
  console.log(`[Complete] Read ${flatList.length} bookmarks`);

  if (!isOrganizing) return;

  console.log('[Backup] JSON');
  sendTick('Backup JSON', 40);
  await exportJson(flatList);
  console.log('[Complete] JSON backup created');

  if (!isOrganizing) return;

  console.log('[Backup] HTML');
  sendTick('Backup HTML', 60);
  await exportHtml(flatList);
  console.log('[Complete] HTML backup created');

  if (!isOrganizing) return;

  console.log('[AI] Starting categorization');
  sendTick('Analyzing with AI', 80);

  let organized;
  try {
    const aiResult = await categorizeBookmarks(flatList, (percent, stage) => {
      if (isOrganizing) {
        sendTick(stage, percent);
      }
    });

    if (!isOrganizing) return;

    console.log(`[AI] Received ${aiResult.folders?.length || 0} folder suggestions`);
    organized = mergeSuggestions(aiResult, flatList);
    console.log(`[AI] Final organization: ${organized.folders.length} folders`);
  } catch (error) {
    if (error.message === 'CANCELLED') {
      console.log('[AI] Categorization cancelled by user');
      isOrganizing = false;
      return;
    }
    console.error('[AI] Error during categorization:', error.message);
    console.log('[AI] Falling back to empty folders');
    organized = { folders: [] };
  }

  if (!isOrganizing) return;

  await setOrganized(organized);
  console.log('[Progress] Completed');
  sendTick('Completed', 100);

  console.log('[Done] Organization complete, sending ORGANIZE_DONE');
  safeSend({ type: MSG.ORGANIZE_DONE });
  isOrganizing = false;
}

function handleCancel() {
  console.log('[Cancel] User requested cancellation');
  if (isOrganizing) {
    isOrganizing = false;
    cancelCategorization();
    safeSend({ type: MSG.ORGANIZE_CANCELLED });
  }
}

function safeSend(msg) {
  try {
    chrome.runtime.sendMessage(msg);
  } catch (e) {}
}

function sendTick(stage, percent) {
  safeSend({ type: MSG.PROGRESS_TICK, stage, percent });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
