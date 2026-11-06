// Hand-authored layouts and reference solutions. No random generation.
// Run only when editing the level pack; the game loads the resulting static JSON.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tsImport } from 'tsx/esm/api';
const { occupied } = await tsImport("../src/engine/index.ts", import.meta.url);
if (process.argv.includes('--sky')) { await authorCloudsea(); process.exit(0); }
const levels = [], solutions = {};
function level(name, chapter, tip, terrain, pieces) {
  const id = levels.length + 1, rows = Array(6).fill(0), cols = Array(6).fill(0);
  const answer = pieces.map(([kind, shape, r, c, rotation = 0], i) => {
    const at = { id: `${kind}-${i + 1}`, r, c, rotation };
    for (const cell of occupied({ id: at.id, kind, shape }, at)) { rows[cell.r]++; cols[cell.c]++; }
    return at;
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
level('长长的周末', '把营地展开', '这座营地需要更多空地，先看哪一行或列留下了足够的短杠。', [['water',2,1],['water',4,4],['forest',1,3],['mountain',1,5]], [['camp','long',2,2],['camp','single',4,3],['fire','single',3,3]]);
level('转角的风景', '把营地展开', 'L 形营地占三格。旋转四个方向，试试贴合这片草地。', [['water',1,1],['forest',0,4],['forest',4,1],['mountain',4,4]], [['camp','el',1,2],['fire','single',2,4],['tower','single',4,3]]);
level('林野协奏', '荒野成章', '把学到的规则串起来。点已放设施可拿起，再放到新的位置。', [['water',1,1],['water',4,5],['mountain',0,4],['mountain',5,1],['forest',2,4],['forest',0,0]], [['camp','domino',1,2],['camp','el',3,3],['fire','single',2,2],['tower','single',1,4],['tower','single',5,2]]);
level('我们的旷野', '荒野成章', '这片熟悉的营地图。所有设施放完后，仍然可以自由调整。', [['water',1,1],['water',4,5],['mountain',0,2],['mountain',5,1],['forest',0,4],['forest',5,5]], [['camp','long',1,2],['camp','el',3,3],['camp','single',2,1],['fire','single',2,3],['fire','single',4,2],['tower','single',0,3],['tower','single',5,2]]);
mkdirSync('src/game-data', { recursive: true });
const expansion = JSON.parse(readFileSync('src/game-data/levels.json', 'utf8')).filter(l => l.id > 15);
const expansionAnswers = Object.fromEntries(Object.entries(JSON.parse(readFileSync('src/game-data/solutions.json', 'utf8'))).filter(([id]) => Number(id) > 15));
levels.push(...expansion);
for (const l of levels) { l.name = `第${l.id}关`; l.chapter = ''; }
Object.assign(solutions, expansionAnswers);
writeFileSync('src/game-data/levels.json', JSON.stringify(levels, null, 2) + '\n');
writeFileSync('src/game-data/solutions.json', JSON.stringify(solutions, null, 2) + '\n');
console.log(`Authored ${levels.length} fixed levels.`);

// Cloudsea uses deliberately composed camps, anchor sites and flight paths.
// Refinement only adds fixed terrain that distinguishes alternate solutions;
// the chosen reference is never a hidden constraint in the game or solver.
async function authorCloudsea() {
  const { evaluate, solveLevel, facilityLayer, offsets } = await tsImport('../src/engine/index.ts', import.meta.url);
  const { reasonLevel } = await tsImport('../src/engine/logicalSolver.ts', import.meta.url);
  const terrain = (water, forest = [], mountain = []) => [water, forest, mountain].flatMap((list, k) => list.map(([r,c]) => ({kind:['water','forest','mountain'][k],r,c})));
  const p = (kind, r, c, shape = 'single', rotation = 0) => [kind,shape,r,c,rotation];
  const B = (r,c) => p('balloon',r,c), A = (r,c,rotation=0) => p('airship',r,c,'domino',rotation), K = (r,c,rotation=0) => p('kite',r,c,'long',rotation);
  const plans = [
    {t:terrain([[2,2]]), a:[[3,4]], c:[], p:[p('camp',2,3),B(2,4)], tip:'抬头看看，气球准备好啦。点右上角「天空」，先找系留桩旁边的位置；两层的格数要分开看哦。'},
    {t:terrain([[1,2],[5,4]],[[0,6]]),a:[[2,4]],c:[],p:[p('camp',2,2,'domino'),p('camp',5,3),p('fire',3,2),B(2,3)],tip:'这片营地上方也能停气球，不会挤掉帐篷。不过篝火的热气可不行，咱们给它留出上面的天空。'},
    {t:terrain([[2,1],[5,5]],[[0,3]],[[6,1]]),a:[[1,3],[5,3]],c:[[1,4],[4,3]],p:[p('camp',2,2,'long'),p('camp',5,4),p('fire',3,2),p('tower',6,2),B(2,3),B(5,4)],tip:'云把路遮住了一小段，换个方向试试。低云只挡天空，桩只占地面，它们都不用数进格数里。'},
    {t:terrain([[3,2]]),a:[[4,4]],c:[],p:[p('camp',3,3),B(3,4),A(3,2)],tip:'补给到了！让飞艇至少一格停在营地正上方。地面还没摆好也没关系，咱们可以回头再安顿。'},
    {t:terrain([[1,1],[5,5]],[[3,6]]),a:[[2,4]],c:[[0,3],[4,2]],p:[p('camp',1,2,'domino',1),p('camp',5,4),p('fire',3,2),B(2,3),A(1,2,1)],tip:'先别急着落位。把飞艇转一转，再看看云下的营地，哪个方向能把补给送到大家手里？'},
    {t:terrain([[1,2],[5,4]],[[4,0]],[[6,6]]),a:[[2,5],[6,2]],c:[[0,5],[4,6]],p:[p('camp',2,2,'el'),p('camp',5,3,'domino',1),p('fire',2,3),p('tower',6,5),B(2,4),A(3,2),A(5,3,1)],tip:'这座营地有好几格，每一格都能接补给。把两艘飞艇分开看看，也许另一岸正好留了位置。'},
    {t:terrain([[1,1],[5,5]],[[5,1]],[[1,6]]),a:[[3,4]],c:[[0,4],[4,3]],p:[p('camp',1,2,'long'),p('camp',5,3,'domino'),p('fire',2,2),p('foodTruck',3,3),p('powerTower',6,0),p('pool',4,5),B(2,4),A(5,3)],tip:'前面有电塔，咱们从它上方绕开。餐车的通道留在地面就好，不用替它空出整片天空。'},
    {t:terrain([[4,1]],[],[[2,4]]),a:[],c:[[5,6]],p:[p('camp',4,2),p('fire',4,3),K(2,3)],tip:'山脊上的风正合适！让风筝至少一格对着山地，再看看四周有没有低云，斜角也别漏掉。'},
    {t:terrain([[2,1],[6,5]],[[0,5]],[[3,4]]),a:[[1,3]],c:[[5,2],[0,7]],p:[p('camp',2,2,'domino'),p('camp',6,4),p('fire',3,2),B(1,4),A(6,3),K(2,4,1)],tip:'这条云边有点挤。飞艇可以贴着云停，风筝却得离远些；换个方向，看看谁更适合这里。'},
    {t:terrain([[1,1],[5,4]],[[5,0]],[[2,5],[6,6]]),a:[[3,4]],c:[[0,0],[6,2]],p:[p('camp',1,2,'el'),p('camp',5,3,'domino',1),p('fire',3,3),p('tower',7,6),p('picnic',6,4,'domino'),B(2,4),A(5,3,1),K(1,5,1)],tip:'桩、营地、山脊都找到了，咱们把三种飞行器接上。卡住时换层看看，另一边也许正等着你。'},
  ];
  // Five larger, separately composed layouts. Sky cells count toward the total
  // workload: the target is the 23–28 cells of Days 41–45, not two full boards.
  const finales = [
    {t:terrain([[0,2],[4,0],[2,6],[7,5]],[[3,3],[7,7]],[[4,7],[7,1]]),a:[[0,4],[5,4]],c:[[0,7],[7,3]],p:[p('camp',1,1,'long'),p('camp',4,1,'el'),p('camp',2,5,'domino',1),p('camp',6,5),p('fire',2,1),p('fire',6,2),p('tower',4,6),p('tower',7,0),p('picnic',6,6,'domino'),p('foodTruck',6,3),p('pool',7,6),B(1,4),B(5,5),A(1,1),K(3,7,1)]},
    {t:terrain([[1,0],[0,5],[5,2],[6,7]],[[4,4],[7,0]],[[2,7],[6,0]]),a:[[0,3],[4,6]],c:[[0,7],[7,4]],p:[p('camp',1,1,'el'),p('camp',1,4,'long'),p('camp',5,3,'domino'),p('camp',6,6),p('fire',3,2),p('fire',2,4),p('tower',3,7),p('tower',5,0),p('picnic',7,5,'domino'),p('foodTruck',4,1),p('powerTower',7,2),p('pool',5,7),B(1,3),B(4,5),A(5,3),K(4,0,1)]},
    {t:terrain([[0,1],[2,6],[5,0],[7,4]],[[3,3],[0,7]],[[0,4],[6,7]]),a:[[3,7],[5,3]],c:[[3,0],[7,6]],p:[p('camp',1,1,'domino'),p('camp',2,4,'domino'),p('camp',5,1,'el'),p('camp',6,4,'long'),p('fire',2,1),p('fire',1,5),p('tower',1,4),p('tower',5,7),p('cabin',3,2,'el'),p('picnic',7,2,'domino'),p('foodTruck',4,5),p('powerTower',7,0),p('pool',3,6),B(3,6),B(6,3),A(5,1),K(0,3)]},
    {t:terrain([[1,1],[0,6],[1,6],[4,0],[6,6]],[[3,4],[7,1]],[[1,4],[5,7]]),a:[[0,4],[2,3]],c:[[0,0],[4,1]],p:[p('camp',1,2,'domino',1),p('camp',1,5,'domino',1),p('camp',4,1,'long'),p('camp',6,5),p('fire',3,2),p('fire',5,2),p('tower',1,3),p('tower',6,7),p('cabin',3,5,'el'),p('picnic',7,4,'domino'),p('foodTruck',6,1),p('powerTower',6,0),p('pool',7,6),B(0,5),B(2,2),A(0,2,1),A(6,4),K(3,7,1)]},
    {t:terrain([[0,2],[4,0],[2,6],[7,5],[0,5]],[[3,3],[7,7]],[[4,7],[7,1]]),a:[[0,4],[5,4]],c:[[0,7],[7,3]],p:[p('camp',1,1,'domino'),p('camp',4,1,'el'),p('camp',2,5),p('camp',6,5),p('camp',0,6),p('fire',2,1),p('fire',6,2),p('tower',4,6),p('tower',7,0),p('cabin',3,2,'el'),p('picnic',6,6,'domino'),p('foodTruck',6,3),p('pool',7,6),B(1,4),B(5,5),A(4,1,1),A(0,6,1),K(3,7,1)]},
  ];
  finales.forEach((plan,i) => plans.push({...plan,tip:[
    '先挑一个上下两层都看得准的位置吧。天空少一个选择，地面往往也会跟着明朗起来。',
    '飞艇的方向还没定？看看它下面的营地，试着把两边剩下的格数对一对。',
    '这次留下的空地也在帮咱们指路。别急着填满，想想哪些地方不能留给篝火和电塔。',
    '同一座山，下面能靠瞭望塔，上面能借风放风筝。咱们沿着这条线索，再往另一层走一步。',
    '最后一片云海了。把营地安顿好，再让补给和风筝各就各位——这幅上下相连的营地图，就交给你啦。',
  ][i]}));
  const existing = JSON.parse(readFileSync('src/game-data/levels.json','utf8')).filter(l => l.id <= 45);
  const answers = Object.fromEntries(Object.entries(JSON.parse(readFileSync('src/game-data/solutions.json','utf8'))).filter(([id]) => +id <= 45));
  const same = (a,b) => a.r === b.r && a.c === b.c;
  const report = [];
  for (const [index,plan] of plans.entries()) {
    const id = 46+index, pieces = plan.p.map(([kind,shape],i) => ({id:`${kind}-${i+1}`,kind,shape}));
    const answer = plan.p.map(([, ,r,c,rotation],i) => ({id:pieces[i].id,r,c,rotation}));
    const sky = {rows:Array(8).fill(0),cols:Array(8).fill(0),anchors:plan.a.map(([r,c])=>({r,c})),clouds:plan.c.map(([r,c])=>({r,c}))};
    const level = {id,name:`第${id}关`,chapter:'',tip:plan.tip,size:8,terrain:plan.t,pieces,rows:Array(8).fill(0),cols:Array(8).fill(0),sky};
    answer.forEach((at,i) => {const target=facilityLayer(pieces[i].kind)==='sky'?sky:level; for(const cell of occupied(pieces[i],at)){target.rows[cell.r]++;target.cols[cell.c]++;}});
    const valid = evaluate(level,answer);
    if (!valid.won) throw new Error(`Day ${id} reference: ${JSON.stringify(valid.issues)}`);
    const footprint = layer => answer.flatMap((at,i)=>facilityLayer(pieces[i].kind)===layer?occupied(pieces[i],at):[]);
    let result;
    for (let iteration=0;iteration<32;iteration++) {
      result=solveLevel(level,8,{maxNodes:500000,deadline:Date.now()+12000});
      if(result.aborted) throw new Error(`Day ${id}: search budget`);
      if(result.count===1) break;
      if(!result.count) throw new Error(`Day ${id}: lost reference`);
      const options=[];
      for(let r=0;r<8;r++) for(let c=0;c<8;c++) {
        const cell={r,c};
        for(const kind of ['cloud','forest','mountain','water']) {
          const air=kind==='cloud';
          if(footprint(air?'sky':'ground').some(p=>same(p,cell)) || (air?sky.clouds:[...level.terrain,...sky.anchors]).some(p=>same(p,cell))) continue;
          const trial=air?{...level,sky:{...sky,clouds:[...sky.clouds,cell]}}:{...level,terrain:[...level.terrain,{...cell,kind}]};
          if(!evaluate(trial,answer).won) continue;
          const removed=result.solutions.filter(a=>!evaluate(trial,a).won).length;
          if(!removed) continue;
          const neighbours=(air?sky.clouds:level.terrain.filter(t=>t.kind===kind)).filter(p=>Math.abs(p.r-r)+Math.abs(p.c-c)===1).length;
          options.push({trial,removed,score:removed*10+neighbours*.6+(air?1:0)});
        }
      }
      options.sort((a,b)=>b.score-a.score);
      if(!options.length) throw new Error(`Day ${id}: no distinguishing terrain; revise the authored flight paths`);
      const best=options[0].trial;
      level.terrain=best.terrain;sky.clouds=best.sky.clouds;
    }
    if(result.count!==1 || result.aborted) throw new Error(`Day ${id}: not unique`);
    const logic=reasonLevel(level,{maxAssumptions:120,maxDepth:2,maxUnresolved:100,deadline:Date.now()+3000});
    existing.push(level);answers[id]=answer;
    report.push({id,pieces:pieces.length,cells:pieces.reduce((s,p)=>s+offsets(p.shape,0).length,0),skyCells:sky.rows.reduce((a,b)=>a+b,0),terrain:level.terrain.length,clouds:sky.clouds.length,nodes:result.nodes,candidates:result.candidates,logicSolved:logic.solved,rounds:logic.rounds,assumptions:logic.assumptions});
    console.log(JSON.stringify(report.at(-1)));
  }
  if (!process.argv.includes('--dry-run')) {
    writeFileSync('src/game-data/levels.json',JSON.stringify(existing,null,2)+'\n');
    writeFileSync('src/game-data/solutions.json',JSON.stringify(answers,null,2)+'\n');
  }
}
