export async function getOrganized() {
  const { organized } = await chrome.storage.local.get('organized');
  return organized;
}

export async function setOrganized(organized) {
  await chrome.storage.local.set({ organized });
}

export async function setRunMeta(meta) {
  return chrome.storage.local.set({ runMeta: meta });
}

export async function getRunMeta() {
  const { runMeta } = await chrome.storage.local.get('runMeta');
  return runMeta ?? null;
}

export async function clearRunMeta() {
  return chrome.storage.local.remove('runMeta');
}
