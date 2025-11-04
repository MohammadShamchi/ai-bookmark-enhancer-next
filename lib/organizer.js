/**
 * Merge and validate AI suggestions with bookmark data
 */

/**
 * Merge AI folder suggestions with actual bookmark data
 * @param {Object} aiResult - AI response with folders array
 * @param {Array} flatList - Original bookmark list
 * @returns {Object} - Clean organized data with validated folders
 */
export function mergeSuggestions(aiResult, flatList) {
  console.log('[organizer.js] Merging AI suggestions');

  // Build set of valid ids (as strings)
  const validIds = new Set(flatList.map(b => String(b.id)));
  console.log(`[organizer.js] Valid bookmark IDs: ${validIds.size}`);

  if (!aiResult?.folders || !Array.isArray(aiResult.folders)) {
    console.warn('[organizer.js] Invalid AI result, returning empty folders');
    return { folders: [] };
  }

  // Merge folders by case-insensitive name
  const folderMap = new Map();

  for (const folder of aiResult.folders) {
    if (!folder.name || !folder.ids) continue;

    const normalizedName = folder.name.trim();
    const key = normalizedName.toLowerCase();

    if (!folderMap.has(key)) {
      folderMap.set(key, {
        name: normalizedName,
        ids: new Set()
      });
    }

    const merged = folderMap.get(key);

    // Add valid ids only
    for (const id of folder.ids) {
      const idStr = String(id);
      if (validIds.has(idStr)) {
        merged.ids.add(idStr);
      }
    }
  }

  // Convert sets to arrays and build folders list
  const folders = Array.from(folderMap.values()).map(f => ({
    name: f.name,
    ids: Array.from(f.ids)
  })).filter(f => f.ids.length > 0);

  // Track assigned ids
  const assignedIds = new Set();
  folders.forEach(f => f.ids.forEach(id => assignedIds.add(id)));

  // Find unassigned bookmarks
  const unassignedIds = Array.from(validIds).filter(id => !assignedIds.has(id));

  if (unassignedIds.length > 0) {
    console.log(`[organizer.js] Found ${unassignedIds.length} unassigned bookmarks, adding to Unsorted`);
    folders.push({
      name: 'Unsorted',
      ids: unassignedIds
    });
  }

  // Sort folders by name
  folders.sort((a, b) => a.name.localeCompare(b.name));

  console.log(`[organizer.js] Merged into ${folders.length} folders`);
  folders.forEach(f => console.log(`  - ${f.name}: ${f.ids.length} bookmarks`));

  return { folders };
}
