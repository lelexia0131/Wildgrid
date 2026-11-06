import { placementDomains, compatible } from './placementDomains';
import type { Candidate, PlacementGroup } from './placementDomains';
import { CAMP_REQUIREMENTS, evaluate } from './placementRules';
import { offsets, solverBoard } from './boardGeometry';
import { reasonLevel, reasonedDomains } from './logicalSolver';
import type { Level, Placement } from './types';

export type SolverResult = { count: number; solutions: Placement[][]; terrain: number; pieces: number; occupied: number; candidates: number; rotationCandidates: number; nodes: number; branches: number; aborted: boolean; forced: number };

// One domain per kind + shape. Increasing placement indices remove ID permutations.
export function solveLevel(level: Level, limit = 2, budget: { deadline?: number; maxNodes?: number } = {}, prepared?: PlacementGroup[]): SolverResult {
  const { size: n, rows: rowTargets, cols: colTargets } = solverBoard(level);
  const board = Array.from({ length: n * n }, (_, i) => ({ r: Math.floor(i / n), c: i % n }));
  const original = prepared ?? placementDomains(level);
  // Basic deductions are necessary conditions, independent of any reference
  // answer. Reuse them before exhaustive search when no reduced domains were
  // supplied. The search still proves uniqueness and observes the same budget.
  const groups = prepared ? original : reasonedDomains(original,reasonLevel(level,{deadline:budget.deadline,maxAssumptions:0},original));
  const stats: SolverResult = { count: 0, solutions: [], terrain: level.terrain.length, pieces: level.pieces.length, occupied: 0, candidates: 0, rotationCandidates: 0, nodes: 0, branches: 0, aborted: false, forced: 0 };
  stats.occupied = level.pieces.reduce((sum, p) => sum + offsets(p.shape, 0).length, 0);
  stats.candidates = groups.reduce((s, g) => s + g.domain.length * g.ids.length, 0);
  stats.rotationCandidates = groups.reduce((s, g) => s + g.domain.filter(p => p.at.rotation !== 0).length * g.ids.length, 0);
  stats.forced = groups.reduce((s, g) => s + (g.domain.length === g.ids.length ? g.ids.length : 0), 0);
  if(limit<=0 || rowTargets.reduce((a,b)=>a+b,0)!==stats.occupied || colTargets.reduce((a,b)=>a+b,0)!==stats.occupied) return stats;
  const remaining = groups.map(g => g.ids.length);
  const rows = Array<number>(n).fill(0), cols = Array<number>(n).fill(0);
  const chosen: { g: number; p: Candidate }[] = [];
  const supports = (p: Candidate, camps: bigint, used: bigint) => p.connections.some(link => (link.camp & camps) && !(link.gap & used));
  let words=0;
  const spans=groups.map(g=>{const start=words;words+=Math.ceil(g.domain.length/32);return {start,end:words};});
  const positions=groups.flatMap((group,g)=>group.domain.map((p,i)=>({g,p,word:spans[g].start+(i>>>5),bit:(1<<(i&31))>>>0})));
  const positionStarts:number[]=[];let positionCount=0;
  for(const g of groups) {positionStarts.push(positionCount);positionCount+=g.domain.length;}
  const conflicts=positions.map(()=>new Uint32Array(words));
  const over=Array.from({length:n*2},()=>Array.from({length:n+1},()=>new Uint32Array(words)));
  const domains=Array.from({length:level.pieces.length+1},()=>new Uint32Array(words));
  for(let i=0;i<positions.length;i++) {
    // Compilation is also part of the caller's deadline. No partial index is
    // ever used as a proof or as a completed search result.
    if((i&31)===0 && Date.now()>=(budget.deadline??Infinity)) {stats.nodes=1;stats.aborted=true;return stats;}
    const a=positions[i];
    for(const b of positions) if(!compatible(b.p,groups[a.g].piece.kind,a.p)) conflicts[i][b.word]|=b.bit;
    if(!a.p.rows.some((v,r)=>v>rowTargets[r]) && !a.p.cols.some((v,c)=>v>colTargets[c])) domains[0][a.word]|=a.bit;
    for(let l=0;l<n;l++) {
      for(let capacity=0;capacity<a.p.rows[l];capacity++) over[l][capacity][a.word]|=a.bit;
      for(let capacity=0;capacity<a.p.cols[l];capacity++) over[l+n][capacity][a.word]|=a.bit;
    }
  }
  function search(used: bigint, camps: bigint) {
    if (stats.count >= limit || stats.aborted) return;
    stats.nodes++;
    if (stats.nodes > (budget.maxNodes ?? Infinity) || (stats.nodes % 64 === 1 && Date.now() >= (budget.deadline ?? Infinity))) { stats.aborted = true; return; }
    if (chosen.length === level.pieces.length) {
      if (rows.some((v, i) => v !== rowTargets[i]) || cols.some((v, i) => v !== colTargets[i])) return;
      if (chosen.some(({ g, p }) => CAMP_REQUIREMENTS[groups[g].piece.kind] && !supports(p, camps, used))) return;
      const indices = groups.map(() => 0);
      const solution = chosen.map(({ g, p }) => ({ ...p.at, id: groups[g].ids[indices[g]++] }));
      if (!evaluate(level, solution).won) return;
      stats.solutions.push(solution);
      stats.count++;
      return;
    }
    const live=domains[chosen.length];
    let best = -1, choices = 0, possible = 0n, possibleCamps = camps;
    for (let g = 0; g < groups.length; g++) {
      if (!remaining[g]) continue;
      const group=groups[g],span=spans[g];let count=0,union=0n;
      for(let w=span.start;w<span.end;w++) {
        let bits=live[w];
        while(bits) {
          const index=(w-span.start)*32+31-Math.clz32(bits&-bits);
          bits=(bits&(bits-1))>>>0;count++;union|=group.domain[index].mask;
        }
      }
      if(count<remaining[g]) return;
      possible|=union;
      if(group.piece.kind==='camp') possibleCamps|=union;
      if(best<0 || count/remaining[g]<choices/remaining[best]) {best=g;choices=count;}
    }
    if (chosen.some(({ g, p }) => CAMP_REQUIREMENTS[groups[g].piece.kind] && !supports(p, possibleCamps, used))) return;
    const capacityR = Array<number>(n).fill(0), capacityC = Array<number>(n).fill(0);
    for(let w=0;w<Math.ceil(n*n/32);w++) {
      let bits=Number((possible>>BigInt(w*32))&0xffffffffn);
      while(bits) {
        const cell=board[w*32+31-Math.clz32(bits&-bits)];
        bits=(bits&(bits-1))>>>0;capacityR[cell.r]++;capacityC[cell.c]++;
      }
    }
    if (rows.some((v, r) => v + capacityR[r] < rowTargets[r]) || cols.some((v, c) => v + capacityC[c] < colTargets[c])) return;
    const group=groups[best],span=spans[best];
    if(choices>1) stats.branches++;
    for(let w=span.start;w<span.end;w++) {
      let bits=live[w];
      while(bits) {
        const bitIndex=31-Math.clz32(bits&-bits),i=(w-span.start)*32+bitIndex;
        bits=(bits&(bits-1))>>>0;
        const p = group.domain[i], kind = group.piece.kind;
        if (CAMP_REQUIREMENTS[kind] && !supports(p, possibleCamps, used | p.mask)) continue;
        remaining[best]--; chosen.push({ g: best, p });
        for (let j = 0; j < n; j++) { rows[j] += p.rows[j]; cols[j] += p.cols[j]; }
        const next=domains[chosen.length],blocked=conflicts[positionStarts[best]+i];
        for(let word=0;word<words;word++) next[word]=live[word]&~blocked[word];
        // Increasing indices retain the original identical-piece symmetry rule.
        for(let word=span.start;word<w;word++) next[word]=0;
        next[w]&=bitIndex===31?0:0xffffffff<<(bitIndex+1);
        // All other lines and previous placements were checked in the parent.
        for(let l=0;l<n;l++) {
          if(p.rows[l]) {
            const mask=over[l][rowTargets[l]-rows[l]];
            if(mask) for(let word=0;word<words;word++) next[word]&=~mask[word];
          }
          if(p.cols[l]) {
            const mask=over[l+n][colTargets[l]-cols[l]];
            if(mask) for(let word=0;word<words;word++) next[word]&=~mask[word];
          }
        }
        search(used|p.mask,kind==='camp'?camps|p.mask:camps);
        for (let j = 0; j < n; j++) { rows[j] -= p.rows[j]; cols[j] -= p.cols[j]; }
        chosen.pop(); remaining[best]++;
        if (stats.count >= limit || stats.aborted) return;
      }
    }
  }
  search(0n,0n);
  return stats;
}

export const countSolutions = (level: Level, limit = 2) => solveLevel(level, limit).count;
