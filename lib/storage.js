export async function getOrganized() {
  const { organized } = await chrome.storage.local.get('organized');
  return organized;
}

export async function setOrganized(organized) {
  await chrome.storage.local.set({ organized });
}
