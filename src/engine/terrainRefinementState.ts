import { adjacent } from './boardGeometry';
import { boardCells, cellBit, placementGeometry } from './placementDomains';
import type { Candidate, PlacementGroup, Position } from './placementDomains';
import { CAMP_REQUIREMENTS, providesConnections, TERRAIN_REQUIREMENTS, terrainConflict } from './placementRules';
import { terrainRegistry } from './terrainRegistry';
import type { FacilityEntry } from './facilityConstruction';
import type { FacilityKind, Level, Terrain } from './types';

type TerrainMasks = Record<Terrain['kind'],bigint>;
const emptyMasks=():TerrainMasks=>({water:0n,forest:0n,mountain:0n});
export function terrainMasks(terrain:readonly Terrain[]):TerrainMasks {
  const masks=emptyMasks();
  for(const t of terrain) masks[t.kind]|=cellBit(t);
  return masks;
}
const allTerrain=(masks:TerrainMasks)=>masks.water|masks.forest|masks.mountain;

// Immutable rule geometry, shared across seeds. Unlike legal domains this
// includes positions that a terrain removal may make legal again.
const geometryCache=new WeakMap<Position[],ReturnType<typeof prepareGeometry>>();
function prepareGeometry(positions:Position[],kind:FacilityKind) {
  const board=boardCells(8),bits=board.map(p=>cellBit(p)),need=TERRAIN_REQUIREMENTS[kind];
  const influences=positions.map(p=>{
    const forbidden=emptyMasks();
    let required=0n,gaps=0n;
    for(let i=0;i<board.length;i++) {
      if(need && p.cells.some(c=>adjacent(c,board[i]))) required|=bits[i];
      for(const def of terrainRegistry) if((p.mask&bits[i]) || terrainConflict(kind,p.cells,{...board[i],kind:def.id})) forbidden[def.id]|=bits[i];
    }
    for(const link of p.connections) gaps|=link.gap;
    return {forbidden,required,gaps};
  });
  const affected=terrainRegistry.map(def=>({kind:def.id,cells:bits.map(bit=>influences.flatMap((m,i)=>
    ((m.forbidden[def.id]|(need===def.id?m.required:0n)|m.gaps)&bit)?[i]:[]))}));
  return {positions,influences,affected,need};
}
function geometry(kind:FacilityKind,positions:Position[]) {
  let cached=geometryCache.get(positions);
  if(!cached) {cached=prepareGeometry(positions,kind);geometryCache.set(positions,cached);}
  return cached;
}

// Clues and inventory stay fixed during terrain refinement. Only positions
// touched by changed terrain cells are reconsidered; published arrays remain
// immutable so a previously ranked candidate cannot be changed by a later move.
export function incrementalTerrainDomains(level:Level) {
  let masks=terrainMasks(level.terrain);
  const groups:PlacementGroup[]=[];
  for(const piece of level.pieces) {
    const group=groups.find(g=>g.piece.kind===piece.kind && g.piece.shape===piece.shape);
    if(group) group.ids.push(piece.id);else groups.push({piece,ids:[piece.id],domain:[]});
  }
  const states=groups.map(group=>{
    const data=geometry(group.piece.kind,placementGeometry(group.piece,8));
    const allowed=data.positions.map(p=>!p.rows.some((v,i)=>v>level.rows[i]) && !p.cols.some((v,i)=>v>level.cols[i]));
    const slots:(Candidate|undefined)[]=data.positions.map(()=>undefined);
    const update=(i:number,blocked:bigint)=>{
      if(!allowed[i]) return;
      const p=data.positions[i],m=data.influences[i];
      const valid=(!data.need || !!(m.required&masks[data.need])) && !terrainRegistry.some(d=>!!(m.forbidden[d.id]&masks[d.id]));
      slots[i]=valid?{...p,at:{...p.at,id:group.piece.id},connections:p.connections.filter(link=>!(link.gap&blocked))}:undefined;
    };
    for(let i=0;i<slots.length;i++) update(i,allTerrain(masks));
    group.domain=slots.filter((p):p is Candidate=>!!p);
    return {data,slots,update,seen:new Uint32Array(slots.length)};
  });
  let current=groups,version=0;
  return {get groups(){return current;},update(terrain:readonly Terrain[]) {
    const next=terrainMasks(terrain),changes=terrainRegistry.map(d=>({kind:d.id,mask:masks[d.id]^next[d.id]}));
    masks=next;version++;
    const blocked=allTerrain(masks);
    current=current.map((group,g)=>{
      const state=states[g];let touched=false;
      for(let k=0;k<changes.length;k++) {
        const change=changes[k];
        if(!change.mask) continue;
        for(let c=0;c<64;c++) if(change.mask&(1n<<BigInt(c))) for(const i of state.data.affected[k].cells[c]) {
          if(state.seen[i]===version) continue;
          state.seen[i]=version;state.update(i,blocked);touched=true;
        }
      }
      return touched?{...group,domain:state.slots.filter((p):p is Candidate=>!!p)}:group;
    });
    return current;
  }};
}

// For a fixed answer or counterexample, all facility-to-facility constraints
// are invariant. Terrain can affect only these masks, dependencies and gaps.
export function terrainSolutionCheck(entries:readonly FacilityEntry[]) {
  const used=entries.reduce((m,e)=>m|e.p.mask,0n);
  const providers=entries.reduce((m,e)=>providesConnections(e.piece.kind)?m|e.p.mask:m,0n);
  const forbidden=emptyMasks(),required:{kind:Terrain['kind'];mask:bigint}[]=[],gaps:bigint[][]=[];
  for(const entry of entries) {
    const data=geometry(entry.piece.kind,placementGeometry(entry.piece,8));
    const i=data.positions.findIndex(p=>p.mask===entry.p.mask),p=data.positions[i],m=data.influences[i];
    for(const def of terrainRegistry) forbidden[def.id]|=m.forbidden[def.id];
    if(data.need) required.push({kind:data.need,mask:m.required});
    if(CAMP_REQUIREMENTS[entry.piece.kind]) gaps.push(p.connections.filter(link=>(link.camp&providers) && !(link.gap&used)).map(link=>link.gap));
  }
  return (masks:TerrainMasks)=>!terrainRegistry.some(d=>!!(forbidden[d.id]&masks[d.id]))
    && required.every(r=>!!(r.mask&masks[r.kind]))
    && gaps.every(links=>links.some(gap=>!(gap&allTerrain(masks))));
}
