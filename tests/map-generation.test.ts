import { test } from 'node:test';
import assert from 'node:assert/strict';
import { facilityLibrary } from '../src/engine/facilityRegistry';
import { evaluate } from '../src/engine/placementRules';
import { occupied } from '../src/engine/boardGeometry';
import { staticPositions } from '../src/engine/placementDomains';
import { reasonLevel } from '../src/engine/logicalSolver';
import { solveLevel } from '../src/engine/solver';
import { generateMap, MapGenerationSearchError } from '../src/engine/mapGeneration';
import { facilityRestrictionError } from '../src/game-modes/survival/survivalFacilities';
import type { Level } from '../src/engine/types';

test('shared placement domains agree with the real static gameplay evaluator, including all rotations', () => {
  for (const size of [6, 8]) for (const piece of facilityLibrary) {
    const level: Level = { id: 0, name: '', chapter: '', tip: '', size, pieces: [piece], terrain: [{r:1,c:1,kind:'water'},{r:3,c:2,kind:'forest'},{r:4,c:4,kind:'mountain'}], rows: Array(size).fill(3), cols: Array(size).fill(2) };
    const token = (at: {r:number;c:number;rotation:number}) => occupied(piece, {...at,id:piece.id}).map(p=>`${p.r},${p.c}`).sort().join(';');
    const actual = new Set<string>();
    for (let rotation=0;rotation<4;rotation++) for (let r=0;r<size;r++) for (let c=0;c<size;c++) {
      const at={r,c,rotation,id:piece.id};
      if (evaluate(level,[at],{staticOnly:true}).status !== 'INVALID') actual.add(token(at));
    }
    assert.deepEqual(new Set(staticPositions(piece,level).map(p=>token(p.at))),actual,`${size}/${piece.id}`);
  }
});

const make = (pieces: Level['pieces'], terrain: Level['terrain'], rows: number[], cols: number[]): Level => ({ id:0,name:'',chapter:'',tip:'',size:3,pieces,terrain,rows,cols });
test('logical cardinality handles interchangeable IDs; ambiguity and interrupted searches never prove uniqueness', () => {
  const identical = make([{id:'a',kind:'camp',shape:'single'},{id:'b',kind:'camp',shape:'single'}],[{r:0,c:0,kind:'water'}],[1,1,0],[1,1,0]);
  assert.equal(reasonLevel({...identical,terrain:Array.from({length:9},(_,i)=>({r:Math.floor(i/3),c:i%3,kind:'water' as const}))}).contradiction,true);
  const solved=reasonLevel(identical);
  assert.equal(solved.solved,true); assert.equal(evaluate(identical,solved.placements).won,true); assert.equal(solveLevel(identical,2).count,1);
  const ambiguous=make([{id:'c',kind:'camp',shape:'single'},{id:'f',kind:'fire',shape:'single'}],[{r:1,c:1,kind:'water'},{r:1,c:2,kind:'water'}],[2,0,0],[0,1,1]);
  assert.equal(solveLevel(ambiguous,2).count,2);
  assert.equal(reasonLevel(ambiguous,{maxAssumptions:24,maxDepth:2}).solved,false);
  const interrupted=solveLevel(ambiguous,2,{maxNodes:3});
  assert.equal(interrupted.count,1); assert.equal(interrupted.aborted,true);
  const expired=reasonLevel(identical,{deadline:Date.now()-1});
  assert.equal(expired.aborted,true); assert.equal(expired.solved,false);
});

test('impossible multigrid restrictions and exhausted generation budgets fail explicitly', () => {
  const disabled=facilityLibrary.filter(p=>p.shape!=='single').map(p=>`${p.kind}_${p.shape}`);
  assert.match(facilityRestrictionError(2,disabled)!,/多格/);
  assert.throws(()=>generateMap(1,1,'budget',[],{min:4,max:5,multi:0},[],[],0),error=>error instanceof MapGenerationSearchError && error.diagnostics?.proofs===0 && error.diagnostics.attempts===0);
});

test('a disabled single-cell camp is replaced by a legal multigrid camp even in tier one', () => {
  const map=generateMap(1,20261019,'no-single',[],{min:4,max:5,multi:0},['camp_single']);
  assert.ok(map.draft.level.pieces.some(p=>p.kind==='camp'));
  assert.ok(map.draft.level.pieces.every(p=>p.kind!=='camp'||p.shape!=='single'));
  const proof=solveLevel(map.draft.level,2);
  assert.equal(proof.aborted,false); assert.equal(proof.count,1);
});
