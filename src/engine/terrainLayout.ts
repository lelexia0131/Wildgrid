import { adjacent } from './boardGeometry';
import { terrainRegistry, terrainLayout } from './terrainRegistry';
import type { TerrainDefinition } from './terrainRegistry';
import type { Cell } from './types';

type FixedTerrain = Cell & { readonly kind: string };
const board = Array.from({length:64},(_,i)=>({r:Math.floor(i/8),c:i%8}));
const windows = [3,4].map(size => Array.from({length:(9-size)**2},(_,i) => {
  const r=Math.floor(i/(9-size)),c=i%(9-size);
  return Array.from({length:size*size},(_,j)=>(r+Math.floor(j/size))*8+c+j%size);
}));
const memberships = board.map((_,i)=>windows.map(group=>group.flatMap((cells,j)=>cells.includes(i)?[j]:[])));
const quadrant = (p: Cell) => (p.r>=4?2:0)+(p.c>=4?1:0);

export function terrainRegions(terrain: readonly FixedTerrain[], definitions: readonly TerrainDefinition<string>[] = terrainRegistry) {
  return definitions.map(def => {
    const cells=terrain.filter(t=>t.kind===def.id), remaining=new Set(cells.map(t=>t.r*8+t.c));
    const sizes:number[]=[], compactness:number[]=[];
    while(remaining.size) {
      const queue=[remaining.values().next().value!]; remaining.delete(queue[0]);
      for(let i=0;i<queue.length;i++) for(const other of cells) if(remaining.has(other.r*8+other.c) && adjacent(board[queue[i]],other,def.diagonal)) {
        remaining.delete(other.r*8+other.c);queue.push(other.r*8+other.c);
      }
      sizes.push(queue.length);
      const rows=queue.map(i=>board[i].r),cols=queue.map(i=>board[i].c);
      compactness.push(queue.length/((Math.max(...rows)-Math.min(...rows)+1)*(Math.max(...cols)-Math.min(...cols)+1)));
    }
    const height=Math.max(...cells.map(p=>p.r))-Math.min(...cells.map(p=>p.r))+1;
    const width=Math.max(...cells.map(p=>p.c))-Math.min(...cells.map(p=>p.c))+1;
    const branches=cells.filter(p=>cells.filter(q=>adjacent(p,q,def.diagonal)).length>2).length;
    const bends=cells.filter(p=>{const near=cells.filter(q=>adjacent(p,q));return near.length===2 && near[0].r!==near[1].r && near[0].c!==near[1].c;}).length;
    return {kind:def.id,compactness:cells.length?cells.length/(height*width):0,patchCompactness:compactness.length?compactness.reduce((s,n)=>s+n,0)/compactness.length:0,
      branches,bends,count:cells.length,components:sizes.length,largest:Math.max(0,...sizes),singletons:sizes.filter(n=>n===1).length};
  });
}

export function terrainDistribution(terrain: readonly FixedTerrain[], regions=terrainRegions(terrain), definitions: readonly TerrainDefinition<string>[] = terrainRegistry) {
  const used=new Set(terrain.map(t=>t.r*8+t.c)),quadrants=[0,0,0,0],halves=[0,0,0,0];
  for(const t of terrain) {quadrants[quadrant(t)]++;halves[t.r<4?0:1]++;halves[t.c<4?2:3]++;}
  const counts=windows.map(group=>group.map(cells=>cells.reduce((n,c)=>n+Number(used.has(c)),0)));
  const violations:string[]=[];
  if(terrain.some(t=>!definitions.some(d=>d.id===t.kind))) violations.push('unknown terrain');
  if(regions.some(r=>r.largest>(definitions.find(d=>d.id===r.kind)?.componentMax??0))) violations.push('terrain component or kind count');
  if(Math.max(...counts[0])>terrainLayout.window3 || Math.max(...counts[1])>terrainLayout.window4) violations.push('terrain local density');
  if(terrain.length>=4 && (Math.max(...quadrants)>Math.max(2,Math.floor(terrain.length*terrainLayout.quadrantShare)) || Math.max(...halves)>Math.ceil(terrain.length*terrainLayout.halfShare))) violations.push('terrain distribution');
  return {quadrants,halves,max3:Math.max(...counts[0]),max4:Math.max(...counts[1]),
    imbalance:(Math.max(...quadrants)-Math.min(...quadrants))/Math.max(1,terrain.length),
    halfImbalance:(Math.abs(halves[0]-halves[1])+Math.abs(halves[2]-halves[3]))/Math.max(1,terrain.length*2),violations};
}

// Counts and existing connected components are built once. A candidate updates
// only windows containing its cells, and unions touching component labels.
export function terrainPlacementScores(terrain: readonly FixedTerrain[], kind: string, budget: number, definitions: readonly TerrainDefinition<string>[] = terrainRegistry) {
  const def=definitions.find(d=>d.id===kind);
  if(!def) throw new Error(`Unknown terrain layout: ${kind}`);
  if(terrain.length+def.cells.length>budget) return [];
  const grid=new Map(terrain.map(t=>[t.r*8+t.c,t.kind]));
  const quadrants=[0,0,0,0],halves=[0,0,0,0];
  for(const t of terrain) {quadrants[quadrant(t)]++;halves[t.r<4?0:1]++;halves[t.c<4?2:3]++;}
  const counts=windows.map(group=>group.map(cells=>cells.reduce((n,c)=>n+Number(grid.has(c)),0)));
  const labels=new Map<number,number>(),sizes:number[]=[];
  for(const t of terrain.filter(t=>t.kind===kind)) {
    const index=t.r*8+t.c;if(labels.has(index)) continue;
    const label=sizes.length,queue=[index];labels.set(index,label);
    for(let i=0;i<queue.length;i++) for(const other of terrain) if(other.kind===kind && !labels.has(other.r*8+other.c) && adjacent(board[queue[i]],other,def.diagonal)) {
      labels.set(other.r*8+other.c,label);queue.push(other.r*8+other.c);
    }
    sizes.push(queue.length);
  }
  return board.flatMap(cell=>{
    const cells=def.cells.map(p=>({r:cell.r+p.r,c:cell.c+p.c}));
    if(cells.some(p=>p.r<0 || p.c<0 || p.r>=8 || p.c>=8 || grid.has(p.r*8+p.c))) return [];
    const q=[...quadrants],h=[...halves],updates=[new Map<number,number>(),new Map<number,number>()];
    const joined=new Set<number>();
    for(const p of cells) {
      q[quadrant(p)]++;h[p.r<4?0:1]++;h[p.c<4?2:3]++;
      memberships[p.r*8+p.c].forEach((indices,w)=>indices.forEach(i=>updates[w].set(i,(updates[w].get(i)??0)+1)));
      for(const [index,label] of labels) if(adjacent(p,board[index],def.diagonal)) joined.add(label);
    }
    const component=cells.length+[...joined].reduce((n,i)=>n+sizes[i],0);
    if(component>def.componentMax || Math.max(...q)>Math.max(2,Math.floor(budget*terrainLayout.quadrantShare)) || Math.max(...h)>Math.ceil(budget*terrainLayout.halfShare)) return [];
    if(updates.some((group,w)=>[...group].some(([i,n])=>counts[w][i]+n>(w===0?terrainLayout.window3:terrainLayout.window4)))) return [];
    const density=Math.max(0,...[...updates[0].keys()].map(i=>counts[0][i]));
    const score=-density*.3-q[quadrant(cell)]*.2-(h[cell.r<4?0:1]+h[cell.c<4?2:3])*.03-Math.max(0,component-2)*.5;
    return [{cell,cells,component,score}];
  });
}

export function layoutTerrain<K extends string>(random:()=>number, counts:Readonly<Record<string,number>>, definitions:readonly TerrainDefinition<K>[], budget:number, activity?:{cells:ReadonlySet<number>;terrainArea:number}) {
  const terrain:(Cell & {kind:K})[]=[],remaining=new Map(definitions.map(d=>[d.id,counts[d.id]??0]));
  const clustering=random()*.8-.3, jitter=1.2+random()*1.2;
  while([...remaining.values()].some(n=>n>0)) {
    const pending=definitions.filter(d=>remaining.get(d.id)!>0);
    const def=pending[Math.floor(random()*pending.length)];
    const active=activity?terrain.filter(p=>activity.cells.has(p.r*8+p.c)).length:0;
    const candidates=terrainPlacementScores(terrain,def.id,budget,definitions).filter(p=>{
      if(!activity) return true;
      const next=active+p.cells.filter(c=>activity.cells.has(c.r*8+c.c)).length;
      return next<=activity.terrainArea && terrain.length+p.cells.length-next<=budget-activity.terrainArea;
    }).map(p=>({...p,score:p.score+(p.component>def.cells.length?def.clusterBias+clustering:0)+random()*jitter})).sort((a,b)=>b.score-a.score);
    if(!candidates.length) return;
    terrain.push(...candidates[0].cells.map(p=>({...p,kind:def.id})));remaining.set(def.id,remaining.get(def.id)!-1);
  }
  return (activity && terrain.filter(p=>activity.cells.has(p.r*8+p.c)).length!==activity.terrainArea) || terrainDistribution(terrain,terrainRegions(terrain,definitions),definitions).violations.length?undefined:terrain;
}
