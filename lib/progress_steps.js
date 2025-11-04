export const PROGRESS_STEPS = [
  { id: 'read', label: 'Collecting bookmarks', percent: 20 },
  { id: 'bkp_json', label: 'Backup JSON', percent: 40 },
  { id: 'bkp_html', label: 'Backup HTML', percent: 60 },
  { id: 'ai', label: 'Analyzing with AI', percent: 80 },
  { id: 'done', label: 'Completed', percent: 100 },
];

export const stepById = (id) => PROGRESS_STEPS.find((step) => step.id === id) ?? PROGRESS_STEPS.at(-1);
