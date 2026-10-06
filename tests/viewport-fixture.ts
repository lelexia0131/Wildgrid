// Open only on an isolated test port; this save exposes the densest level.
localStorage.setItem('wildgrid-save-v1', JSON.stringify({
  version: 1, completed: Array.from({ length: 30 }, (_, i) => i + 1), current: 30,
  progress: {}, settings: { music: 0, effects: 0, muted: true, facilityTips: true },
}));
void import('../src/main');
