import type { Level } from '../../engine';
import { JOURNAL_LEVEL_COVERS, JOURNAL_PALETTES } from '../components/journalArt';

export const smooth = (a:number,b:number,x:number) => {
  const t=Math.max(0,Math.min(1,(x-a)/(b-a)));
  return t*t*(3-2*t);
};

type Landform = 'brook'|'cove'|'meadow'|'grove'|'bluff'|'cloudbank';
// In diary order: the approach to each clearing follows that day's illustration.
const approaches:readonly Landform[]=[
  'brook','cove','meadow','grove','brook', 'grove','bluff','bluff','cove','brook', 'grove','cove','brook','bluff','meadow',
  'brook','cove','bluff','meadow','grove', 'brook','bluff','meadow','grove','grove', 'brook','meadow','bluff','bluff','grove',
  'cove','bluff','grove','meadow','meadow', 'bluff','bluff','cove','grove','cove', 'brook','grove','cove','meadow','bluff',
  'cove','cloudbank','bluff','cove','cloudbank', 'brook','meadow','bluff','cove','bluff', 'cloudbank','cove','bluff','grove','cloudbank',
];

// Local (u,v) axes follow the wet side of this particular clearing. The riverbed,
// the footbridge, the footpath and the trees all sample the same ground coordinates.
export function countryside(level:Level,seed:number){
  const half=level.size/2,water=level.terrain.filter(t=>t.kind==='water');
  const rocks=level.terrain.filter(t=>t.kind==='rock');
  const cover=JOURNAL_LEVEL_COVERS[level.id-1];
  const form=approaches[level.id-1] ?? (level.sky?'cloudbank':rocks.length>water.length?'bluff':water.length?'brook':'meadow');
  const palette=JOURNAL_PALETTES[cover?.palette ?? (level.sky?'fog':form==='bluff'?'stone':'meadow')];
  const direction=water.reduce((sum,t)=>({x:sum.x+t.c+.5-half,z:sum.z+t.r+.5-half}),{x:0,z:0});
  const alongX=Math.abs(direction.x)>Math.abs(direction.z);
  const nx=alongX?(Math.sign(direction.x)||1):0,nz=alongX?0:(Math.sign(direction.z)||1);
  const phase=(seed%67)*.29, crossing=(Math.sin(phase)*.47+.08)*half;
  const outside=(x:number,z:number)=>Math.max(0,-x,-z,x-level.size,z-level.size);
  const bend=(v:number)=>half+(form==='cove'?3.35:2.45)+(.72*Math.sin(v*.43+phase)+.44*Math.sin(v*.22-phase))*(form==='brook'?1.16:.78);
  const spring=-half-6.2-.45*Math.sin(phase),outlet=half+7.1+.55*Math.cos(phase);
  const width=(v:number)=>{
    const channel=form==='cove'?.68+1.50*Math.exp(-((v-crossing)**2)/9):.48+.19*(1+Math.sin(v*.38+phase));
    return channel*(.59+.41*smooth(spring,spring+2.8,v))+.82*Math.exp(-((v-outlet)**2)/2.2);
  };
  const local=(x:number,z:number)=>({u:(x-half)*nx+(z-half)*nz,v:-(x-half)*nz+(z-half)*nx});
  const world=(u:number,v:number)=>({x:half+u*nx-v*nz,z:half+u*nz+v*nx});
  const bankU=(v:number,side:number)=>bend(v)+side*(width(v)+.08);
  function river(x:number,z:number){
    if(!water.length)return 20;
    const {u,v}=local(x,z);
    // End in a spring and a reed-fringed pool, inside the resolved valley mesh.
    const station=Math.max(spring,Math.min(outlet,v));
    return Math.hypot(u-bend(station),v-station)-width(station);
  }
  const spur=world(-half-3.8,Math.sin(phase*1.7)*half);
  function relief(x:number,z:number){
    const d=outside(x,z), near=smooth(.2,3.5,d),far=smooth(2.5,11,d);
    const rolling=.19*Math.sin(x*.70+phase)*Math.cos(z*.51)+.21*Math.sin(z*.42-phase);
    const shoulder=1/(1+.17*((x-spur.x)**2+(z-spur.z)**2));
    const crest=.5+.5*Math.sin(x*.33+Math.sin(z*.25+phase)+phase*.7);
    const ridge=.5+.5*Math.cos(z*.27+Math.cos(x*.18-phase));
    const height=form==='bluff'?5.7:form==='cloudbank'?6.2:form==='cove'?2.4:form==='meadow'?2.0:3.5;
    const hills=near*(-.22+rolling+shoulder*(form==='bluff'?2.1:.47))+far*(.45+height*crest*ridge)+
      smooth(11,28,d)*(2.4+2.5*Math.cos(x*.14+z*.13+phase));
    const valley=water.length?smooth(.08,2.6+d*.14,river(x,z)):1;
    return hills*(.04+.96*valley);
  }
  return {form,palette,world,local,bend,bankU,spring,outlet,crossing,spur,outside,river,relief,hasRiver:water.length>0,
    bank:(v:number,side:number)=>world(bankU(v,side),v),
    bridgeAngle:Math.atan2(-nz,nx),sideX:nx,sideZ:nz};
}
