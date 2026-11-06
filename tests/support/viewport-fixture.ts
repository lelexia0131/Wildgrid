// Open only on an isolated test port. Query parameters select a fixed QA board.
import levels from '../../src/game-data/levels.json';
import answers from '../../src/game-data/solutions.json';
const query = new URLSearchParams(location.search);
const day = Number(query.get('day')) || 30;
const level = levels.find(l => l.id === day)!;
const solution = answers[String(day) as keyof typeof answers];
const missing = [level.pieces.find(p => p.kind === 'balloon')?.id, level.pieces.find(p => p.kind === 'airship')?.id];
localStorage.setItem('wildgrid-save-v1', JSON.stringify({
  version: 1, completed: Array.from({ length: query.has('complete') ? day : day > 45 ? day - 1 : 30 }, (_, i) => i + 1), current: day,
  progress: query.has('partial') ? { [day]: solution.filter(at => !missing.includes(at.id)) } : {},
  layers: { [day]: query.get('layer') === 'sky' ? 'sky' : 'ground' },
  settings: { music: 0, effects: 0, muted: true, facilityTips: query.get('tips') !== 'off' },
}));
if (day > 45) localStorage.setItem('wildgrid-tutorial-v1', JSON.stringify({ version: 1, enabled: query.has('tutorial'), language: query.get('language') || 'zh' }));
void import('../../src/main');
