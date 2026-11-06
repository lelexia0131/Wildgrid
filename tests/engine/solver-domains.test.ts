import {test} from 'node:test';
import assert from 'node:assert/strict';
import {solveLevel} from '../../src/engine/solver';
import {placementDomains,placementGeometry,boardCells,cellBit} from '../../src/engine/placementDomains';
import {adjacent} from '../../src/engine/boardGeometry';
import type {Level} from '../../src/engine/types';

test('multiword domains enumerate all row permutations without counting interchangeable IDs twice',()=>{
  const level:Level={id:0,name:'',chapter:'',tip:'',size:8,terrain:[],
    pieces:Array.from({length:8},(_,i)=>({id:`p-${i}`,kind:'powerTower',shape:'single'})),
    rows:Array(8).fill(1),cols:[2,2,0,0,2,0,1,1]};
  const prepared=placementDomains(level),copy=structuredClone(prepared);
  assert.equal(prepared[0].domain.length,40);
  const result=solveLevel(level,Infinity,{},prepared);
  // Eight distinct rows assigned to columns with multiplicities 2,2,2,1,1.
  assert.equal(result.count,5040);
  assert.equal(result.aborted,false);
  assert.equal(new Set(result.solutions.map(s=>s.map(p=>`${p.r}:${p.c}`).sort().join(';'))).size,5040);
  assert.deepEqual(prepared,copy);
});

test('initial clue filtering and high placement indices survive bitset compilation and interrupted searches',()=>{
  for(const size of [6,8]) {
    const piece={id:'camp',kind:'camp' as const,shape:'el' as const};
    const positions=placementGeometry(piece,size),target=positions.at(-1)!;
    const water=boardCells(size).find(c=>!(cellBit(c,size)&target.mask) && target.cells.some(p=>adjacent(c,p)))!;
    const level:Level={id:0,name:'',chapter:'',tip:'',size,pieces:[piece],terrain:[{...water,kind:'water'}],rows:target.rows,cols:target.cols};
    const prepared=[{piece,ids:[piece.id],domain:positions}];
    assert.ok(positions.length>64);
    const solved=solveLevel(level,2,{},prepared);
    assert.equal(solved.count,1);
    assert.equal(solved.aborted,false);
    assert.deepEqual(solved.solutions[0],[{...target.at,id:piece.id}]);
    for(const budget of [{maxNodes:1},{maxNodes:0},{deadline:0}]) {
      const interrupted=solveLevel(level,2,budget,prepared);
      assert.equal(interrupted.aborted,true);
      assert.equal(interrupted.count,0);
    }
    assert.equal(solveLevel(level,0,{deadline:0},prepared).aborted,false);
  }
});
