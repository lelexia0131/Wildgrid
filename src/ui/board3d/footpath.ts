import type { Level } from '../../engine';
import { smooth } from './countryside';
import type { countryside } from './countryside';

type Point={x:number;z:number};
type Ground=(x:number,z:number)=>number;
const halfSpan=1.26,deckEnd=.16; // End plank of the footbridge mesh, in world units.

export function campFootpath(level:Level,land:ReturnType<typeof countryside>,shore:Ground,ground:Ground){
  const half=level.size/2;
  const gates=Array.from({length:level.size},(_,i)=>i+.5-half)
    .sort((a,b)=>Math.abs(a-land.crossing)-Math.abs(b-land.crossing));
  const wet=land.hasRiver,bridgeCountry=wet && (land.form==='brook'||land.form==='grove');
  const fixed=[...level.terrain,...(level.sky?.anchors??[])];
  type Route={points:Point[];bridge?:Point};
  let route:Route|undefined;
  // Try both dry abutments before considering either direction along the inner bank.
  const choices=bridgeCountry?['bridge','bank','reverse-bank']:wet?['bank','reverse-bank']:['upland'];
  for(const kind of choices){
    for(const v of gates){
      const cell=land.world(half-.5,v);
      if(fixed.some(p=>p.r===Math.floor(cell.z)&&p.c===Math.floor(cell.x)))continue;
      const entry=land.world(half,v);
      if(shore(entry.x,entry.z)<.32)continue;
      const crossingU=land.bend(v),bridge=land.world(crossingU,v);
      const sign=(v<0?1:-1)*(kind==='reverse-bank'?-1:1);
      const points:Point[]=[];
      for(let i=0;i<=36;i++){
        const t=i/36;
        if(kind==='bank'||kind==='reverse-bank'){
          const along=v+sign*5.5*t*t;
          const bank=land.bankU(along,-1)-.64;
          points.push(land.world(half+(bank-half)*smooth(0,.34,t),along));
        }else{
          const u=half+t*(kind==='bridge'?crossingU+halfSpan+3.2-half:5.8);
          const bend=kind==='bridge'?Math.max(0,u-crossingU-halfSpan-.35):u-half;
          points.push(land.world(u,v+sign*.58*(1-Math.cos(bend*.73))));
        }
      }
      const dry=(p:Point)=>shore(p.x,p.z)>.10;
      if(points.some(p=>{
        const u=(p.x-half)*land.sideX+(p.z-half)*land.sideZ;
        if(kind==='bridge'&&Math.abs(u-crossingU)<halfSpan-.20)return false;
        return u<half-.001 || !dry(p) ||
          !dry({x:p.x+.27,z:p.z}) || !dry({x:p.x-.27,z:p.z}) ||
          !dry({x:p.x,z:p.z+.27}) || !dry({x:p.x,z:p.z-.27});
      }))continue;
      if(kind==='bridge' && (crossingU-halfSpan<half+.15||
        [-1,1].some(s=>[-.31,.31].some(d=>{const p=land.world(crossingU+s*halfSpan,v+d);return !dry(p);}))))continue;
      route={points,bridge:kind==='bridge'?bridge:undefined};
      break;
    }
    if(route)break;
  }
  if(!route)return undefined;
  const {points,bridge}=route,landing=.025;
  const grades=points.map(p=>ground(p.x,p.z));
  for(let i=1;i<points.length;i++){
    const p=points[i],prev=points[i-1],limit=.30*Math.hypot(p.x-prev.x,p.z-prev.z);
    const crossed=bridge && (p.x-bridge.x)*land.sideX+(p.z-bridge.z)*land.sideZ <= halfSpan+.30;
    grades[i]=crossed?landing:Math.max(grades[i-1]-limit,Math.min(grades[i-1]+limit,grades[i]));
  }
  const xs=points.map(p=>p.x),zs=points.map(p=>p.z);
  const xmin=Math.min(...xs)-1.2,xmax=Math.max(...xs)+1.2,zmin=Math.min(...zs)-1.2,zmax=Math.max(...zs)+1.2;
  function sample(x:number,z:number){
    if(x<xmin||x>xmax||z<zmin||z>zmax)return undefined;
    let best=Infinity,grade=0,progress=0;
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z,length2=dx*dx+dz*dz;
      const t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/length2));
      const d=(x-a.x-dx*t)**2+(z-a.z-dz*t)**2;
      if(d<best){best=d;grade=grades[i-1]+(grades[i]-grades[i-1])*t;progress=(i-1+t)/(points.length-1);}
    }
    return {distance:Math.sqrt(best),grade,progress};
  }
  const end=points[points.length-1],before=points[points.length-4];
  const angle=Math.atan2(before.z-end.z,end.x-before.x);
  const marker=[-.50,.50].map(side=>({x:end.x+side*Math.sin(angle),z:end.z+side*Math.cos(angle),angle}))
    .find(p=>land.outside(p.x,p.z)>.28 && shore(p.x,p.z)>.20 && (sample(p.x,p.z)?.distance??Infinity)>.37);
  function paint(x:number,z:number){
    const hit=sample(x,z);if(!hit||land.outside(x,z)===0)return 0;
    const edge=.032*Math.sin(x*5.2+z*2.4)+.018*Math.cos(z*9.1-x*3.2);
    const width=(.26+edge)*(1-.54*smooth(.78,1,hit.progress));
    return (1-smooth(width*.49,width+.065,hit.distance))*smooth(-.02,.10,shore(x,z));
  }
  return {points,sample,paint,marker,bounds:{xmin,xmax,zmin,zmax},bridge:bridge&&{...bridge,y:landing-deckEnd,angle:land.bridgeAngle}};
}
