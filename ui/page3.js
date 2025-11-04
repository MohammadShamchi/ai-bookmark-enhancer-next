import { getOrganized } from '../lib/storage.js';
import { MSG } from '../lib/messages.js';

// Log when page loads
console.log('AI Bookmark Enhancer - Page 3 (Results) loaded');

(async () => {
  const organized = await getOrganized();

  console.log('Retrieved organized data:', organized);

  // Find the folders container
  const foldersContainer = document.querySelector('.folders');
  if (!foldersContainer || !organized?.folders) return;

  // Clear existing content
  foldersContainer.innerHTML = '';

  // Render each folder
  organized.folders.forEach(folder => {
    const folderDiv = document.createElement('div');
    folderDiv.className = 'folder';

    const folderName = document.createElement('div');
    folderName.className = 'folder-name';
    folderName.textContent = folder.name;

    const folderCount = document.createElement('div');
    folderCount.className = 'folder-count';
    folderCount.textContent = `${folder.ids.length} bookmarks`;

    folderDiv.appendChild(folderName);
    folderDiv.appendChild(folderCount);
    foldersContainer.appendChild(folderDiv);
  });

  console.log(`Rendered ${organized.folders.length} folders`);
})();

// Wire up Re-run Analysis button
const buttons = document.querySelectorAll('button');
for (const button of buttons) {
  if (button.textContent.includes('Re-run Analysis')) {
    button.addEventListener('click', () => {
      console.log('Re-running analysis');
      chrome.runtime.sendMessage({ type: MSG.START_ORGANIZE });
      location.href = 'page2.html';
    });
    break;
  }
}

// Add Settings button
const actionsContainer = document.querySelector('.actions');
if (actionsContainer) {
  const settingsBtn = document.createElement('button');
  settingsBtn.className = 'btn-secondary';
  settingsBtn.textContent = '⚙ Settings';
  settingsBtn.addEventListener('click', () => {
    console.log('Opening settings page');
    chrome.runtime.openOptionsPage();
  });
  actionsContainer.appendChild(settingsBtn);
}
