import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import data from '../src/data/levels.json';
import answers from '../src/data/solutions.json';
import { evaluate, occupied } from '../src/game/rules';
import { solveLevel } from '../src/game/solver';
import { checkSandbox, decodeMap, encodeMap, facilityLibrary, withEditorPlacements } from '../src/game/sandbox';
import { levelUnlocked, readSave, writeSave } from '../src/game/storage';
import { readLocalMaps, saveLocalMap } from '../src/game/localMaps';
import { completeSurvival, emptySurvivalProgress, readSurvival, survivalTotals, writeSurvival } from '../src/game/survival';
import { generateSurvival } from '../src/game/survivalGenerator';
import { facilities } from '../src/components/Manual';
import type { FacilityKind, Level, Placement, TerrainKind } from '../src/game/types';

const levels = data as Level[], solutions = answers as Record<string, Placement[]>;
const values = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {configurable:true,value:{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v)}});
function fixture(pieces: Level['pieces'], placements: Placement[], terrain: Level['terrain']) {
  return withEditorPlacements({level:{id:0,name:'test',chapter:'',tip:'',size:8,pieces,terrain,rows:[],cols:[]},placements:[]},placements);
}
const single = (id:string, kind:FacilityKind) => ({id,kind,shape:'single' as const});
const at = (id:string,r:number,c:number) => ({id,r,c,rotation:0});

test('new relationships use actual camp cells, work in either placement order and reject blocked truck gaps',()=>{
  const camp={id:'c',kind:'camp' as const,shape:'el' as const}, truck=single('v','foodTruck');
  const d=fixture([camp,truck],[at('c',2,2),at('v',3,5)],[{kind:'water',r:2,c:1}]);
  assert.equal(evaluate(d.level,d.placements).won,true);
  assert.equal(evaluate(d.level,[d.placements[1]]).issues.v.status,'INCOMPLETE');
  assert.equal(evaluate(d.level,[...d.placements].reverse()).won,true);
  assert.equal(evaluate(d.level,[d.placements[0],at('v',3,4)]).issues.v.status,'INVALID');
  assert.equal(evaluate({...d.level,terrain:[...d.level.terrain,{kind:'mountain',r:3,c:4}]},d.placements).issues.v.status,'INVALID');
  const blocked=fixture([...d.level.pieces,single('e','powerTower')],[...d.placements,at('e',3,4)],d.level.terrain);
  assert.equal(evaluate(blocked.level,blocked.placements).issues.v.status,'INVALID');
  const pool=fixture([camp,single('s','pool')],[at('c',2,2),at('s',1,1)],[{kind:'water',r:2,c:1}]);
  assert.equal(evaluate(pool.level,pool.placements).won,true);
  assert.equal(evaluate(pool.level,[pool.placements[1]]).issues.s.status,'INCOMPLETE');
  assert.equal(evaluate({...pool.level,terrain:[{kind:'water',r:2,c:0}]},pool.placements).issues.s.status,'INVALID');
  const power=fixture([single('c','camp'),single('b','fire'),single('e','powerTower')],[at('c',2,2),at('b',2,3),at('e',4,2)],[{kind:'water',r:2,c:1}]);
  assert.equal(evaluate(power.level,power.placements).won,true);
  const diagonal=evaluate(power.level,[power.placements[0],power.placements[1],at('e',3,4)]);
  assert.equal(diagonal.issues.e.status,'INVALID'); assert.equal(diagonal.issues.b.status,'INVALID');
  const direct=evaluate(power.level,[power.placements[0],at('e',3,2)]);
  assert.equal(direct.issues.c.status,'INVALID'); assert.equal(direct.issues.e.status,'INVALID');
  const diagonalCamp=fixture([single('c','camp'),single('e','powerTower')],[power.placements[0],at('e',3,3)],power.level.terrain);
  assert.equal(evaluate(diagonalCamp.level,diagonalCamp.placements).won,true);
});

test('Days 31–45 are unique, retain all old maps and answers, and stay within benchmark scale',()=>{
  const baseline=JSON.parse(readFileSync('reports/day31-baseline.json','utf8'));
  const preserved=JSON.parse(readFileSync('reports/day31-preservation.json','utf8'));
  const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
  assert.equal(digest(levels.filter(l=>l.id<=30)),preserved.levels);
  assert.equal(digest(Object.fromEntries(Object.entries(solutions).filter(([id])=>+id<=30))),preserved.solutions);
  for(const level of levels.filter(l=>l.id>=31)) {
    const result=solveLevel(level,2,{maxNodes:350000});
    assert.equal(result.aborted,false,`Day ${level.id}`);assert.equal(result.count,1,`Day ${level.id}`);
    assert.equal(evaluate(level,solutions[level.id]).won,true);
    assert.equal(level.size,8);assert.equal(level.chapter,'');assert.equal(level.name,`第${level.id}关`);
    // All subsets in reverse order keep satisfiable camp dependencies pending.
    const reversed=[...solutions[level.id]].reverse();
    for(let i=1;i<reversed.length;i++) assert.notEqual(evaluate(level,reversed.slice(0,i)).status,'INVALID',`Day ${level.id} prefix ${i}`);
    if(level.id>=41) {
      const original=levels[level.id-16], spec=baseline[level.id-41].search;
      assert.equal(level.pieces.length,original.pieces.length);
      assert.equal(result.occupied,spec.occupied);
      assert.deepEqual(level.pieces.filter(p=>p.shape!=='single').map(p=>`${p.kind}_${p.shape}`).sort(),original.pieces.filter(p=>p.shape!=='single').map(p=>`${p.kind}_${p.shape}`).sort());
      assert.ok(result.nodes<=spec.nodes*1.3);
      for(const kind of ['foodTruck','powerTower','pool']) assert.ok(level.pieces.some(p=>p.kind===kind));
    }
  }
});

test('manual examples satisfy the stated new rules, including each forbidden relationship',()=>{
  const symbols:Record<string,FacilityKind|TerrainKind>={W:'water',C:'camp',B:'fire',V:'foodTruck',E:'powerTower',S:'pool'};
  for(const f of facilities.filter(f=>['foodTruck','powerTower','pool'].includes(f.kind))) {
    for(const example of [{map:f.good,good:true},{map:f.bad,good:false},...(f.extra??[]).map(e=>({...e,good:false}))]) {
      const terrain:Level['terrain']=[],pieces:Level['pieces']=[],placements:Placement[]=[];
      const camps=example.map.flatMap((row,r)=>[...row].flatMap((s,c)=>s==='C'?[{r,c}]:[]));
      if(camps.length) {
        const shape=camps.length===1?'single':'domino';pieces.push({id:'c',kind:'camp',shape});placements.push(at('c',camps[0].r,camps[0].c));
      }
      example.map.forEach((row,r)=>[...row].forEach((s,c)=>{
        const kind=symbols[s];if(!kind||s==='C') return;
        if(kind==='water'||kind==='forest'||kind==='mountain') terrain.push({kind,r,c});
        else {const id=`${s}-${r}-${c}`;pieces.push(single(id,kind));placements.push(at(id,r,c));}
      }));
      const d=fixture(pieces,placements,terrain), result=evaluate(d.level,d.placements);
      assert.equal(result.won,example.good,`${f.kind}: ${example.map.join('/')}`);
      if(!example.good) assert.ok(pieces.filter(p=>p.kind===f.kind).some(p=>result.issues[p.id].status==='INVALID'));
    }
  }
});

test('separate unlock chains, WG1 and all three save systems preserve old and new progress',()=>{
  values.clear();
  assert.equal(levelUnlocked(31,[15]),true);assert.equal(levelUnlocked(32,[15]),false);
  assert.equal(levelUnlocked(32,[15,31]),true);assert.equal(levelUnlocked(33,[15,31]),false);
  assert.equal(levelUnlocked(17,[15,31,32]),false);assert.equal(levelUnlocked(31,[30]),false);
  for(const kind of ['foodTruck','powerTower','pool']) assert.ok(facilityLibrary.some(p=>p.kind===kind&&p.shape==='single'));
  const old={level:levels[29],placements:solutions[30]}, fresh={level:levels[40],placements:solutions[41]};
  for(const d of [old,fresh]) { const code=encodeMap(d);assert.ok(code.startsWith('WG1:'));assert.deepEqual(decodeMap(code).level.pieces,d.level.pieces); }
  assert.equal(checkSandbox(fresh).status,'unique');
  const save=readSave(levels);save.completed=[1,15,31];save.current=32;save.progress[17]=solutions[17].slice(0,2);save.progress[32]=solutions[32].slice(0,1);writeSave(save);
  assert.deepEqual(readSave(levels).completed,save.completed);
  for(const [id,progress] of Object.entries(save.progress)) assert.deepEqual(readSave(levels).progress[Number(id)],progress);
  saveLocalMap(old,old.placements.slice(0,2));saveLocalMap(fresh,fresh.placements.slice(0,2));assert.equal(readLocalMaps().length,2);
  const challenge={id:'new',difficulty:7,seed:31,draft:fresh,fingerprint:'fixture'};
  const survival=readSurvival();survival.completed=[{id:'old-win',difficulty:10,seed:30,at:1}];survival.challenge=challenge;survival.progress={...emptySurvivalProgress('new'),placements:fresh.placements.slice(0,2)};writeSurvival(survival);
  assert.deepEqual(readSurvival().progress,survival.progress);assert.equal(survivalTotals(readSurvival()).xp,100);
  assert.equal(completeSurvival(challenge,fresh.placements).reward.earned,36);
  assert.equal(completeSurvival(challenge,fresh.placements).reward.earned,0);
  assert.equal(survivalTotals(readSurvival()).xp,136);
});

test('one low, middle and high survival sample is legal and unique without changing reward tiers',()=>{
  for(const difficulty of [1,5,10]) {
    const start=Date.now(), map=generateSurvival(difficulty,20261009+difficulty,`day31-${difficulty}`);
    const solved=solveLevel(map.draft.level,2,{deadline:Date.now()+3000,maxNodes:100000});
    assert.equal(evaluate(map.draft.level,map.draft.placements).won,true);assert.equal(solved.aborted,false);assert.equal(solved.count,1);
    console.log(`${difficulty}难: ${Date.now()-start}ms, ${solved.nodes} nodes, ${map.draft.level.pieces.map(p=>p.kind).join(',')}`);
    assert.ok(map.draft.placements.flatMap(p=>occupied(map.draft.level.pieces.find(q=>q.id===p.id)!,p)).length<=32);
  }
});
