const DEFAULT_PARENT_ID = '1'; // Bookmarks bar
const MAX_SAMPLE = 5;
const SAMPLE_PER_FOLDER = 2;
const FETCH_CHUNK_SIZE = 100;

export async function previewApply(organized) {
  const folders = Array.isArray(organized?.folders) ? organized.folders : [];
  const uniqueIds = new Set();
  const sampleEntries = [];
  const sampleIds = new Set();

  for (const folder of folders) {
    const ids = Array.isArray(folder?.ids) ? folder.ids : [];
    ids.forEach((id) => uniqueIds.add(String(id)));
  }

  for (const folder of folders) {
    if (sampleEntries.length >= MAX_SAMPLE) break;
    const ids = Array.isArray(folder?.ids) ? folder.ids : [];
    let taken = 0;
    for (const rawId of ids) {
      const id = String(rawId);
      if (sampleEntries.length >= MAX_SAMPLE || taken >= SAMPLE_PER_FOLDER) break;
      if (sampleIds.has(id)) continue;
      sampleIds.add(id);
      sampleEntries.push({ folder: folder?.name ?? 'Untitled', id });
      taken += 1;
    }
  }

  const nodes = await loadBookmarkNodes([...sampleIds]);
  const sample = sampleEntries
    .map((entry) => {
      const node = nodes[entry.id];
      if (!node) return null;
      return {
        folder: entry.folder,
        title: node.title || node.url || 'Untitled',
        url: node.url || '',
      };
    })
    .filter(Boolean);

  return {
    folders: folders.length,
    bookmarks: uniqueIds.size,
    sample,
  };
}

export async function applyStructure({ organized, parentId = DEFAULT_PARENT_ID, batchSize = 150, onProgress = null }) {
  const folders = Array.isArray(organized?.folders) ? organized.folders : [];
  if (!folders.length) {
    throw new Error('No organized folders available to apply.');
  }

  const emit = (payload) => {
    if (typeof onProgress === 'function') {
      onProgress(payload);
    }
  };

  const timestamp = formatTimestamp(new Date());
  const rootName = `AI Organized (${timestamp})`;
  emit({ stage: 'create_root', percent: 10, label: 'Creating root folder' });
  const rootId = await createFolder(parentId, rootName);

  const folderIdByName = Object.create(null);
  const usedNames = new Set();
  emit({ stage: 'create_folders', percent: 15, label: 'Creating folders' });
  const folderRecords = [];
  for (let index = 0; index < folders.length; index += 1) {
    const folder = folders[index];
    const uniqueName = uniqueFolderName(sanitizeName(folder?.name ?? 'Miscellaneous'), usedNames);
    const folderId = await createFolder(rootId, uniqueName);
    folderIdByName[uniqueName] = folderId;
    folderRecords.push({ folder, folderId, name: uniqueName });
    emit({
      stage: 'create_folders',
      percent: 15 + Math.floor(((index + 1) / folders.length) * 25),
      label: `Creating folder ${index + 1}/${folders.length}`,
    });
  }

  const allIds = [];
  folders.forEach((folder) => {
    (folder?.ids ?? []).forEach((id) => allIds.push(String(id)));
  });
  const originals = await loadBookmarkNodes(allIds);

  const toCreate = [];
  folderRecords.forEach((record) => {
    const folder = record.folder;
    const folderId = record.folderId;
    const seenUrls = new Set();

    (folder?.ids ?? []).forEach((rawId) => {
      const id = String(rawId);
      const node = originals[id];
      if (!node || !node.url) {
        return;
      }
      if (seenUrls.has(node.url)) {
        return;
      }
      seenUrls.add(node.url);
      toCreate.push({
        parentId: folderId,
        title: node.title || node.url,
        url: node.url,
        origId: id,
      });
    });
  });

  emit({ stage: 'create_bookmarks', percent: 45, label: 'Duplicating bookmarks' });
  const map = {};
  const batches = chunk(toCreate, Math.max(1, batchSize));
  const totalBatches = batches.length || 1;
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
    const batch = batches[batchIndex];
    for (const payload of batch) {
      const created = await createBookmark(payload.parentId, {
        title: payload.title,
        url: payload.url,
      });
      if (!map[payload.origId]) {
        map[payload.origId] = [];
      }
      map[payload.origId].push(created);
    }
    emit({
      stage: 'create_bookmarks',
      percent: 45 + Math.floor(((batchIndex + 1) / totalBatches) * 45),
      label: `Duplicating bookmarks ${(batchIndex + 1)} / ${totalBatches}`,
    });
    await sleep(0);
  }

  emit({ stage: 'finalize', percent: 100, label: 'Finalizing apply' });

  return {
    rootId,
    rootName,
    parentId,
    totalFolders: folderRecords.length,
    totalBookmarks: toCreate.length,
    map,
    createdAt: Date.now(),
    strategy: 'duplicate',
  };
}

export async function rollbackApply(rootId) {
  if (!rootId) {
    throw new Error('Missing rootId for rollback.');
  }
  const node = await getBookmark(rootId);
  if (!node) {
    throw new Error('Applied folder not found. It may have been removed already.');
  }
  if (!node.title?.startsWith('AI Organized (')) {
    throw new Error('Refusing to delete a folder that was not created by the enhancer.');
  }
  await removeTree(rootId);
}

function sanitizeName(input) {
  const value = String(input ?? '').replace(/[\\/:*?"<>|]/g, ' ').trim();
  return value.length ? value.slice(0, 120) : 'Miscellaneous';
}

function uniqueFolderName(name, used) {
  const base = name;
  let attempt = base;
  let counter = 2;
  while (used.has(attempt)) {
    attempt = `${base} (${counter})`;
    counter += 1;
  }
  used.add(attempt);
  return attempt;
}

async function createFolder(parentId, title) {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.create({ parentId, title }, (node) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(node.id);
    });
  });
}

async function createBookmark(parentId, { title, url }) {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.create({ parentId, title, url }, (node) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(node.id);
    });
  });
}

async function getBookmark(id) {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.get(id, (nodes) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(nodes?.[0] ?? null);
    });
  });
}

async function removeTree(id) {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.removeTree(id, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

async function loadBookmarkNodes(ids) {
  const uniqueIds = [...new Set(ids.filter(Boolean).map((id) => String(id)))];
  const result = {};
  if (!uniqueIds.length) {
    return result;
  }
  for (const group of chunk(uniqueIds, FETCH_CHUNK_SIZE)) {
    // chrome.bookmarks.get accepts an array of ids
    // but will reject if a single id is invalid; wrap to continue gracefully
    try {
      const nodes = await new Promise((resolve, reject) => {
        chrome.bookmarks.get(group, (items) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(items || []);
        });
      });
      nodes.forEach((node) => {
        if (node?.id) {
          result[node.id] = node;
        }
      });
    } catch {
      // ignore individual errors to keep the process resilient
    }
  }
  return result;
}

function chunk(array, size) {
  const output = [];
  for (let index = 0; index < array.length; index += size) {
    output.push(array.slice(index, index + size));
  }
  return output;
}

function formatTimestamp(date) {
  const pad = (value) => String(value).padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${yyyy}-${mm}-${dd} ${hh}${min}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
