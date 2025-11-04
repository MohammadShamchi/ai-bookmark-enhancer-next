/**
 * Export bookmarks to JSON and Netscape HTML format
 */

/**
 * Trigger a download using Chrome downloads API with data URL
 */
async function triggerDownload(blob, filename) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  await new Promise((resolve, reject) => {
    chrome.downloads.download({ url: dataUrl, filename, saveAs: false }, (id) => {
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message));
      }
      resolve(id);
    });
  });
}

/**
 * Export bookmarks as JSON file
 */
export async function exportJson(flatList) {
  const json = JSON.stringify(flatList, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  await triggerDownload(blob, 'bookmarks-backup.json');
  console.log(`[backup.js] Downloaded JSON (${flatList.length} bookmarks)`);
}

/**
 * Export bookmarks as Netscape HTML format
 */
export async function exportHtml(flatList) {
  // Build folder structure from paths
  const folderMap = new Map();

  for (const bookmark of flatList) {
    const pathParts = bookmark.path ? bookmark.path.split('/').filter(Boolean) : [];
    let currentPath = '';

    for (const part of pathParts) {
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (!folderMap.has(currentPath)) {
        folderMap.set(currentPath, {
          name: part,
          path: currentPath,
          parentPath: parentPath,
          bookmarks: []
        });
      }
    }

    const targetPath = bookmark.path || '';
    if (!folderMap.has(targetPath)) {
      folderMap.set(targetPath, {
        name: '',
        path: targetPath,
        parentPath: '',
        bookmarks: []
      });
    }

    folderMap.get(targetPath).bookmarks.push(bookmark);
  }

  // Generate HTML
  let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
`;

  function renderFolder(path, indent = 1) {
    const folder = folderMap.get(path);
    if (!folder) return '';

    const indentStr = '    '.repeat(indent);
    let result = '';

    // Render bookmarks in this folder
    for (const bookmark of folder.bookmarks) {
      const addDate = bookmark.dateAdded ? Math.floor(bookmark.dateAdded / 1000) : '';
      result += `${indentStr}<DT><A HREF="${escapeHtml(bookmark.url)}"${addDate ? ` ADD_DATE="${addDate}"` : ''}>${escapeHtml(bookmark.title)}</A>\n`;
    }

    // Render subfolders
    const subfolders = Array.from(folderMap.values())
      .filter(f => f.parentPath === path)
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const subfolder of subfolders) {
      result += `${indentStr}<DT><H3>${escapeHtml(subfolder.name)}</H3>\n`;
      result += `${indentStr}<DL><p>\n`;
      result += renderFolder(subfolder.path, indent + 1);
      result += `${indentStr}</DL><p>\n`;
    }

    return result;
  }

  // Render root level bookmarks and folders
  const rootBookmarks = folderMap.get('');
  if (rootBookmarks) {
    for (const bookmark of rootBookmarks.bookmarks) {
      const addDate = bookmark.dateAdded ? Math.floor(bookmark.dateAdded / 1000) : '';
      html += `    <DT><A HREF="${escapeHtml(bookmark.url)}"${addDate ? ` ADD_DATE="${addDate}"` : ''}>${escapeHtml(bookmark.title)}</A>\n`;
    }
  }

  // Render top-level folders
  const topFolders = Array.from(folderMap.values())
    .filter(f => f.parentPath === '' && f.path !== '')
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const folder of topFolders) {
    html += `    <DT><H3>${escapeHtml(folder.name)}</H3>\n`;
    html += `    <DL><p>\n`;
    html += renderFolder(folder.path, 2);
    html += `    </DL><p>\n`;
  }

  html += `</DL><p>\n`;

  const blob = new Blob([html], { type: 'text/html' });
  await triggerDownload(blob, 'bookmarks-backup.html');
  console.log(`[backup.js] Downloaded HTML (${flatList.length} bookmarks)`);
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}
