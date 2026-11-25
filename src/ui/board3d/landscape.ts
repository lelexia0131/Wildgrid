import { offsets } from '../../engine';
import { countryside, smooth } from './countryside';
import { campFootpath } from './footpath';
import type { BoardLayer, Cell, Level, Piece, Placement, Status } from '../../engine';

export interface BoardView {
  level:Level; layer:BoardLayer; placements:readonly Placement[];
  selected?:Piece|null; rotation?:number; hover:Cell|null; blocked:boolean; hint?:Placement; finished?:boolean;
  obstructed?:boolean;ruleHints?:Readonly<Record<string,Status>>;issues?:Readonly<Record<string,{status:Status}>>;hintRegion?:readonly Cell[];
}
export interface ModelInstance { model: string; x: number; z: number; y?: number; angle?: number; scale?: number; heightScale?:number }
export type Quality = 'low' | 'medium' | 'high';
export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
export function noise(seed: number, r: number, c: number, salt = 0) {
  let h = Math.imul(seed ^ salt, 1597334677) ^ Math.imul(r + 31, 381201581) ^ Math.imul(c + 1, 95868907);
  h = Math.imul(h ^ h >>> 16, 2246822519);
  return ((h ^ h >>> 13) >>> 0) / 4294967296;
}
export function facilityInstance(piece: Piece, at: Pick<Placement, 'r' | 'c' | 'rotation'>): ModelInstance {
  const cells = offsets(piece.shape, at.rotation);
  return { model: piece.kind + '_' + piece.shape, angle: -at.rotation * Math.PI / 2,
    x: at.c + (1 + Math.max(...cells.map(p => p.c))) / 2, z: at.r + (1 + Math.max(...cells.map(p => p.r))) / 2 };
}
export function detailAt(obj:ModelInstance,model:string,x:number,y:number,z:number):ModelInstance {
  const a=obj.angle??0, scale=obj.scale??1;
  return {...obj,model,x:obj.x+(x*Math.cos(a)+z*Math.sin(a))*scale,y:(obj.y??.012)+y*scale,z:obj.z+(z*Math.cos(a)-x*Math.sin(a))*scale};
}
export function facilityParts(obj:ModelInstance):ModelInstance[] {
  if(obj.model==='pool_single')return [obj,{...obj,model:'pool_surface'}];
  if(obj.model==='fire_single')return [obj,{...obj,model:'flame'}];
  if(obj.model==='airship_domino')return [obj,detailAt(obj,'propeller',-.447,.18,0)];
  if(obj.model==='tower_single')return [obj,detailAt(obj,'pennant',.20,1.303,0)];
  return [obj];
}

// A union of rounded basins and connecting channels. Both banks sample this same field,
// including where a lake crosses a cell boundary or reaches the edge of the board.
export function landscape(level: Level, layer: BoardLayer, quality: Quality, surround=false) {
  const size = level.size, sky = layer === 'sky';
  const terrain = new Map(level.terrain.map(t => [t.r * size + t.c, t.kind]));
  const kind = (r: number, c: number) => !sky && r >= 0 && c >= 0 && r < size && c < size ? terrain.get(r * size + c) : undefined;
  const seed = level.id ^ size * 179;
  const rand = (r: number, c: number, salt: number) => noise(seed, r, c, salt);
  const basins: { x: number; z: number; w: number; d: number; radius: number }[] = [];
  const country=countryside(level,seed);
  const objects: ModelInstance[] = [];
  const add = (model: string, x: number, z: number, angle = 0, scale = 1, y = .012) => objects.push({ model, x, z, angle, scale, y });
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    const type = kind(r, c), x = c + .5, z = r + .5;
    const angle = rand(r,c,3) * Math.PI * 2;
    if (type === 'water') {
      basins.push({ x, z, w: .42 + .043 * rand(r,c,4), d: .42 + .043 * rand(r,c,5), radius: .20 + .12 * rand(r,c,6) });
      if (kind(r,c+1) === type) basins.push({ x:x+.5, z, w:.43, d:.425, radius:.11 });
      if (kind(r+1,c) === type) basins.push({ x, z:z+.5, w:.425, d:.43, radius:.11 });
      if(kind(r,c+1)===type&&kind(r+1,c)===type&&kind(r+1,c+1)===type)
        basins.push({x:x+.5,z:z+.5,w:.28,d:.28,radius:.16});
      if (quality !== 'low') {
        const side = [[0,1],[1,0],[0,-1],[-1,0]].filter(([dx,dz]) => kind(r+dz,c+dx) !== type);
        if (side.length) {
          const [dx,dz] = side[Math.floor(rand(r,c,7)*side.length)];
          add('reeds', x+dx*.41, z+dz*.41, angle, .64, -.045);
          add('pebble_'+(c+r)%4, x+dx*.42+dz*.16, z+dz*.42+dx*.16, angle,.60,-.028);
        }
      }
    } else if (type) {
      const east = Number(kind(r,c+1) === type) - Number(kind(r,c-1) === type);
      const south = Number(kind(r+1,c) === type) - Number(kind(r-1,c) === type);
      const linked = east !== 0 || south !== 0;
      const along = linked ? Math.atan2(east,south) : angle;
      const variant = type === 'rock' && linked ? (east?0:1) : Math.floor(rand(r,c,8)*(type==='rock'?6:4));
      add(type+'_'+variant,x+east*.06,z+south*.06,along,(type==='rock'?.97:.88)+.13*rand(r,c,9));
      if (linked && type==='rock') add('pebble_2',x+east*.43,z+south*.43,angle,1.85);
      if(type==='rock'){
        const a=angle+1.1;
        add('rock_'+(variant+2)%6,x+.28*Math.sin(a),z+.28*Math.cos(a),-a,.43);
        add('meadow_1',x-.27,z+.24,a,.90);
      }
      if (type==='rock' && [[0,1],[1,0],[0,-1],[-1,0]].some(([dx,dz])=>kind(r+dz,c+dx)==='forest'))
        add('meadow_0',x+.27,z+.24,angle,1.1);
    } else if (!sky && quality !== 'low' && rand(r,c,10) < (quality==='high'?.92:.65)) {
      add('meadow_'+(rand(r,c,11)>.80?1:0),x-.33+rand(r,c,12)*.16,z+.28,angle,.59);
      if(quality==='high')add('meadow_0',x+.30,z-.35+rand(r,c,10)*.14,angle+.8,.39);
    }
  }
  for (const cell of (sky ? level.sky?.clouds : level.sky?.anchors) || [])
    add(sky?'cloud_'+Math.floor(rand(cell.r,cell.c,23)*2):'anchor',cell.c+.5,cell.r+.5,rand(cell.r,cell.c,24)*4);
  // The narrow outer verge has no grid or hit targets. Its flora follows the nearest edge cell.
  for(let side=0;side<4&&!(sky&&surround);side++)for(let i=0;i<size;i++){
    const c=[i,size-1,i,0][side],r=[0,i,size-1,i][side], dx=[0,1,0,-1][side],dz=[-1,0,1,0][side];
    const x=c+.5+dx*.73, z=r+.5+dz*.73, v=rand(r,c,40+side), type=kind(r,c);
    const model=sky?'cloud_0':type==='forest'?'forest_'+Math.floor(v*4):type==='rock'?'meadow_0':type==='water'?'reeds':v>.57?'meadow_1':'pebble_1';
    if(quality!=='low'||i%2===0) add(model,x,z,v*6.28,sky?.34:type==='forest'?.42:type==='rock'?.43:.64+v*.42,-.012);
    if(!sky && quality!=='low'){
      add('meadow_'+(i%3?1:2),x+dz*.26,z+dx*.26,v*4,.87);
      add('pebble_'+(i+side)%4,x+dx*.12+dz*.15,z+dz*.12+dx*.15,v*7,.91+v*.46,-.17);
    }
  }
  function shore(x: number,z: number) {
    let distance = surround&&!sky?Math.min(2,country.river(x,z)):2;
    // Board lakes, their outlets and the sloping banks end within six cells of the clearing.
    if(country.outside(x,z)<6)for(const b of basins){
      const dx=Math.abs(x-b.x)-b.w+b.radius, dz=Math.abs(z-b.z)-b.d+b.radius;
      distance=Math.min(distance, Math.min(Math.max(dx,dz),0)+Math.hypot(Math.max(dx,0),Math.max(dz,0))-b.radius);
    }
    return distance+.014*Math.sin(x*13+z*8+seed)*Math.cos(z*9);
  }
  const distanceOutside=country.outside;
  const waterLevel=(x:number,z:number)=>-.051-(surround?.33*smooth(.30,1.95,distanceOutside(x,z)):0);
  const naturalHeight = (x:number,z:number) => {
    if(sky){
      if(!surround)return 0;
      const cloudTop=-2.12+.21*Math.sin(x*.67+Math.sin(z*.49+seed))+.16*Math.cos(z*.74-x*.39);
      return Math.max(cloudTop,-3.70+country.relief(x,z)*.96);
    }
    const outside=distanceOutside(x,z),bank=shore(x,z),dry=clamp((bank+.12)/.19,0,1);
    const hill=surround?country.relief(x,z)*(1-.94*smooth(.35,1.1,outside)*(1-smooth(0,1.3,bank))):0;
    const edge=Math.min(Math.abs(x-Math.round(x)),Math.abs(z-Math.round(z)));
    const groove=outside===0?.031*(1-clamp(edge/.053,0,1)):0;
    const floor=.023+hill-groove+.008*Math.sin(x*2.2+seed)*Math.cos(z*3.4);
    return (waterLevel(x,z)-.16)*(1-dry)+Math.max(waterLevel(x,z)+.035,floor)*dry;
  };
  let path:ReturnType<typeof campFootpath>;
  function height(x:number,z:number){
    const ground=naturalHeight(x,z),outside=distanceOutside(x,z);
    if(!outside||!path)return ground;
    const hit=path.sample(x,z);
    if(!hit||hit.distance>=1.15)return ground;
    const weight=(1-smooth(.57,1.15,hit.distance))*smooth(0,.20,outside)*smooth(-.01,.10,shore(x,z));
    return ground+(hit.grade-ground)*weight;
  }
  if(surround) {
    // Outside the marked square the same terrain becomes a wooded hillside. Continue only
    // water that actually reaches an edge. The outer world has no logical cells or objects.
    if(!sky)for(const [dx,dz] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const edge=(i:number)=>({r:dz===0?i:dz<0?0:size-1,c:dx===0?i:dx<0?0:size-1});
      for(let start=0;start<size;start++){
        const first=edge(start);if(kind(first.r,first.c)!=='water')continue;
        let end=start;
        while(end+1<size && kind(edge(end+1).r,edge(end+1).c)==='water')end++;
        const center=edge((start+end)/2);
        const {u,v}=country.local(center.c+.5,center.r+.5);
        const joinsRiver=dx===country.sideX && dz===country.sideZ;
        const length=joinsRiver?country.bend(v)-u:1.65+rand(first.r,first.c,89)*.95;
        const steps=Math.ceil(length/.29);
        for(let j=1;j<=steps;j++){
          const fraction=j/steps,t=length*fraction,bend=.29*Math.sin(fraction*Math.PI)*Math.sin(t+seed);
          const tip=joinsRiver?1:1-.68*smooth(.35,1,fraction);
          const breadth=(.35+(end-start)*.48*Math.max(.10,1-t/2))*tip;
          basins.push({x:center.c+.5+dx*t+dz*bend,z:center.r+.5+dz*t+dx*bend,
            w:dx?.30:breadth,d:dz?.30:breadth,radius:Math.min(.17,breadth)});
        }
        start=end;
      }
    }
    if(!sky)path=campFootpath(level,country,shore,naturalHeight);
    for(const obj of objects)if(distanceOutside(obj.x,obj.z)>0)obj.y=(obj.y??0)+(sky?-.65:height(obj.x,obj.z));
    const {form}=country;
    const reach=quality==='low'?8:12;
    const fruit=level.id%3===1?'pear_tree':'apple_tree';
    function tree(r:number,c:number,bank:number,distance:number){
      const v=rand(r,c,72),pine='grove_'+(c&1);
      if(bank<1.05 && country.hasRiver)return v<.68?(distance<7?'willow':'round_grove'):'birch';
      if(form==='bluff')return v<.80?pine:'birch';
      if(distance<5.8 && (form==='grove'||form==='meadow') && v<.32)return fruit;
      if(v<.26)return 'birch';
      return v<(form==='grove'?.72:.53)?'round_grove':pine;
    }
    if(!sky&&country.hasRiver){
      const bridge=path?.bridge;
      if(bridge)add('footbridge',bridge.x,bridge.z,bridge.angle,1,bridge.y);
      for(let i=-reach;i<=reach;i++)for(const side of [-1,1]){
        const v=i+rand(i,side,77)*.61,p=country.bank(v,side);
        if(v<country.spring||v>country.outlet||rand(i,side,78)>.55)continue;
        add(side===1||form==='cove'?'reeds':'pebble_1',p.x,p.z,v,.80+rand(i,side,80)*.54,height(p.x,p.z)-.022);
      }
    }
    if(path?.marker){
      const p=path.marker;
      add(form==='bluff'||form==='cove'?'cairn':'waymark',p.x,p.z,p.angle+Math.PI,1.08,height(p.x,p.z)-.012);
    }
    if(path && quality!=='low')for(let i=5;i<path.points.length-1;i+=6){
      const p=path.points[i],next=path.points[i+1],dx=next.x-p.x,dz=next.z-p.z;
      const side=(i%4<2?1:-1)*(.50+rand(i,0,90)*.12)/Math.hypot(dx,dz);
      const x=p.x+dz*side,z=p.z-dx*side;
      if(country.outside(x,z)>.36 && shore(x,z)>.22)add('pebble_'+(i&3),x,z,i*.9,.42+rand(i,0,91)*.23,height(x,z)-.014);
    }
    if(!sky && (form==='bluff'||form==='grove')){
      // A broken outcrop or a little orchard crowns the shoulder across the trail.
      for(let i=0;i<5;i++){
        const a=seed+i*2.4,r=Math.sqrt(i)*.69;
        const x=country.spur.x+Math.cos(a)*r,z=country.spur.z+Math.sin(a)*r;
        if(shore(x,z)>.15)add(form==='bluff'?'rock_'+(i+level.id)%6:i===3?'birch':fruit,x,z,a,2.20-i*.24,height(x,z)-.045);
      }
    }
    if(sky || form==='cloudbank'){
      // Wind draws separate banks around the plateau, with a broad gap between them.
      for(let bank=0;bank<(sky?6:3);bank++){
        const a=seed*.46+bank*2.4,u=Math.cos(a),v=Math.sin(a);
        const radius=(size/2+(sky?2.8:5.5)+rand(bank,0,81)*2.8)/Math.max(Math.abs(u),Math.abs(v));
        const baseY=-2.45+rand(bank,0,82)*1.0;
        for(let i=-2;i<=2;i++){
          const drift=i*(.66+rand(bank,i,83)*.55),curl=i*i*.14+rand(bank,i,84)*.46;
          const x=size/2+u*(radius+curl)-v*drift,z=size/2+v*(radius+curl)+u*drift;
          const scale=(2.9-Math.abs(i)*.63)*(.87+rand(bank,i,85)*.32);
          objects.push({model:'cloud_'+(i&1),x,z,angle:a+i,scale,heightScale:.52,y:sky?baseY+curl*.22:height(x,z)+.65});
        }
      }
    }
    for(let r=-reach;r<size+reach;r++)for(let c=-reach;c<size+reach;c++){
      if(r>=0&&c>=0&&r<size&&c<size)continue;
      const x=c+.19+rand(r,c,56)*.65,z=r+.17+rand(r,c,57)*.67;
      const distance=Math.max(0,-x,-z,x-size,z-size);
      if(sky){
        const crest=height(x,z),v=rand(r,c,71);
        if(distance>3.6 && crest>-1.59 && v<.15){
          const stone=form==='bluff'&&v<.085;
          add(stone?'pebble_'+(c&3):'grove_'+(c&1),x,z,rand(r,c,72)*6.28,stone?2.5:.68+rand(r,c,73)*.43,crest-.025);
        }
        continue;
      }
      const bank=shore(x,z);
      if(distance<.53||bank<.08)continue;
      const v=rand(r,c,58);
      const pocket=.50+.28*Math.sin(x*.59+seed)+.22*Math.cos(z*.71-x*.26);
      if(distance>4.5){
        const density=form==='grove'?.44:form==='meadow'?.18:form==='bluff'?.24:.34;
        if(v<pocket*density*(quality==='low'?.58:1)*(1-.68*smooth(reach-3,reach,distance))){
          add(tree(r,c,bank,distance),x,z,v*6.28,1.0+rand(r,c,74)*.88,height(x,z)-.025);
        }
        continue;
      }
      if(v>(quality==='low'?.45:.64)+pocket*.18)continue;
      const nearest=level.terrain.reduce<typeof level.terrain[number]|undefined>((best,t)=>
        !best||Math.hypot(t.c+.5-x,t.r+.5-z)<Math.hypot(best.c+.5-x,best.r+.5-z)?t:best,undefined);
      let id='meadow_'+(pocket>.62?2:pocket>.38?1:0),scale=.86+pocket*.63;
      if(nearest?.kind==='rock' && v<.15){
        id='pebble_'+(r&3);scale=1.4+pocket*1.8;
      }else if(distance>1.45 && v<pocket*(form==='grove'?.55:form==='meadow'?.13:.34)){
        id=tree(r,c,bank,distance);
        scale=.68+Math.min(distance,3)*.17+rand(r,c,62)*.32;
      }else if(nearest?.kind==='water' && bank<.45){id='reeds';}
      else if((nearest?.kind==='forest'||form==='grove') && pocket>.44 && rand(r,c,86)<.20){
        const detail=rand(r,c,87);
        id=detail<.52?'mushrooms':detail<.80?'fallen_log':'stump';scale=1.0+pocket*.49;
      }else if(form==='grove' && distance>1.1 && pocket>.54 && v<.41){id='round_grove';scale=.36+pocket*.24;}
      add(id,x,z,rand(r,c,59)*Math.PI*2,scale,height(x,z)-.022);
    }
  }
  const waterCell=(r:number,c:number)=>kind(r,c)==='water';
  const banks:{x:number;z:number;dx:number;dz:number}[]=[];
  if(!sky)for(const {r,c,kind:type} of level.terrain)if(type==='water'){
    if(!waterCell(r-1,c))banks.push({x:c,z:r,dx:1,dz:0});
    if(!waterCell(r+1,c))banks.push({x:c,z:r+1,dx:1,dz:0});
    if(!waterCell(r,c-1))banks.push({x:c,z:r,dx:0,dz:1});
    if(!waterCell(r,c+1))banks.push({x:c+1,z:r,dx:0,dz:1});
  }
  function waterDepth(x:number,z:number){
    const d=Math.max(0,-shore(x,z));if(!waterCell(Math.floor(z),Math.floor(x)))return d;
    let nearest=2;
    for(const b of banks){
      const px=x-b.x,pz=z-b.z,t=clamp(px*b.dx+pz*b.dz,0,1);
      nearest=Math.min(nearest,Math.hypot(px-b.dx*t,pz-b.dz*t));
    }
    // Only an exposed shoreline can tint a lake shallow. Adjoining cells share its depth.
    return Math.max(d,(nearest-.12)*smooth(.20,.42,nearest));
  }
  const scenery=objects.filter(obj=>{
    if(!surround||sky||!distanceOutside(obj.x,obj.z)||['footbridge','waymark','cairn'].includes(obj.model))return true;
    const radius=(obj.scale??1)*(/^(rock_|fallen_log|forest_|grove_|round_grove)/.test(obj.model)?.40:.16);
    if((path?.sample(obj.x,obj.z)?.distance??Infinity)<.34+radius)return false;
    if(path?.marker && Math.hypot(obj.x-path.marker.x,obj.z-path.marker.z)<.20+radius)return false;
    return /^(reeds|pebble_|cloud_)/.test(obj.model)||shore(obj.x,obj.z)>radius;
  });
  return { size, sky, seed, objects:scenery, shore, height, waterLevel, waterCell, waterDepth, country, path, surround, hasWater:basins.length>0 };
}
