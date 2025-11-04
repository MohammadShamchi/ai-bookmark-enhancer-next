export function ensureProgressElements() {
  let bar = document.querySelector('[data-progress-bar]');
  let text = document.querySelector('[data-progress-text]');

  if (!bar) {
    const container = document.createElement('div');
    const track = document.createElement('div');
    bar = document.createElement('div');
    text = text || document.createElement('div');

    container.style.padding = '12px';
    track.style.width = '100%';
    track.style.height = '8px';
    track.style.background = '#eee';
    bar.style.height = '8px';
    bar.style.width = '0%';
    bar.style.background = '#4f46e5';
    text.style.marginTop = '8px';
    text.style.fontSize = '12px';

    track.appendChild(bar);
    container.append(track, text);
    document.body.appendChild(container);

    bar.setAttribute('data-progress-bar', '');
    text.setAttribute('data-progress-text', '');
  }

  return { bar, text };
}

export function updateProgress(percent, stage) {
  const { bar, text } = ensureProgressElements();
  bar.style.width = `${percent}%`;
  text.textContent = `${stage} — ${percent}%`;
}

export function renderFolders(organized) {
  const root = document.querySelector('[data-folders-root]') || document.body;
  root.innerHTML = '';

  (organized?.folders || []).forEach(f => {
    const card = document.createElement('div');
    card.style.border = '1px solid #e5e7eb';
    card.style.borderRadius = '8px';
    card.style.padding = '12px';
    card.style.marginBottom = '8px';

    const title = document.createElement('div');
    title.textContent = f.name;
    title.style.fontWeight = '600';

    const ids = document.createElement('div');
    ids.textContent = `IDs: ${f.ids.join(', ')}`;

    card.append(title, ids);
    root.appendChild(card);
  });
}

export function markPageReady() {
  if (typeof window === 'undefined') return;
  requestAnimationFrame(() => {
    document.body?.classList.add('page-ready');
  });
}

export function navigateWithTransition(url, options = {}) {
  const { replace = false, delay = 180 } = options;
  if (document.body) {
    document.body.classList.add('page-exit');
  }
  setTimeout(() => {
    if (replace) {
      window.location.replace(url);
    } else {
      window.location.href = url;
    }
  }, delay);
}
