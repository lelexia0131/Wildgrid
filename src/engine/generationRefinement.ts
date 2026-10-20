import { adjacent } from './boardGeometry';
import { placementDomains, cellBit } from './placementDomains';
import { CAMP_REQUIREMENTS, providesConnections, TERRAIN_REQUIREMENTS, terrainConflict, evaluate } from './placementRules';
import { terrainRegistry } from './terrainRegistry';
import { terrainPlacementScores, terrainDistribution } from './terrainLayout';
import { roleSwapCount } from './facilityConstruction';
import type { FacilityEntry } from './facilityConstruction';
import type { Level, Terrain, Placement } from './types';

// Move whole terrain units without changing any quantity. Answer footprints,
// terrain dependencies and forbidden adjacency are preserved before scoring.
export function refineTerrain(level: Level, entries: FacilityEntry[], random:()=>number, deadline:number, witnesses: readonly (readonly Placement[])[] = []): Level {
  let current=level,groups=placementDomains(current);
  const used=entries.reduce((m,e)=>m|e.p.mask,0n);
  const providers=entries.reduce((m,e)=>providesConnections(e.piece.kind)?m|e.p.mask:m,0n);
  const cost=(gs:typeof groups)=>gs.reduce((sum,g)=>{
    let entropy=0;for(let n=0;n<g.ids.length;n++) entropy+=Math.log((g.domain.length-n)/(g.ids.length-n));
    return sum+entropy;
  },0)+roleSwapCount(entries,gs)*30;
  const witnessCost=(candidate:Level)=>witnesses.filter(p=>evaluate(candidate,p).won).length*100;
  let score=cost(groups)+witnessCost(current);
  for(let step=0;step<(witnesses.length?1:2) && Date.now()<deadline;step++) {
    const moves:{terrain:Terrain[];estimate:number}[]=[];
    for(const def of terrainRegistry) {
      const remaining=new Set(current.terrain.filter(t=>t.kind===def.id).map(t=>t.r*8+t.c));
      for(const origin of current.terrain.filter(t=>t.kind===def.id)) {
        const unit=def.cells.map(p=>({r:p.r+origin.r,c:p.c+origin.c}));
        if(!unit.every(p=>remaining.has(p.r*8+p.c))) continue;
        for(const p of unit) remaining.delete(p.r*8+p.c);
        const base=current.terrain.filter(t=>t.kind!==def.id || !unit.some(p=>p.r===t.r && p.c===t.c));
        for(const candidate of terrainPlacementScores(base,def.id,current.terrain.length)) {
          if(Date.now()>=deadline) return current;
          if(candidate.cells.some(p=>(used&cellBit(p)) || entries.some(e=>terrainConflict(e.piece.kind,e.p.cells,{...p,kind:def.id})))) continue;
          const terrain=[...base,...candidate.cells.map(p=>({...p,kind:def.id}))];
          const blocked=terrain.reduce((m,p)=>m|cellBit(p),used);
          if(entries.some(e=>CAMP_REQUIREMENTS[e.piece.kind] && !e.p.connections.some(link=>(link.camp&providers) && !(link.gap&blocked)))) continue;
          if(entries.some(e=>{const need=TERRAIN_REQUIREMENTS[e.piece.kind];return need && !terrain.some(t=>t.kind===need && e.p.cells.some(p=>adjacent(p,t)));})) continue;
          if(terrainDistribution(terrain).violations.length) continue;
          if(witnesses.length && witnesses.every(placements=>evaluate({...current,terrain},placements).won)) continue;
          const added=candidate.cells.reduce((m,p)=>m|cellBit(p),0n);
          const estimate=groups.reduce((sum,g)=>sum+g.domain.filter(p=>(p.mask&added) || candidate.cells.some(c=>terrainConflict(g.piece.kind,p.cells,{...c,kind:def.id}))).length/Math.max(1,g.domain.length)*g.ids.length,0)+random()*.15;
          moves.push({terrain,estimate});
        }
      }
    }
    let best: {level:Level;groups:typeof groups;score:number}|undefined;
    for(const move of moves.sort((a,b)=>b.estimate-a.estimate).slice(0,8)) {
      if(Date.now()>=deadline) break;
      const next={...current,terrain:move.terrain},domains=placementDomains(next),value=cost(domains)+witnessCost(next);
      if(value<(best?.score??score)-.001) best={level:next,groups:domains,score:value};
    }
    if(!best) break;
    current=best.level;groups=best.groups;score=best.score;
  }
  return current;
}

