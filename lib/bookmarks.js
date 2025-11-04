/**
 * Read Chrome bookmarks and flatten into a structured list
 */

export async function readBookmarks() {
  const tree = await new Promise(resolve => chrome.bookmarks.getTree(resolve));
  const flatList = [];
  const totals = { total: 0, folders: 0 };

  const pushBookmarks = (nodes, pathParts = []) => {
    for (const node of nodes) {
      const isFolder = !!node.children;
      if (isFolder) {
        totals.folders += 1;
      }
      const nextPath = isFolder && node.title ? [...pathParts, node.title] : pathParts;

      if (node.url) {
        totals.total += 1;
        flatList.push({
          id: node.id,
          title: node.title || '',
          url: node.url,
          path: nextPath.join('/'),
          dateAdded: node.dateAdded || null
        });
      }

      if (node.children?.length) {
        pushBookmarks(node.children, nextPath);
      }
    }
  };

  pushBookmarks(tree);

  return { tree, flatList, totals };
}
