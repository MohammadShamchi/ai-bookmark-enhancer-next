/**
 * Read Chrome bookmarks and flatten into a structured list
 */

export async function readBookmarks() {
  const tree = await new Promise(resolve => chrome.bookmarks.getTree(resolve));
  const flatList = [];

  const pushBookmarks = (nodes, pathParts = []) => {
    for (const node of nodes) {
      const isFolder = !!node.children;
      const nextPath = isFolder && node.title ? [...pathParts, node.title] : pathParts;

      if (node.url) {
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

  console.log(`[bookmarks.js] Read ${flatList.length} bookmarks from tree`);
  return { tree, flatList };
}
