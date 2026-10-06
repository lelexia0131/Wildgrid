// Hand-authored layouts and reference solutions. No random generation.
// Run only when editing the level pack; the game loads the resulting static JSON.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const levels = [], solutions = {};
function level(name, chapter, tip, terrain, pieces) {
  const id = levels.length + 1, rows = Array(6).fill(0), cols = Array(6).fill(0);
  const forms = { single: [[0, 0]], domino: [[0, 0], [0, 1]], long: [[0, 0], [0, 1], [0, 2]], el: [[0, 0], [1, 0], [1, 1]] };
  const answer = pieces.map(([kind, shape, r, c, rotation = 0], i) => {
    let cells = forms[shape];
    for (let n = 0; n < rotation; n++) cells = cells.map(([y, x]) => [x, -y]);
    const minR = Math.min(...cells.map(p => p[0])), minC = Math.min(...cells.map(p => p[1]));
    for (const [y, x] of cells) { rows[r + y - minR]++; cols[c + x - minC]++; }
    return { id: `${kind}-${i + 1}`, r, c, rotation };
  });
  levels.push({ id, name, chapter, tip, size: 6, terrain: terrain.map(([kind, r, c]) => ({ kind, r, c })), pieces: pieces.map(([kind, shape], i) => ({ id: `${kind}-${i + 1}`, kind, shape })), rows, cols });
  solutions[id] = answer;
}
level('初见溪流', '溪畔初遇', '选中营地，再点草地。营地至少有一格上下左右挨着水。', [['water',2,2]], [['camp','single',2,3]]);
level('两处好风景', '溪畔初遇', '每一处营地，都要找到属于自己的水源。', [['water',1,1],['water',4,4]], [['camp','single',1,2],['camp','single',4,3]]);
level('草地的线索', '溪畔初遇', '黄色短杠代表还需占用的格子；行与列都清空，规划才完成。', [['water',1,2],['water',3,3]], [['camp','single',0,2],['camp','single',1,1],['camp','single',3,4]]);
level('松林来信', '林间烟火', '森林是固定地形。绕过松树，寻找溪流旁的空地。', [['water',1,1],['water',4,3],['forest',0,1],['forest',2,3],['forest',3,1],['forest',4,4]], [['camp','single',1,2],['camp','single',3,3],['camp','single',4,2]]);
level('第一缕炊烟', '林间烟火', '篝火要上下左右挨着营地。先放篝火也可以，再为它安排营地。', [['water',2,1],['forest',0,4],['forest',5,0]], [['camp','single',2,2],['fire','single',2,3]]);
level('与森林留白', '林间烟火', '篝火与森林之间要留出距离，斜角相邻也不可以。', [['water',1,1],['water',4,4],['forest',0,3],['forest',3,0],['forest',5,0]], [['camp','single',1,2],['camp','single',4,3],['fire','single',2,2],['fire','single',4,2]]);
level('山那边', '山野远眺', '山地也不能覆盖。沿着山脚，继续寻找邻水的营地。', [['water',1,2],['water',4,3],['mountain',2,2],['mountain',3,4],['forest',0,4]], [['camp','single',1,1],['camp','single',4,2],['fire','single',2,1]]);
level('登高望远', '山野远眺', '瞭望塔必须上下左右挨着山地；这次只需安放两座塔。', [['mountain',1,1],['mountain',4,4],['forest',2,3],['water',3,1]], [['tower','single',1,2],['tower','single',4,3]]);
level('各自的天际线', '山野远眺', '两座瞭望塔不能相邻，斜角也要保持距离。', [['mountain',2,2],['mountain',3,3],['water',0,4],['forest',5,1]], [['tower','single',1,2],['tower','single',3,4],['camp','single',1,4]]);
level('双人假日', '把营地展开', '这座营地占用两格。点击旋转；任意一格邻水即可。', [['water',2,1],['forest',0,4],['mountain',4,4]], [['camp','domino',2,2]]);
level('沿溪而居', '把营地展开', '点击旋转。黄色短杠统计格子，不是建筑。', [['water',1,1],['water',4,4],['forest',0,4],['forest',3,0]], [['camp','domino',1,2,1],['camp','domino',4,2],['fire','single',3,2]]);
level('长长的周末', '把营地展开', '这座营地需要更多空地，先看哪一行或列留下了足够的短杠。', [['water',2,1],['water',4,4],['forest',0,3],['mountain',1,5]], [['camp','long',2,2],['camp','single',4,3],['fire','single',3,3]]);
level('转角的风景', '把营地展开', 'L 形营地占三格。旋转四个方向，试试贴合这片草地。', [['water',1,1],['forest',0,4],['forest',4,1],['mountain',4,4]], [['camp','el',1,2],['fire','single',2,4],['tower','single',4,3]]);
level('林野协奏', '荒野成章', '把学到的规则串起来。点已放设施可拿起，再放到新的位置。', [['water',1,1],['water',4,5],['mountain',0,4],['mountain',5,1],['forest',3,0],['forest',0,0]], [['camp','domino',1,2],['camp','el',3,3],['fire','single',2,2],['tower','single',1,4],['tower','single',5,2]]);
level('我们的旷野', '荒野成章', '这片熟悉的营地图。所有设施放完后，仍然可以自由调整。', [['water',1,1],['water',4,5],['mountain',0,4],['mountain',5,1],['forest',0,0],['forest',5,5]], [['camp','long',1,2],['camp','el',3,3],['camp','single',2,1],['fire','single',2,3],['fire','single',4,2],['tower','single',0,3],['tower','single',5,2]]);
mkdirSync('src/data', { recursive: true });
mkdirSync('tests', { recursive: true });
const expansion = JSON.parse(readFileSync('src/data/levels.json', 'utf8')).filter(l => l.id > 15);
const expansionAnswers = Object.fromEntries(Object.entries(JSON.parse(readFileSync('tests/solutions.json', 'utf8'))).filter(([id]) => Number(id) > 15));
levels.push(...expansion);
for (const l of levels) { l.name = `第${l.id}关`; l.chapter = ''; }
Object.assign(solutions, expansionAnswers);
writeFileSync('src/data/levels.json', JSON.stringify(levels, null, 2) + '\n');
writeFileSync('tests/solutions.json', JSON.stringify(solutions, null, 2) + '\n');
console.log(`Authored ${levels.length} fixed levels.`);
