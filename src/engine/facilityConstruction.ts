import { CAMP_REQUIREMENTS, providesConnections } from './placementRules';
import { boardCells, compatible } from './placementDomains';
import type { Candidate, PlacementGroup } from './placementDomains';
import type { Level, Piece } from './types';
import { templateId, MAX_GENERATED_LINE_OCCUPANCY } from './generationConfig';
import { adjacent, offsets } from './boardGeometry';
import type { BudgetItem } from './generationBudget';

export type FacilityEntry = { piece: Piece; p: Candidate };
export const ACTIVITY_LIMITS = { spareCells: 2 } as const;

export function activityDomains(level: Level, groups: PlacementGroup[], inventory: readonly BudgetItem[], area: number, random:()=>number, deadline:number, diagnostics:Record<string,number>={}, maxCount=Infinity, maxEmptyLines=16) {
  type Plan={groups:PlacementGroup[];rows:readonly number[];cols:readonly number[];score:number};
  let frontier:Plan[]=[{groups,rows:level.rows,cols:level.cols,score:Infinity}];
  const plans:Plan[]=[],seen=new Set<string>();
  for(let step=0;step<2;step++) {
    const options:Plan[]=[];
    for(const plan of frontier) for(let line=0;line<16;line++) {
      if((line<8?plan.rows[line]:plan.cols[line-8])===0) continue;
      const rows=[...plan.rows],cols=[...plan.cols];
      if(line<8) rows[line]=0;else cols[line-8]=0;
      if([...rows,...cols].filter(value=>value===0).length>maxEmptyLines) continue;
      const key=[...rows,...cols].join(',');if(seen.has(key)) continue;seen.add(key);
      const next=plan.groups.map(g=>({...g,domain:g.domain.filter(p=>!(line<8?p.rows[line]:p.cols[line-8]))}));
      if(next.some(g=>g.domain.length<(inventory.find(i=>i.id===templateId(g.piece))?.min??0))) continue;
      const union=next.reduce((m,g)=>g.domain.reduce((u,p)=>u|p.mask,m),0n);
      let cells=0,mask=union;while(mask){mask&=mask-1n;cells++;}
      if(cells<area+ACTIVITY_LIMITS.spareCells) continue;
      const score=next.reduce((s,g)=>s+Math.log(1+g.domain.length/Math.max(1,inventory.find(i=>i.id===templateId(g.piece))?.min??0)),0)+random()*.8;
      options.push({groups:next,rows,cols,score});
    }
    if(!options.length) break;
    frontier=options.sort((a,b)=>a.score-b.score).slice(0,3);
    plans.unshift(...frontier);
  }
  for(const plan of [...plans,{groups,rows:level.rows,cols:level.cols,score:Infinity}]) {
    if(Date.now()>=deadline) return;
    const next={...level,rows:plan.rows,cols:plan.cols};
    const entries=tileFacilityBudget(next,plan.groups,inventory,area,random,deadline,diagnostics,maxCount,maxEmptyLines);
    if(entries) return {groups:plan.groups,level:next,entries};
  }

}

// A legal role exchange witnesses ambiguity without running either solver.
export const hasRoleSwap = (entries: FacilityEntry[], groups: PlacementGroup[]) => roleSwapCount(entries,groups)>0;
export function repartitionCount(entries: FacilityEntry[], groups: PlacementGroup[]):number {
  const domains=new Map(groups.map(g=>[templateId(g.piece),g.domain]));
  const masks=new Map(groups.map(g=>[templateId(g.piece),new Set(g.domain.map(p=>p.mask))]));
  let count=0;
  for(let i=0;i<entries.length;i++) for(let j=i+1;j<entries.length;j++) {
    const a=entries[i],b=entries[j];
    if(a.piece.kind!==b.piece.kind || CAMP_REQUIREMENTS[a.piece.kind] || (a.p.cells.length===1 && b.p.cells.length===1)) continue;
    const union=a.p.mask|b.p.mask;
    if(domains.get(templateId(a.piece))!.some(p=>p.mask!==a.p.mask && !(templateId(a.piece)===templateId(b.piece) && p.mask===b.p.mask) && (p.mask&union)===p.mask && masks.get(templateId(b.piece))!.has(union^p.mask))) count++;
  }
  return count;
}
export function roleSwapCount(entries: FacilityEntry[], groups: PlacementGroup[]): number {
  const domains = new Map(groups.map(g => [templateId(g.piece), new Map(g.domain.map(p => [p.mask,p]))]));
  const current = entries.map(e => ({ ...e, p: domains.get(templateId(e.piece))!.get(e.p.mask)! }));
  const used = current.reduce((m,e) => m | e.p.mask,0n);
  let swaps=0;
  for (let i = 0; i < current.length; i++) for (let j = i+1; j < current.length; j++) {
    const a=current[i],b=current[j];
    if(a.piece.kind===b.piece.kind || a.piece.shape!==b.piece.shape) continue;
    const pa=domains.get(templateId(a.piece))!.get(b.p.mask),pb=domains.get(templateId(b.piece))!.get(a.p.mask);
    if(!pa || !pb || !compatible(pa,b.piece.kind,pb)) continue;
    if(current.some((e,k)=>k!==i && k!==j && (!compatible(pa,e.piece.kind,e.p) || !compatible(pb,e.piece.kind,e.p)))) continue;
    const providers=current.reduce((m,e,k)=>providesConnections(e.piece.kind)?m|(k===i?pa:k===j?pb:e.p).mask:m,0n);
    if(current.some((e,k)=>{
      const p=k===i?pa:k===j?pb:e.p;
      return CAMP_REQUIREMENTS[e.piece.kind] && !p.connections.some(link=>(link.camp&providers) && !(link.gap&used));
    })) continue;
    swaps++;
  }
  return swaps;
}

// Fixed inventories use the same search as range-driven generation.
export function tileFacilities(level: Level, groups: PlacementGroup[], inventory: Readonly<Record<string, number>>, random: () => number, deadline = Infinity) {
  const items=groups.map(g=>({id:templateId(g.piece),area:offsets(g.piece.shape,0).length,min:inventory[templateId(g.piece)]??0,max:inventory[templateId(g.piece)]??0}));
  return tileFacilityBudget(level,groups,items,items.reduce((n,i)=>n+i.area*i.min,0),random,deadline);
}

// Choose counts and positions together under one exact area budget. Every step
// reserves all outstanding minima and checks residual integer reachability.
export function tileFacilityBudget(level:Level,groups:PlacementGroup[],items:readonly BudgetItem[],targetArea:number,random:()=>number,deadline=Infinity,diagnostics:Record<string,number>={},maxCount=Infinity,maxEmptyLines=16):FacilityEntry[]|undefined {
  const count=(name:string)=>{diagnostics[name]=(diagnostics[name]??0)+1;};
  count('searches');
  const entries:FacilityEntry[]=[],counts=groups.map(()=>0),rows=Array<number>(8).fill(0),cols=Array<number>(8).fill(0);
  const limits=groups.map(g=>items.find(i=>i.id===templateId(g.piece))!);
  const space=boardCells(8).filter(p=>level.rows[p.r]>0 && level.cols[p.c]>0 && !level.terrain.some(t=>t.r===p.r && t.c===p.c)).map(p=>({...p,bit:1n<<BigInt(p.r*8+p.c)}));
  const capacity=space.length;
  const nodeLimit=240;
  if(targetArea>Math.min(64-level.terrain.length-8,capacity===targetArea?capacity:capacity-ACTIVITY_LIMITS.spareCells) || limits.some((i,g)=>i.min>groups[g].domain.length)) {count('initial capacity');return;}
  const possible=groups.reduce((m,g)=>g.domain.reduce((u,p)=>u|p.mask,m),0n);
  const support=space.filter(c=>!!(possible&c.bit));
  if([true,false].some(horizontal=>Array.from({length:8},(_,i)=>Math.min((horizontal?level.rows:level.cols)[i],support.filter(c=>(horizontal?c.r:c.c)===i).length)).reduce((a,b)=>a+b,0)<targetArea)
    || 16-new Set(support.map(c=>c.r)).size-new Set(support.map(c=>c.c)).size>maxEmptyLines) {count('initial line capacity');return;}
  const reachability=new Map<string,boolean>();
  const canFinish=(remaining:number)=>{
    const key=counts.join(',');
    const cached=reachability.get(key);if(cached!==undefined) return cached;
    let reachable=new Map([[0,0]]);
    const available=maxCount-counts.reduce((s,c)=>s+c,0);
    for(let g=0;g<groups.length;g++) {
      const next=new Map<number,number>(),item=limits[g];
      for(let n=Math.max(0,item.min-counts[g]);n<=item.max-counts[g] && n*item.area<=remaining;n++) for(const [sum,count] of reachable)
        if(sum+n*item.area<=remaining && count+n<=available) next.set(sum+n*item.area,Math.min(next.get(sum+n*item.area)??Infinity,count+n));
      reachable=next;
    }
    const result=reachable.has(remaining);reachability.set(key,result);return result;
  };
  const masks=groups.map(g=>new Set(g.domain.map(p=>p.mask)));
  let nodes=0;
  function search(used:bigint,providers:bigint,remaining:number,domains:Candidate[][]):boolean {
    count('nodes');
    if(++nodes>nodeLimit || (nodes%16===0 && Date.now()>=deadline)) {count('search cutoff');return false;}
    if([...rows,...cols].filter(value=>value===0).length-remaining*2>maxEmptyLines) {count('empty lines');return false;}
    if(!remaining) {
      if(!limits.every((i,g)=>counts[g]>=i.min) || entries.some(e=>CAMP_REQUIREMENTS[e.piece.kind] && !e.p.connections.some(link=>(link.camp&providers) && !(link.gap&used)))) return false;
      if(hasRoleSwap(entries,groups) || repartitionCount(entries,groups)) {count('completion ambiguity');return false;}
      return true;
    }
    if(!canFinish(remaining)) {count('quantity infeasible');return false;}
    const potential=domains.reduce((m,domain,g)=>counts[g]<limits[g].max && providesConnections(groups[g].piece.kind)?domain.reduce((mask,p)=>mask|p.mask,m):m,providers);
    if(entries.some(e=>CAMP_REQUIREMENTS[e.piece.kind] && !e.p.connections.some(link=>(link.camp&potential) && !(link.gap&used)))) {count('connection infeasible');return false;}
    if(domains.some((domain,g)=>domain.length<Math.max(0,limits[g].min-counts[g]))) {count('domain infeasible');return false;}
    const pop=(mask:bigint)=>{let n=0;while(mask){mask&=mask-1n;n++;}return n;};
    let available=0n;
    for(let g=0;g<groups.length;g++) {
      if(counts[g]>=limits[g].max) continue;
      const union=domains[g].reduce((m,p)=>m|p.mask,0n);
      if(pop(union)<Math.max(0,limits[g].min-counts[g])*limits[g].area) {count('required space infeasible');return false;}
      available|=union;
    }
    if(pop(available)<remaining) {count('remaining space infeasible');return false;}
    const moves:{g:number;valid:Candidate[];weight:number}[]=[];
    for(let g=0;g<groups.length;g++) {
      const item=limits[g],piece=groups[g].piece;
      if(counts[g]>=item.max || item.area>remaining) continue;
      counts[g]++;const feasible=canFinish(remaining-item.area);counts[g]--;
      if(!feasible) continue;
      const valid=domains[g].filter(p=>!CAMP_REQUIREMENTS[piece.kind] || p.connections.some(link=>(link.camp&potential) && !(link.gap&(used|p.mask))));
      if(!valid.length) continue;
      const need=counts[g]<item.min;
      moves.push({g,valid,weight:(need?100:1)*item.area*item.area*(1+Math.max(0,item.min-counts[g]))/(Math.sqrt(valid.length))*(1+random()*.3)});
    }
    const coverage=Array<number>(64).fill(0);
    for(const move of moves) for(const p of move.valid) for(const c of p.cells) coverage[c.r*8+c.c]++;
    if(capacity===targetArea) {
      const required=space.filter(c=>!(used&c.bit));
      const pivot=required.sort((a,b)=>coverage[a.r*8+a.c]-coverage[b.r*8+b.c])[0];
      if(pivot) {
        const bit=pivot.bit;
        for(const move of moves) move.valid=move.valid.filter(p=>!!(p.mask&bit));
      }
    }
    while(moves.length && nodes<=nodeLimit && Date.now()<deadline) {
      moves.sort((a,b)=>b.weight-a.weight);
      const move=moves.shift()!;
      const piece=groups[move.g].piece;
      const ranked=move.valid.map(p=>({p,score:
        (p.rows.reduce((n,v,i)=>n+v*rows[i],0)+p.cols.reduce((n,v,i)=>n+v*cols[i],0)+p.cells.reduce((n,c)=>n+8/coverage[c.r*8+c.c],0))/p.cells.length
        +(maxEmptyLines>1 && maxEmptyLines<16?(p.rows.filter((v,i)=>v>0 && rows[i]===0).length+p.cols.filter((v,i)=>v>0 && cols[i]===0).length)*4:0)
        -groups.reduce((n,g,i)=>n+Number(g.piece.kind!==piece.kind && g.piece.shape===piece.shape && masks[i].has(p.mask)),0)+random()*4
        -entries.reduce((n,e)=>n+Number(e.piece.kind===piece.kind && p.cells.some(c=>e.p.cells.some(q=>adjacent(c,q))))*8,0)
        -(capacity===targetArea?groups.reduce((n,_,g)=>n+Math.max(0,limits[g].min-counts[g]-Number(g===move.g))*limits[g].area**2
          *domains[g].filter(q=>!compatible(q,piece.kind,p)).length/Math.max(1,domains[g].length),0)*10:0)
      })).sort((a,b)=>b.score-a.score);
      for(const {p} of capacity===targetArea?ranked:ranked.slice(0,5)) {
        const repartition=!CAMP_REQUIREMENTS[piece.kind] && entries.some(e=>{
          if(e.piece.kind!==piece.kind || (p.cells.length===1 && e.p.cells.length===1)) return false;
          const union=p.mask|e.p.mask,other=masks[groups.findIndex(g=>templateId(g.piece)===templateId(e.piece))];
          return groups[move.g].domain.some(q=>q.mask!==p.mask && !(templateId(piece)===templateId(e.piece) && q.mask===e.p.mask) && (q.mask&union)===q.mask && other.has(union^q.mask));
        });
        if(repartition) continue;
        entries.push({piece:{...piece,id:`wild-${entries.length}`},p});counts[move.g]++;
        for(let j=0;j<8;j++){rows[j]+=p.rows[j];cols[j]+=p.cols[j];}
        const next=domains.map((domain,g)=>counts[g]<limits[g].max?domain.filter(q=>compatible(q,piece.kind,p) && !q.rows.some((v,r)=>rows[r]+v>level.rows[r]) && !q.cols.some((v,c)=>cols[c]+v>level.cols[c])):[]);
        if(search(used|p.mask,providesConnections(piece.kind)?providers|p.mask:providers,remaining-limits[move.g].area,next)) return true;
        for(let j=0;j<8;j++){rows[j]-=p.rows[j];cols[j]-=p.cols[j];}
        counts[move.g]--;entries.pop();
        if(nodes>nodeLimit || Date.now()>=deadline) return false;
      }
    }
    return false;
  }
  const found=search(0n,0n,targetArea,groups.map(g=>g.domain));
  count(found?'completed':nodes>nodeLimit?'node limit':Date.now()>=deadline?'deadline':'exhausted');
  return found?entries:undefined;
}

// Coordinate descent changes positions, never the inventory or terrain budget.
// Rank clue-domain entropy cheaply; only completed candidates reach the solvers.
export function refineFacilities(entries: FacilityEntry[], groups: PlacementGroup[], random: () => number, deadline: number, maxEmptyLines=16) {
  const inventory = groups.map(g=>entries.filter(e=>templateId(e.piece)===templateId(g.piece)).length);
  const lines = () => {
    const rows=Array<number>(8).fill(0),cols=Array<number>(8).fill(0);
    for(const e of entries) for(let i=0;i<8;i++) {rows[i]+=e.p.rows[i];cols[i]+=e.p.cols[i];}
    return {rows,cols};
  };
  function cost() {
    const {rows,cols}=lines();
    if([...rows,...cols].some(value=>value>MAX_GENERATED_LINE_OCCUPANCY)) return Infinity;
    if([...rows,...cols].filter(value=>value===0).length>maxEmptyLines) return Infinity;
    let forced=0;
    const entropy=groups.reduce((score,g,i)=>{
      const count=g.domain.filter(p=>!p.rows.some((v,r)=>v>rows[r]) && !p.cols.some((v,c)=>v>cols[c])).length;
      if(count===inventory[i]) forced+=inventory[i];
      let entropy=0;for(let n=0;n<inventory[i];n++) entropy+=Math.log((count-n)/(inventory[i]-n));
      return score+entropy;
    },0);
    return entropy+(roleSwapCount(entries,groups)+repartitionCount(entries,groups))*30+Number(forced>entries.length*.65)*100
      +entries.reduce((n,e,i)=>n+entries.slice(0,i).filter(other=>other.piece.kind===e.piece.kind && e.p.cells.some(c=>other.p.cells.some(q=>adjacent(c,q)))).length*8,0);
  }
  let current=cost();
  for(let step=0;step<6 && Date.now()<deadline;step++) {
    let best=current,move:{entry:FacilityEntry;p:Candidate}|undefined;
    const candidates=entries.flatMap(entry=>{
      const group=groups.find(g=>templateId(g.piece)===templateId(entry.piece))!;
      return group.domain.filter(p=>p.mask!==entry.p.mask && !entries.some(e=>e!==entry && (!compatible(p,e.piece.kind,e.p) || (providesConnections(entry.piece.kind) && e.piece.kind===entry.piece.kind && p.cells.some(c=>e.p.cells.some(q=>adjacent(c,q))))))).map(p=>({entry,p,order:random()}));
    }).sort((a,b)=>a.order-b.order).slice(0,80);
    for(const candidate of candidates) {
      if(Date.now()>=deadline) break;
      const old=candidate.entry.p;candidate.entry.p=candidate.p;
      const used=entries.reduce((m,e)=>m|e.p.mask,0n),providers=entries.reduce((m,e)=>providesConnections(e.piece.kind)?m|e.p.mask:m,0n);
      if(!entries.some(e=>CAMP_REQUIREMENTS[e.piece.kind] && !e.p.connections.some(link=>(link.camp&providers) && !(link.gap&used)))) {
        const next=cost();if(next<best-.001) {best=next;move=candidate;}
      }
      candidate.entry.p=old;
    }
    if(!move) break;
    move.entry.p=move.p;current=best;
  }
}
