import { LatheGeometry, SphereGeometry, TorusGeometry, Vector2 } from 'three';
import { ball, bark, beam, block, brass, cord, dark, faces, honey, lantern, linen, part, ring, rope, tau, wood } from './geometry.mjs';
import { stone } from './nature.mjs';

// Cross sections turn through a mitred elbow on L footprints, sharing the ridge and eaves.
function spine(shape) {
  if(shape==='el') return [[-.5,-.90,-1,0],[-.5,-.41,-1,0],[-.5,.50,-1,1],[.34,.5,0,1],[.91,.5,0,1]];
  const width={single:1,domino:2,long:3}[shape], length=width-.18;
  return Array.from({length:width*2+1},(_,i)=>[-length/2+i*length/(width*2),0,0,1]);
}
const point=([x,z,nx,nz],w,y)=>[x+nx*w,y,z+nz*w];
function strip(g,a,b,profile,color){
  const vertices=[...profile.map(([w,y])=>point(a,w,y)),...profile.map(([w,y])=>point(b,w,y))];
  const ix=[], n=profile.length;
  for(let i=0;i<n-1;i++) ix.push(i,i+n,i+1,i+1,i+n,i+n+1);
  faces(g,vertices,ix,color);
}
export function tent(g,shape) {
  const path=spine(shape), height=shape==='single'?.68:.70;
  for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i];
    for(const side of [-1,1]){
      const vertices=[],indices=[],divisions=8;
      for(let j=0;j<=divisions;j++)for(let k=0;k<=divisions;k++){
        const u=j/divisions,v=k/divisions,mid=Math.sin(u*Math.PI),fold=Math.sin(v*Math.PI);
        const section=a.map((v,n)=>v+(b[n]-v)*u);
        const w=side*(v*.38+.012*Math.sin(v*Math.PI*3+u*2)*fold*mid);
        const y=height*(1-v)+.055*v-.067*fold-.038*mid*(.48+fold*.52)+.009*Math.cos(v*17+u*5)*fold;
        vertices.push(point(section,w,y));
        if(j<divisions&&k<divisions){const n=j*(divisions+1)+k;indices.push(n,n+1,n+divisions+1,n+1,n+divisions+2,n+divisions+1);}
      }
      const cloth=faces(g,vertices,indices,i%2?'#ffbe4b':'#f8b33e');cloth.userData.surface='canvas';
      strip(g,a,b,[[side*.38,.055],[side*.342,.102]],'#f7c36e');
      beam(g,point(a,side*.379,.06),point(b,side*.379,.06),.012,'#a67840');
    }
    const mid=a.map((v,n)=>(v+b[n])/2);
    cord(g,[point(a,0,height+.005),point(mid,0,height-.012),point(b,0,height+.005)],.012,linen);
  }
  path.forEach((s,i)=>{
    for(const side of [-1,1]){
      cord(g,[point(s,0,height+.006),point(s,side*.124,.421),point(s,side*.25,.209),point(s,side*.38,.06)],.008,'#f6cf7f');
      if(i===0||i===path.length-1||i%2===0){
        const peg=point(s,side*.45,.025);
        beam(g,peg,[peg[0]+.01,.085,peg[2]+.015],.013,bark);
        cord(g,[point(s,side*.25,.28),point(s,side*.36,.115),peg],.007,rope);
      }
    }
  });
  for(const i of [0,path.length-1]){
    const s=path[i], next=path[i?i-1:1],dx=next[0]-s[0],dz=next[1]-s[1],len=Math.hypot(dx,dz);
    const inset=[s[0]+dx/len*.09,s[1]+dz/len*.09,s[2],s[3]];
    faces(g,[point(inset,-.346,.054),point(inset,0,height-.045),point(inset,.346,.054)],[0,1,2],'#3c673f');
    block(g,point(inset,.057,.083),[.15,.055,.19],'#828859',.02);
    for(const side of [-1,1]){
      faces(g,[point(s,side*.38,.056),point(s,0,height),point(s,side*.21,.15)],[0,1,2],'#f8c065');
      cord(g,[point(s,side*.009,height-.018),point(s,side*.093,.41),point(s,side*.207,.144)],.014,'#e8ac46');
      const tie=point(s,side*.21,.16);ball(g,tie,[.025,.015,.019],rope);
      beam(g,point(s,side*.39,.035),point(s,-side*.045,height+.075),.017,wood);
    }
  }
  const end=path[path.length-1]; const [x,,z]=point(end,.31,.05);
  lantern(g,x,.06,z,.67);
  if(shape==='single')g.rotation.y=-Math.PI/2;
}

function shingles(g,a,b,width,eaves,peak,palette) {
  const count=Math.max(2,Math.round(Math.hypot(b[0]-a[0],b[1]-a[1])/.115)),rows=4;
  const section=t=>a.map((v,i)=>v+(b[i]-v)*t);
  for(const sign of [-1,1])for(let row=0;row<rows;row++){
    const inner=row/rows,outer=Math.min(1,(row+1.13)/rows);
    for(let j=-1;j<count;j++){
      const stagger=row%2*.5,lo=Math.max(0,(j+stagger+.018)/count),hi=Math.min(1,(j+stagger+.98)/count);
      if(hi<=lo)continue;
      const first=section(lo),last=section(hi), y=peak+(eaves-peak)*outer, top=peak+(eaves-peak)*inner+.015;
      const nodes=[point(first,sign*width*inner,top),point(last,sign*width*inner,top),
        point(last,sign*width*outer,y+.017),point(first,sign*width*outer,y+.019),
        point(last,sign*width*outer,y-.006),point(first,sign*width*outer,y-.006)];
      const tile=faces(g,nodes,[0,1,2,0,2,3,3,2,4,3,4,5],palette[(j+count+row*3)%palette.length]);
      tile.userData.surface='wood';
    }
  }
}
const cedar=['#ad7548','#c18b56','#b27c4c','#b88250','#a97147','#bd8553'];
export function cabin(g) {
  const path=spine('el');
  for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i];
    strip(g,a,b,[[-.32,.06],[-.32,.42],[.32,.42],[.32,.06]],wood);
    for(const side of [-1,1]) {
      for(let j=0;j<5;j++) beam(g,point(a,side*.322,.095+j*.075),point(b,side*.322,.095+j*.075),.045,j%2?wood:honey, .045,8);
      for(let j=0;j<4;j++){
        const w=j*.10, y=.72-j*.077;
        strip(g,a,b,[[side*w,y],[side*(w+.11),y-.072],[side*(w+.11),y-.093]],'#895937');
      }
    }
    beam(g,point(a,0,.735),point(b,0,.735),.029,'#91683e');
    shingles(g,a,b,.416,.421,.751,cedar);
  }
  for(const i of [0,path.length-1]){
    const s=path[i];
    faces(g,[point(s,-.32,.06),point(s,-.32,.42),point(s,0,.69),point(s,.32,.42),point(s,.32,.06)],[0,1,2,0,2,4,2,3,4],honey);
  }
  block(g,[.921,.218,.5],[.038,.34,.196],bark);
  block(g,[.947,.245,.5],[.014,.185,.115],'#daa34b');
  ball(g,[.964,.205,.56],[.012,.012,.012],brass,0);
  for(const x of [-.52,.02,.73]){
    block(g,[x,.275,.849],[.23,.192,.031],bark);
    block(g,[x,.276,.868],[.186,.15,.016],'#ffd083');
    block(g,[x,.277,.884],[.018,.15,.014],wood,0);
    block(g,[x,.277,.884],[.195,.014,.014],wood,0);
    block(g,[x,.17,.87],[.25,.026,.067],honey);
  }
  for(let j=0;j<5;j++) block(g,[-.55,.58+j*.065,-.44],[.16,.071,.15],j%2?'#8a867c':'#a49887',.012);
  block(g,[-.55,.91,-.44],[.20,.055,.18],dark);
  for(const z of [.346,.651])block(g,[.947,.22,z],[.044,.37,.032],honey);
  block(g,[.949,.421,.5],[.046,.045,.34],wood);lantern(g,.938,.30,.74,.80);
  for(const [x,z] of [[-.83,.69],[-.79,.86]])block(g,[x,.075,z],[.15,.15,.16],honey);
  block(g,[.36,.204,.851],[.23,.34,.053],bark);
  for(let j=0;j<4;j++)block(g,[.283+j*.052,.214,.883],[.046,.31,.012],j%2?'#ae7547':'#b8804d',.004);
  ball(g,[.435,.206,.903],[.014,.014,.012],brass);
  for(const x of [.215,.505])beam(g,[x,.045,.92],[x,.38,.92],.021,wood);
  shingles(g,[.36,.72,-1,0],[.36,.969,-1,0],.188,.37,.508,cedar);
  for(let i=0;i<2;i++)block(g,[.36,.028+i*.042,.95-i*.048],[.29,.046,.083],i?wood:honey);
  lantern(g,.57,.264,.888,.82);
}
export function lookout(g){
  const corners=[[-1,-1],[1,-1],[1,1],[-1,1]];
  for(let i=0;i<4;i++){
    const [x,z]=corners[i],[u,v]=corners[(i+1)%4];
    stone(g,x*.26,z*.26,.095,.095,.095,i+.15);
    beam(g,[x*.265,.055,z*.265],[x*.175,.91,z*.175],.037,wood,.029);
    beam(g,[x*.25,.12,z*.25],[u*.20,.55,v*.20],.024,honey);
    beam(g,[u*.25,.12,v*.25],[x*.20,.55,z*.20],.024,wood);
    beam(g,[x*.18,.78,z*.18],[u*.18,.78,v*.18],.021,honey);
  }
  for(let j=0;j<5;j++)block(g,[-.23+j*.115,.57,0],[.111,.048,.55],j%2?honey:wood);
  for(const x of [-.088,.088])beam(g,[x,.015,.38],[x,.59,.23],.018,wood);
  for(let j=0;j<6;j++)beam(g,[-.085,.08+j*.085,.36-j*.022],[.085,.08+j*.085,.36-j*.022],.014,honey);
  for(const x of [-.23,.23]){
    beam(g,[x,.89,-.30],[x,1.085,0],.024,honey);beam(g,[x,.89,.30],[x,1.085,0],.024,honey);
    beam(g,[x,.895,-.28],[x,.895,.28],.019,wood);
  }
  shingles(g,[-.33,0,0,1],[.33,0,0,1],.32,.884,1.089,cedar);
  beam(g,[-.345,1.105,0],[.345,1.105,0],.022,honey);
  beam(g,[.20,1.09,0],[.20,1.31,0],.012,honey,.008);
  for(const z of [-.24,.24])beam(g,[-.24,.696,z],[.24,.696,z],.015,honey);
  lantern(g,.075,.601,.10,.94);
}
export function picnic(g) {
  // A pair of occupied squares includes circulation space around the table and benches.
  g.scale.set(.77,.83,.77);
  for(const x of [-.55,.55]){
    for(const s of [-1,1])beam(g,[x,.025,s*.36],[x,.36,-s*.155],.041,wood);
    block(g,[x,.156,0],[.083,.064,.80],honey);
  }
  for(let i=0;i<4;i++)block(g,[0,.365,-.202+i*.135],[1.70,.055,.131],i%2?'#c08b53':honey);
  for(const z of [-.36,.36])block(g,[0,.215,z],[1.65,.057,.15],honey);
  for(let x=0;x<6;x++)for(let z=0;z<7;z++){
    block(g,[-.35+x*.07,.399,-.247+z*.082],[.071,.008,.084],(x+z)%2?'#c66f52':'#f3dcb1',0);
  }
  lantern(g,.31,.399,-.04,1.05);
  for(const sign of [-1,1])for(let x=0;x<6;x++)for(let j=0;j<2;j++)
    block(g,[-.35+x*.07,.378-j*.035,sign*.276],[.071,.04,.014],(x+j)%2?'#c9775c':'#edd6ac',.004);
  beam(g,[-.51,.396,.025],[-.51,.471,.025],.043,'#e9dec7',.051,12);
  ring(g,[-.51,.44,.073],.022,.007,'#efe1ca',[0,Math.PI/2,0]);
  beam(g,[-.09,.405,-.07],[-.09,.42,-.07],.074,'#ebe2c1',.078,16);
  ball(g,[-.09,.437,-.07],[.050,.027,.034],'#c98c4b',1);
}
export function fire(g){
  for(let i=0;i<11;i++){
    const a=i*tau/11, r=.30+.015*Math.cos(a*3);
    stone(g,r*Math.cos(a),r*Math.sin(a),.1,.085,.108+i%3*.018,i*.63);
  }
  for(let i=0;i<4;i++){
    const a=i*Math.PI/4, x=.235*Math.cos(a),z=.235*Math.sin(a);
    beam(g,[-x,.08,-z],[x,.11,z],.046,bark);
    beam(g,[x,.11,z],[x*1.025,.11,z*1.025],.038,honey);
  }
}
export function flame(g){
  for(let i=0;i<5;i++){
    const a=i*2.4,x=i?.077*Math.cos(a):0,z=i?.077*Math.sin(a):0,h=i?.26+i%2*.1:.46;
    const vs=[],ix=[];
    const profile=[[0,0,.054],[-.016,.12,.084],[-.028,.29,.097],[-.019,.46,.079],[.006,.64,.053],[.041,.84,.027],[.052,1,.002]];
    for(const [shift,y,r] of profile){
      for(let j=0;j<12;j++)vs.push([x+shift+Math.cos(j*tau/12)*r,.10+y*h,z+Math.sin(j*tau/12)*r]);
    }
    for(let j=0;j<(profile.length-1)*12;j++){const n=Math.floor(j/12)*12+(j+1)%12;ix.push(j,j+12,n,n,j+12,n+12);}
    const tongue=faces(g,vs,ix,i%2?'#ffe878':'#fd8a34');
    tongue.userData.tongue=i;
  }
}
export function truck(g){
  for(const x of [-.25,.24])for(const z of [-.226,.226]){
    beam(g,[x,.103,z-.035],[x,.103,z+.035],.099,dark,.099,14);
    beam(g,[x,.103,z*1.17],[x,.103,z*1.20],.043,'#ccc6ad',.043,12);
  }
  block(g,[0,.212,0],[.83,.18,.43],'#448b85',.04);
  block(g,[-.088,.366,0],[.64,.24,.441],'#efe0b6',.042);
  block(g,[.281,.319,0],[.219,.172,.425],'#dfbf83',.042);
  block(g,[.315,.377,0],[.16,.092,.38],'#547876',.028,[0,0,-.15]);
  block(g,[-.09,.369,.228],[.41,.14,.018],dark);
  block(g,[-.09,.29,.268],[.47,.027,.105],honey);
  for(let j=0;j<7;j++) block(g,[-.29+j*.068,.474,.256],[.069,.026,.16],j%2?'#f3dfb8':'#c56a4c',.009,[.18,0,0]);
  block(g,[-.09,.51,0],[.42,.035,.24],'#ba8053');
  for(let j=0;j<4;j++)block(g,[-.19+j*.073,.535,0],[.037,.014,.142],dark,.006);
  block(g,[-.348,.319,-.225],[.102,.19,.012],honey);
  for(const z of [-.16,.16])block(g,[-.417,.195,z],[.016,.056,.047],'#b64a37');
  for(const z of [-.152,.152])ball(g,[.416,.235,z],[.016,.034,.035],linen);
}
export function pylon(g){
  const corners=[[-1,-1],[1,-1],[1,1],[-1,1]],steel='#597880',edge='#91aaa8';
  const tiers=[[.055,.225],[.34,.155],[.60,.094],[.89,.064],[1.12,.019]];
  for(let i=0;i<4;i++){
    const [x,z]=corners[i],[u,v]=corners[(i+1)%4];
    block(g,[x*.225,.04,z*.225],[.127,.08,.127],'#c9c3a8',.018);
    for(let j=1;j<tiers.length;j++){
      const [lo,r]=tiers[j-1],[hi,s]=tiers[j];
      beam(g,[x*r,lo,z*r],[x*s,hi,z*s],.023-j*.0018,steel);
      beam(g,[x*s,hi,z*s],[u*s,hi,v*s],.013,edge);
      beam(g,[x*r,lo,z*r],[u*s,hi,v*s],.012,edge);
      if(j<4)beam(g,[u*r,lo,v*r],[x*s,hi,z*s],.011,steel);
    }
  }
  for(const [y,w] of [[.71,.414],[.92,.325]])for(const sign of [-1,1]){
    const tip=[w*sign,y,0];
    for(const z of [-.062,.062]){
      beam(g,[.055*sign,y,z],tip,.018,edge,.012);
      beam(g,[.072*sign,y-.115,z],tip,.014,steel,.010);
    }
    beam(g,tip,[w*sign,y-.132,0],.011,brass);
    for(let k=0;k<3;k++)beam(g,[w*sign,y-.034-k*.03,0],[w*sign,y-.050-k*.03,0],.032,'#88b8ae',.023,12);
    ring(g,[w*sign,y-.139,0],.017,.006,'#856f52',[0,0,0]);
  }
  beam(g,[0,1.095,0],[0,1.175,0],.032,steel,.013,8);
  ball(g,[0,1.177,0],[.020,.016,.020],brass,1);
}
const poolPoint=(a,r,y)=>[(-.026+.398*Math.cos(a)*r),y,-.025+.309*Math.sin(a)*r*(1-.14*Math.cos(a))];
export function pool(g) {
  const count=32, limestones=['#f2d9a2','#f7e3b9','#ebcc98','#ffe9c8'];
  for(let i=0;i<count;i++){
    const a=i*tau/count,b=(i+1)*tau/count;
    const band=(inner,outer,low,high,color)=>{
      const verts=[poolPoint(a,outer,low),poolPoint(b,outer,low),poolPoint(b,outer,high),poolPoint(a,outer,high),
        poolPoint(a,inner,high),poolPoint(b,inner,high),poolPoint(b,inner,low),poolPoint(a,inner,low)];
      faces(g,verts,[0,2,1,0,3,2,3,4,5,3,5,2,4,7,6,4,6,5],color);
    };
    band(.84,1,.025,.141,i%4?'#66aaae':'#8ccbc6');
    band(.824,1.045,.143,.177,limestones[Math.floor(i/2)%4]);
    faces(g,[[0,.047,-.02],poolPoint(b,.85,.048),poolPoint(a,.85,.048)],[0,1,2],'#66c8c7');
  }
  for(let i=0;i<7;i++)block(g,[.15+i*.035,.051,.255],[.033,.088,.34-i*.014],i%2?'#dea765':'#edbd7c',.005,[0,.09,0]);
  for(let i=0;i<3;i++)block(g,[-.132+i*.036,.074+i*.016,.169+i*.014],[.158,.024,.048],'#b2e3cf',.012);
  for(const x of [-.100,.028])cord(g,[[x,.060,.135],[x,.208,.186],[x,.261,.223],[x,.248,.282],[x,.159,.291]],.010,'#8caeab');
  for(const y of [.099,.144])beam(g,[-.1,y,.159],[.028,y,.159],.008,'#d8dcd0');
  beam(g,[.329,.093,.239],[.329,.338,.239],.015,honey);
  for(let i=0;i<8;i++){
    const life=part(g,new TorusGeometry(.065,.019,8,6,tau/8),i%2?'#fff1cf':'#ed855b',[.326,.257,.253]);
    life.rotation.z=i*tau/8;
  }
  block(g,[.238,.106,.321],[.114,.020,.088],'#78b4b6',.008);
  block(g,[.241,.121,.318],[.105,.014,.065],'#f8efcf',.005);
}
export function poolSurface(g){
  const verts=[[0,.127,-.02]],index=[];
  for(let i=0;i<48;i++)verts.push(poolPoint(i*tau/48,.844,.127));
  for(let i=0;i<48;i++)index.push(0,1+(i+1)%48,1+i);
  faces(g,verts,index,'#64cdd2');
}
export function footbridge(g){
  const rise=x=>.12+.18*Math.max(0,1-(x/1.26)**2);
  for(let i=0;i<17;i++){
    const x=(i-8)*.148;
    block(g,[x,rise(x),0],[.147,.065,.63],i%3?'#d4a46b':'#e3b681',.015,[0,0,-.20*x]);
  }
  for(const z of [-.29,.29]){
    const rail=[-1.18,-.60,0,.60,1.18].map(x=>[x,rise(x)+.31,z]);
    for(const [x,y] of rail)beam(g,[x,rise(x)-.20,z],[x,y+.025,z],.030,wood,.028);
    cord(g,rail,.020,honey);
    cord(g,rail.map(([x,y,z])=>[x,y-.15,z]),.009,rope);
  }
}
export function balloon(g) {
  const shape=[[.045,.40],[.12,.48],[.24,.62],[.294,.79],[.276,.91],[.205,1.04],[.09,1.10],[.005,1.12]].map(([x,y])=>new Vector2(x,y));
  for(let i=0;i<12;i++) part(g,new LatheGeometry(shape,3,i*tau/12,tau/12),i%2?'#e4bd78':'#c9694b');
  for(const x of [-.083,.083])for(const z of [-.075,.075])beam(g,[x,.18,z],[x*.64,.44,z*.64],.008,rope);
  block(g,[0,.141,0],[.19,.116,.16],wood,.026);
  for(let i=0;i<3;i++)block(g,[0,.098+i*.032,0],[.195,.012,.166],honey);
  ring(g,[0,.423,0],.061,.014,brass);
  for(let j=0;j<6;j++){
    const a=j*tau/6;
    cord(g,[[.051*Math.cos(a),.414,.051*Math.sin(a)],[.232*Math.cos(a),.626,.232*Math.sin(a)],[.293*Math.cos(a),.795,.293*Math.sin(a)],[.204*Math.cos(a),1.04,.204*Math.sin(a)]],.0045,linen);
  }
  for(const x of [-.09,.09])ball(g,[x,.12,.09],[.027,.048,.029],'#c89c65',1);
}
export function airship(g){
  const geo=new SphereGeometry(1,30,16);
  const bag=part(g,geo,'#e3cda4',[.02,.56,0]);bag.scale.set(.72,.245,.233);
  for(let i=0;i<5;i++){
    const x=-.47+i*.225, s=Math.sqrt(1-((x-.02)/.72)**2);
    const hoop=ring(g,[x,.56,0],.24*s,.012,'#b8905d',[0,Math.PI/2,0]);hoop.scale.x=.978;
  }
  for(const side of [-1,1]){
    faces(g,[[-.56,.56,side*.04],[-.85,.62,side*.31],[-.74,.54,side*.27],[-.40,.51,side*.13]],[0,1,2,0,2,3],'#5c9691');
    for(const x of [-.27,.26])beam(g,[x,.21,side*.09],[x,.45,side*.18],.009,rope);
  }
  faces(g,[[-.68,.56,0],[-.86,.87,0],[-.59,.79,0],[-.40,.59,0]],[0,1,2,0,2,3],'#5b8f86');
  block(g,[0,.184,0],[.61,.14,.21],wood,.05);
  for(let i=0;i<5;i++)block(g,[-.22+i*.11,.20,.108],[.075,.063,.014],'#99bebe',.01);
  beam(g,[-.34,.18,0],[-.44,.18,0],.016,brass);
}
export function propeller(g){
  for(let i=0;i<3;i++){
    const a=i*tau/3;
    const blade=ball(g,[0,Math.cos(a)*.076,Math.sin(a)*.076],[.014,.084,.022],honey,1);
    blade.rotation.x=a;
  }
  ball(g,[0,0,0],[.031,.025,.025],brass);
}
export function pennant(g){
  const vertices=[],ix=[];
  for(let i=0;i<7;i++){
    const t=i/6,z=.023*Math.sin(t*5);
    vertices.push([t*.25,-t*.048,z],[t*.25,-.113+t*.06,z]);
    if(i)ix.push(i*2-2,i*2,i*2-1,i*2-1,i*2,i*2+1);
  }
  faces(g,vertices,ix,'#da7950');
}
export function kite(g){
  const nose=[-.96,.60,0], tail=[.18,.38,0], center=[-.52,.64,0];
  for(const side of [-1,1]){
    const wing=[-.53,.48,side*.39];
    faces(g,[nose,wing,center,tail],[0,1,2,1,3,2],side===1?'#ce7753':'#66a09a');
    beam(g,nose,wing,.011,rope);beam(g,wing,tail,.012,rope);beam(g,center,wing,.014,honey);
  }
  beam(g,nose,tail,.014,wood);
  const ribbon=[tail,[.38,.26,.08],[.62,.16,-.07],[.85,.21,-.1],[1.1,.15,.06],[1.38,.11,.01]];
  cord(g,ribbon,.012,linen);
  ribbon.slice(1,-1).forEach(([x,y,z],i)=>{
    for(const s of [-1,1])faces(g,[[x,y,z],[x+.05,y+.022,z+s*.093],[x-.055,y+.015,z+s*.084]],[0,1,2],i%2?'#72a39d':'#df9664');
  });
}
