import { adjacent } from './boardGeometry';
import { placementDomains, placementGeometry, domainsWithClues, compatible, cellBit } from './placementDomains';
import type { PlacementGroup } from './placementDomains';
import { reasonLevel } from './logicalSolver';
import { templateId, MAX_GENERATED_LINE_OCCUPANCY } from './generationConfig';
import type { SandboxDraft } from './mapBlueprint';
import { CAMP_REQUIREMENTS, providesConnections, TERRAIN_REQUIREMENTS, terrainConflict } from './placementRules';
import { terrainRegistry } from './terrainRegistry';
import { terrainPlacementScores, terrainDistribution } from './terrainLayout';
import { roleSwapCount } from './facilityConstruction';
import type { FacilityEntry } from './facilityConstruction';
import type { Level, Terrain, Placement } from './types';

// Refine the clue information itself. Domain entropy alone misses layouts in
// which many candidates survive every deduction, despite small static domains.
export function refineLogicalLayout(draft:SandboxDraft, entries:FacilityEntry[], groups:PlacementGroup[], random:()=>number, deadline:number,maxEmptyLines=16):SandboxDraft {
  const makeDraft=():SandboxDraft=>{
    const rows=Array<number>(8).fill(0),cols=Array<number>(8).fill(0);
    for(const e of entries) for(let i=0;i<8;i++){rows[i]+=e.p.rows[i];cols[i]+=e.p.cols[i];}
    return {...draft,level:{...draft.level,rows,cols},placements:entries.map(e=>({...e.p.at,id:e.piece.id}))};
  };
  const clueScores=new Map<string,{value:number;prepared:PlacementGroup[]}>();
  const score=(candidate:SandboxDraft)=>{
    if([...candidate.level.rows,...candidate.level.cols].some(value=>value>MAX_GENERATED_LINE_OCCUPANCY)) return Infinity;
    if([...candidate.level.rows,...candidate.level.cols].filter(value=>value===0).length>maxEmptyLines) return Infinity;
    const key=[...candidate.level.rows,...candidate.level.cols].join(',');
    let cached=clueScores.get(key);
    if(!cached) {
      const prepared=domainsWithClues(groups,candidate.level);
      const logic=reasonLevel(candidate.level,{deadline,maxAssumptions:0},prepared);
      if(logic.aborted || logic.contradiction) return Infinity;
      cached={prepared,value:logic.remaining+prepared.reduce((s,g)=>s+Math.log1p(g.domain.length-g.ids.length),0)*.1};clueScores.set(key,cached);
    }
    return cached.value+roleSwapCount(entries,cached.prepared)*100;
  };
  let current=draft,value=score(draft);
  const conflicts=(a:FacilityEntry,b:FacilityEntry)=>!compatible(a.p,b.piece.kind,b.p)
    || (providesConnections(a.piece.kind) && a.piece.kind===b.piece.kind && a.p.cells.some(c=>b.p.cells.some(q=>adjacent(c,q))));
  const domains=new Map(groups.map(g=>[templateId(g.piece),g.domain]));
  for(let step=0;step<8 && value>0 && Date.now()<deadline;step++) {
    type Change={entry:FacilityEntry;p:FacilityEntry['p']};
    let best=value,move:{changes:Change[];draft:SandboxDraft}|undefined;
    const singles:{changes:Change[];order:number}[]=[],blocked:{entry:FacilityEntry;p:FacilityEntry['p'];other:FacilityEntry;order:number}[]=[];
    for(const entry of entries) for(const p of domains.get(templateId(entry.piece))!) {
      if(p.mask===entry.p.mask) continue;
      const blockers=entries.filter(e=>e!==entry && conflicts({...entry,p},e));
      if(!blockers.length) singles.push({changes:[{entry,p}],order:random()});
      else if(blockers.length===1) blocked.push({entry,p,other:blockers[0],order:random()});
    }
    const pairs:typeof singles=[];
    for(const {entry,p,other} of blocked.sort((a,b)=>a.order-b.order).slice(0,64)) {
      const options=domains.get(templateId(other.piece))!.filter(q=>q.mask!==other.p.mask
        && !conflicts({...other,p:q},{...entry,p}) && !entries.some(e=>e!==entry && e!==other && conflicts({...other,p:q},e)));
      for(const q of options) pairs.push({changes:[{entry,p},{entry:other,p:q}],order:random()});
    }
    const candidates=[...singles.sort((a,b)=>a.order-b.order).slice(0,16),...pairs.sort((a,b)=>a.order-b.order).slice(0,16)];
    for(const candidate of candidates) {
      if(Date.now()>=deadline) break;
      const old=candidate.changes.map(c=>c.entry.p);
      for(const c of candidate.changes) c.entry.p=c.p;
      const used=entries.reduce((m,e)=>m|e.p.mask,0n),providers=entries.reduce((m,e)=>providesConnections(e.piece.kind)?m|e.p.mask:m,0n);
      if(!entries.some(e=>CAMP_REQUIREMENTS[e.piece.kind] && !e.p.connections.some(link=>(link.camp&providers) && !(link.gap&used)))) {
        const next=makeDraft(),cost=score(next);
        if(cost<best) {best=cost;move={changes:candidate.changes,draft:next};}
      }
      candidate.changes.forEach((c,i)=>{c.entry.p=old[i];});
    }
    if(!move) break;
    for(const c of move.changes) c.entry.p=c.p;
    current=move.draft;value=best;
  }
  return current;
}

// Move whole terrain units without changing any quantity. Answer footprints,
// terrain dependencies and forbidden adjacency are preserved before scoring.
export function refineTerrain(level: Level, entries: FacilityEntry[], random:()=>number, deadline:number, witnesses: readonly (readonly Placement[])[] = []): Level {
  let current=level,groups=placementDomains(current);
  const used=entries.reduce((m,e)=>m|e.p.mask,0n);
  const activeMask=Array.from({length:64},(_,i)=>i).reduce((m,i)=>level.rows[Math.floor(i/8)] && level.cols[i%8]?m|(1n<<BigInt(i)):m,0n);
  const terrainMask=level.terrain.reduce((m,p)=>m|cellBit(p),0n);
  const covered=(activeMask&~terrainMask)===used;
  const providers=entries.reduce((m,e)=>providesConnections(e.piece.kind)?m|e.p.mask:m,0n);
  const cost=(gs:typeof groups)=>gs.reduce((sum,g)=>{
    let entropy=0;for(let n=0;n<g.ids.length;n++) entropy+=Math.log((g.domain.length-n)/(g.ids.length-n));
    return sum+entropy;
  },0)+roleSwapCount(entries,gs)*30+Number(gs.reduce((n,g)=>n+(g.domain.length===g.ids.length?g.ids.length:0),0)>entries.length*.65)*100;
  const witnessEntries=witnesses.map(placements=>{
    const es=placements.map(at=>{
      const piece=level.pieces.find(p=>p.id===at.id)!;
      return {piece,p:placementGeometry(piece,8).find(p=>p.at.r===at.r && p.at.c===at.c && p.at.rotation===at.rotation)!};
    });
    return {entries:es,used:es.reduce((m,e)=>m|e.p.mask,0n),providers:es.reduce((m,e)=>providesConnections(e.piece.kind)?m|e.p.mask:m,0n)};
  });
  const witnessCost=(candidate:Level)=>{
    const terrainMask=candidate.terrain.reduce((m,p)=>m|cellBit(p),0n);
    return witnessEntries.filter(w=>!(w.used&terrainMask) && !w.entries.some(e=>{
      const need=TERRAIN_REQUIREMENTS[e.piece.kind];
      return (need && !candidate.terrain.some(t=>t.kind===need && e.p.cells.some(p=>adjacent(p,t))))
        || candidate.terrain.some(t=>terrainConflict(e.piece.kind,e.p.cells,t))
        || (CAMP_REQUIREMENTS[e.piece.kind] && !e.p.connections.some(link=>(link.camp&w.providers) && !(link.gap&(w.used|terrainMask))));
    })).length*100;
  };
  let score=cost(groups)+witnessCost(current);
  for(let step=0;step<(witnesses.length?1:2) && Date.now()<deadline;step++) {
    let best:{level:Level;groups:typeof groups;score:number}|undefined;
    const completed=()=>best && best.score<score-.001?best.level:current;
    const currentWitnessCost=witnessCost(current);
    const consider=(terrain:Terrain[])=>{
      if(terrain.some(t=>(used&cellBit(t)) || entries.some(e=>terrainConflict(e.piece.kind,e.p.cells,t)))) return;
      if(covered && (terrain.reduce((m,p)=>m|cellBit(p),0n)&activeMask)!==(terrainMask&activeMask)) return;
      const blocked=terrain.reduce((m,p)=>m|cellBit(p),used);
      if(entries.some(e=>CAMP_REQUIREMENTS[e.piece.kind] && !e.p.connections.some(link=>(link.camp&providers) && !(link.gap&blocked)))) return;
      if(entries.some(e=>{const need=TERRAIN_REQUIREMENTS[e.piece.kind];return need && !terrain.some(t=>t.kind===need && e.p.cells.some(p=>adjacent(p,t)));})) return;
      if(terrainDistribution(terrain).violations.length) return;
      const next={...current,terrain},witnessScore=witnessCost(next);
      if(witnesses.length && witnessScore>=currentWitnessCost) return;
      const domains=placementDomains(next),value=cost(domains)+witnessScore+random()*.001;
      if(value<(best?.score??Infinity)) best={level:next,groups:domains,score:value};
    };
    const units:{kind:Terrain['kind'];cells:{r:number;c:number}[];shape:string}[]=[];
    for(const def of terrainRegistry) {
      const remaining=new Set(current.terrain.filter(t=>t.kind===def.id).map(t=>t.r*8+t.c));
      for(const origin of current.terrain.filter(t=>t.kind===def.id)) {
        const unit=def.cells.map(p=>({r:p.r+origin.r,c:p.c+origin.c}));
        if(!unit.every(p=>remaining.has(p.r*8+p.c))) continue;
        for(const p of unit) remaining.delete(p.r*8+p.c);
        units.push({kind:def.id,cells:unit,shape:def.cells.map(p=>`${p.r},${p.c}`).sort().join(';')});
        const base=current.terrain.filter(t=>t.kind!==def.id || !unit.some(p=>p.r===t.r && p.c===t.c));
        for(const candidate of terrainPlacementScores(base,def.id,current.terrain.length)) {
          if(Date.now()>=deadline) return completed();
          const terrain=[...base,...candidate.cells.map(p=>({...p,kind:def.id}))];
          consider(terrain);
        }
      }
    }
    for(let i=0;i<units.length;i++) for(let j=i+1;j<units.length;j++) {
      if(Date.now()>=deadline) return completed();
      const a=units[i],b=units[j];
      if(a.kind===b.kind || a.shape!==b.shape) continue;
      consider(current.terrain.map(t=>a.cells.some(p=>p.r===t.r && p.c===t.c)?{...t,kind:b.kind}:b.cells.some(p=>p.r===t.r && p.c===t.c)?{...t,kind:a.kind}:t));
    }
    if(!best || best.score>=score-.001) break;
    current=best.level;groups=best.groups;score=best.score;
  }
  return current;
}

