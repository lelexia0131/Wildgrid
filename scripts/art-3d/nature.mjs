import { ball, bark, beam, block, brass, cord, faces, honey, part, ring, rope, sage, tau, wood } from './geometry.mjs';
import { Color, Float32BufferAttribute, Group, IcosahedronGeometry, LatheGeometry, SphereGeometry, Vector2 } from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

function rockGeometry(detail){
  const sphere=new IcosahedronGeometry(1,detail);
  sphere.deleteAttribute('uv');sphere.deleteAttribute('normal');
  return mergeVertices(sphere);
}

// Each whorl has overlapping, rounded branch pads with lifted shoulders and drooping tips.
function spruce(g,x,z,s,phase,detailed=true) {
  const tree=new Group();g.add(tree);tree.position.set(x,0,z);tree.scale.setScalar(s);
  beam(tree,[0,0,0],[.012,.94,0],.068,wood,.021,10);
  for(let i=0;i<5;i++){
    const a=i*tau/5+phase;
    beam(tree,[Math.cos(a)*.11,.008,Math.sin(a)*.11],[0,.22,0],.023,wood,.020);
  }
  const shades=['#507740','#668742','#789649','#94aa54','#a4b55d'];
  for(let tier=0;tier<5;tier++){
    const n=(detailed?10:7)-Math.floor(tier*.75),reach=.33-tier*.056,cy=.31+tier*.137;
    for(let j=0;j<n;j++){
      const a=j*tau/n+tier*.64+phase, run=reach*(.94+.12*Math.sin(phase+j*2.3));
      const verts=[],ix=[],rings=detailed?6:4,segments=detailed?10:5;
      for(let k=0;k<rings;k++){
        const t=k/(rings-1), distance=run*(.025+.99*t), width=run*(.014+.41*Math.pow(Math.sin(t*Math.PI),.67)),thick=run*(.016+.23*Math.sin(Math.PI*t));
        const y=cy+run*(.61*(1-t)-.22*t*t);
        for(let m=0;m<segments;m++){
          const angle=m*tau/segments,spread=Math.cos(angle)*width;
          verts.push([Math.cos(a)*distance-Math.sin(a)*spread,y+Math.sin(angle)*thick,Math.sin(a)*distance+Math.cos(a)*spread]);
          if(k+1<rings){const u=k*segments+m,v=k*segments+(m+1)%segments;ix.push(u,v,u+segments,v,v+segments,u+segments);}
        }
      }
      const branch=faces(tree,verts,ix,shades[(tier+(j%5===0?1:0))%5]);branch.userData.surface='needle';
    }
  }
  ball(tree,[.006,.96,0],[.048,.099,.046],'#a1b75a',1);
}
// Silhouette LOD for trees beyond the interactive meadow.
export function grove(g,v){
  spruce(g,-.14,.09,1.08,v,false);spruce(g,.20,-.21,.73,v+1.1,false);
}
function oak(g,x,z,s,phase) {
  const tree=new Group();g.add(tree);tree.position.set(x,0,z);tree.scale.setScalar(s);
  beam(tree,[0,0,0],[0,.54,0],.067,wood,.039);
  for(let i=0;i<6;i++){
    const a=phase+i*2.4, r=i===5?0:.18, px=Math.cos(a)*r,pz=Math.sin(a)*r, y=.49+i*.037;
    beam(tree,[0,.26,0],[px,y,pz],.029,wood,.012);
    const foliage=['#538345','#709544','#8ead4e','#659143','#91a952'];
    ball(tree,[px,y,pz],[.185,.18,.176],foliage[i%5],2);
    for(let j=0;j<13;j++){
      const angle=j*2.4+phase+i, rise=(j+.5)/13, extent=.164*Math.sqrt(1-rise*rise);
      const puff=ball(tree,[px+Math.cos(angle)*extent,y+.16*rise-.025,pz+Math.sin(angle)*extent],
        [.076+j%3*.009,.071,.075],foliage[(i+j)%5],1);
      puff.userData.surface='needle';
    }
  }
}
export function forest(g,variant) {
  if(variant===0){spruce(g,-.16,-.1,.95,.7);spruce(g,.21,.17,.58,.1);}
  if(variant===1){oak(g,.06,-.06,1,.1);spruce(g,-.26,.18,.50,1.7);}
  if(variant===2){spruce(g,.15,-.13,.89,1.7);spruce(g,-.2,.11,.72,2.3);spruce(g,.26,.21,.45,1.1);}
  if(variant===3){oak(g,-.12,-.10,.95,1.6);oak(g,.22,.19,.55,2.3);}
}
export function roundGrove(g){
  for(const [x,z,s] of [[-.17,.07,1],[.22,-.15,.76]]){
    beam(g,[x,0,z],[x+.018,.57*s,z],.056*s,'#b28760',.029*s);
    for(let j=0;j<7;j++){
      const a=j*2.4, r=j===6?0:.158*s;
      const crown=ball(g,[x+r*Math.cos(a),(.49+.038*j)*s,z+r*Math.sin(a)],
        [.20*s,.235*s,.198*s],['#75aa78','#94bd79','#aecb79','#84b886'][j%4],1);
      crown.userData.surface='needle';
    }
  }
}

export function fruitTree(g,pear=false){
  const trunk=pear?1.08:.85,spread=pear?.23:.33;
  beam(g,[0,0,0],[.05,.32,0],.085,bark,.055,9);
  beam(g,[.05,.30,0],[-.035,trunk,0],.061,wood,.024,8);
  const profile=(pear?[[0,-.077],[.048,-.062],[.069,-.025],[.064,.009],[.035,.052],[.020,.087],[0,.089]]:
    [[0,-.054],[.045,-.054],[.071,-.022],[.074,.016],[.056,.051],[.027,.059],[0,.043]]).map(p=>new Vector2(...p));
  const leaves=pear?['#719545','#88a94c','#a4ba57']:['#487c4d','#619346','#86aa51'];
  for(let i=0;i<6;i++){
    const a=i*2.4+.4,r=i===5?0:spread, x=Math.cos(a)*r,z=Math.sin(a)*r;
    const y=trunk-.24+(i%3)*.09+(i===5?.30:0);
    beam(g,[.025,.29+i*.033,0],[x*.67,y-.19,z*.67],.034,wood,.024);
    beam(g,[x*.67,y-.19,z*.67],[x,y,z],.025,wood,.013);
    const crown=ball(g,[x,y+.06,z],[.235,pear?.255:.202,.225],leaves[i%3],1);
    crown.rotation.y=a;crown.userData.surface='needle';
    const tuft=ball(g,[x+.105*Math.cos(a+1.1),y+.17,z+.105*Math.sin(a+1.1)],[.165,.153,.17],leaves[(i+1)%3],1);
    tuft.userData.surface='needle';
    if(i===5)continue;
    for(const side of [-.64,.60]){
      const fx=x+.196*Math.cos(a+side),fz=z+.196*Math.sin(a+side),fy=y-.056+.035*side;
      const fruit=part(g,new LatheGeometry(profile,9),pear?(i%2?'#e7b746':'#c8ae42'):(i%2?'#d74832':'#b8322b'),[fx,fy,fz]);
      fruit.rotation.z=side*.23;
      beam(g,[fx,fy+(pear?.081:.047),fz],[fx+.015,fy+.117,fz],.006,bark,.004,4);
      faces(g,[[fx,fy+.10,fz],[fx+.037,fy+.125,fz+.014],[fx+.074,fy+.128,fz],[fx+.031,fy+.115,fz-.014]],[0,1,2,0,2,3],'#547d40');
    }
  }
}

export function birch(g){
  for(const [x,z,s] of [[-.14,0,1],[.16,.11,.77]]){
    const top=x+.12*s;
    beam(g,[x,0,z],[top,1.12*s,z],.050*s,'#e7dec5',.019*s,9);
    for(let j=0;j<7;j++){
      const t=(j+1)/10,a=j*2.4;
      ball(g,[x+t*(top-x)+Math.cos(a)*.034*s,t*1.12*s,z+Math.sin(a)*.034*s],[.024*s,.010*s,.021*s],'#685f4e',0);
    }
    for(let j=0;j<5;j++){
      const a=j*2.4,r=(4-j)*.050*s,bx=top+Math.cos(a)*r,bz=z+Math.sin(a)*r,y=(.71+j*.095)*s;
      beam(g,[x+.07*s,y-.22*s,z],[bx,y,bz],.018*s,'#c2b293',.009*s);
      const crown=ball(g,[bx,y+.09*s,bz],[.155*s,.234*s,.155*s],['#95b15b','#b0bf58','#c9cb6d'][j%3],1);
      crown.rotation.z=Math.cos(a)*.26;crown.userData.surface='needle';
      for(const side of [-1,1])ball(g,[bx+.115*s*Math.cos(a+side),y+.065*s,bz+.115*s*Math.sin(a+side)],
        [.085*s,.115*s,.08*s],side>0?'#bdc86b':'#9caf50',0);
    }
  }
}

export function willow(g){
  beam(g,[0,0,0],[.09,.54,0],.083,bark,.049,9);
  for(let j=0;j<8;j++){
    const a=j*2.4,x=Math.cos(a),z=Math.sin(a),y=.85+(j%3)*.070;
    beam(g,[.08,.40,0],[x*.26,y,z*.26],.032,wood,.014);
    const crown=ball(g,[x*.19,y,z*.19],[.204,.142,.204],j%2?'#739456':'#88ab66',1);
    crown.userData.surface='needle';
    for(const side of [-.16,.18]){
      const u=Math.cos(a+side),v=Math.sin(a+side);
      let last=[u*.23,y+.07,v*.23];
      for(let k=1;k<=5;k++){
        const t=k/5,r=.23+.22*Math.sin(t*1.7),h=y+.07-(.37+.055*(j%3)+side*.35)*t*t;
        const stem=[u*r,h,v*r];beam(g,last,stem,.008,'#7f9961',.005,4);last=stem;
        for(const dir of [-1,1]){
          const dx=-v*dir,dz=u*dir;
          faces(g,[stem,[stem[0]+dx*.052,h-.031,stem[2]+dz*.052],
            [stem[0]+dx*.076+u*.016,h-.141,stem[2]+dz*.076+v*.016],[stem[0]+u*.028,h-.055,stem[2]+v*.028]],
            [0,1,3,1,2,3],(j+k+dir)%3?'#87a96a':'#abc582');
        }
      }
    }
  }
}

export function woodlandMushrooms(g){
  for(const [x,z,s,color] of [[-.13,0,1,'#bd6944'],[.08,.045,.78,'#c8834a'],[.18,-.09,.55,'#b6593f']]){
    const y=.15*s;
    beam(g,[x,0,z],[x+.01*s,y,z],.027*s,'#ecdfbd',.020*s);
    ball(g,[x,y,z],[.096*s,.034*s,.093*s],'#efce96',1);
    ball(g,[x,y+.025*s,z],[.097*s,.066*s,.096*s],color,1);
    for(let j=0;j<3;j++)ball(g,[x+.049*s*Math.cos(j*2.4),y+.073*s,z+.048*s*Math.sin(j*2.4)],[.014*s,.007*s,.012*s],'#f4dfaf',0);
  }
}
export function fallenLog(g){
  beam(g,[-.38,.12,-.09],[.35,.14,.07],.13,bark,.102,10);
  beam(g,[.348,.14,.07],[.36,.14,.073],.090,honey,.086,10);
  beam(g,[.358,.14,.073],[.364,.14,.075],.05,wood,.048,9);
  beam(g,[-.07,.17,-.03],[-.17,.31,-.13],.043,bark,.024);
  for(let i=0;i<4;i++)ball(g,[-.26+.13*i,.237,.015*Math.sin(i*2)],[.091,.029,.061],i%2?'#8da35d':'#758950',1);
}
export function treeStump(g){
  beam(g,[0,0,0],[.018,.24,0],.155,bark,.117,10);
  beam(g,[.018,.239,0],[.018,.25,0],.109,honey,.11,10);
  ring(g,[.018,.252,0],.064,.005,wood);
  for(let j=0;j<4;j++)beam(g,[.009,.12,0],[.21*Math.cos(j*1.57),.012,.21*Math.sin(j*1.57)],.055,bark,.023);
}
export function cairn(g){
  for(const [x,y,w,h,color] of [[0,.064,.18,.079,'#898e82'],[.018,.168,.13,.061,'#b8ac91'],[-.004,.245,.084,.047,'#8d9991'],[.012,.295,.049,.032,'#d2c29d']]){
    const rock=ball(g,[x,y,0],[w,h,w*.77],color,1);rock.rotation.y=y*8;rock.userData.surface='stone';
  }
}
export function waymark(g){
  beam(g,[0,0,0],[.02,.54,0],.038,bark,.031,7);
  block(g,[.035,.432,0],[.35,.102,.051],wood,.012,[0,0,.06]);
  for(const z of [-.028,.028])faces(g,[[.021,.458,z],[.092,.436,z],[.026,.411,z],[.048,.436,z]],[0,1,3,1,2,3],'#f2d596');
}

// The wing meshes pivot at the shoulder. +Z is the direction of flight.
export function swallowBody(g){
  ball(g,[0,0,-.014],[.056,.055,.151],'#344a55',1);
  ball(g,[0,-.025,.018],[.049,.041,.111],'#e3d6b6',1);
  ball(g,[0,.023,.108],[.052,.052,.061],'#293f4d',1);
  ball(g,[0,.004,.145],[.037,.029,.028],'#b77149',1);
  faces(g,[[-.020,.023,.155],[.020,.023,.155],[0,.012,.201],[0,.031,.159]],[0,1,2,1,3,2,3,0,2],'#454035');
  for(const s of [-1,1]){
    ball(g,[s*.042,.038,.135],[.008,.008,.009],'#201f21',0);
    faces(g,[[s*.008,.004,-.104],[s*.041,.008,-.109],[s*.086,.009,-.280],[s*.023,-.002,-.173]],[0,1,3,1,2,3],'#354755');
  }
}
export function swallowWing(g,s){
  const root=[0,.002,.031],elbow=[s*.184,.034,.071],tip=[s*.405,-.017,-.115];
  const wrist=[s*.215,.008,-.031],back=[s*.057,-.006,-.094];
  faces(g,[root,elbow,wrist,back],[0,1,2,0,2,3],'#516674');
  faces(g,[elbow,tip,wrist],[0,1,2],'#314554');
  for(let i=0;i<3;i++){
    const x=.10+i*.063;
    faces(g,[[s*x,.005,-.022],[s*(x+.075),.012,-.019],[s*(x+.056),-.012,-.114+i*.010]],
      [0,1,2],i%2?'#41515a':'#56636a');
  }
}
export function stone(g,x,z,rx,rz,h,phase,moss=false) {
  const geo=rockGeometry(rx>.17?3:2), pos=geo.getAttribute('position'),colors=[];
  const stoneColor=new Color('#c3b8a2'), mossColor=new Color('#829452'),tint=new Color();
  for(let i=0;i<pos.count;i++){
    const u=pos.getX(i),v=pos.getY(i),w=pos.getZ(i);
    const stratum=Math.sin(u*5+w*4+v*3+phase), fissure=Math.cos(w*6-v*4+phase);
    const bulge=1+.10*stratum+.052*fissure;
    const high=Math.max(0,(v+.63)/1.63);
    pos.setXYZ(i, Math.sign(u)*Math.pow(Math.abs(u),.78)*rx*bulge+rx*.16*high,
      Math.max(0,high*h*(.96+.09*stratum)),Math.sign(w)*Math.pow(Math.abs(w),.85)*rz*bulge-rz*.12*high);
    const patch=moss?Math.max(0,Math.min(1,(-v*.8+w*.46+stratum*.36-.13)*2.4)):0;
    tint.copy(stoneColor).lerp(mossColor,patch).multiplyScalar(.89+.12*stratum+.08*high);
    colors.push(tint.r,tint.g,tint.b);
  }
  geo.computeVertexNormals();geo.setAttribute('color',new Float32BufferAttribute(colors,3));
  const rock=part(g,geo,'#ffffff',[x,0,z]);rock.userData.surface='stone';
  if(moss)for(let i=0;i<6;i++){
    const a=.5+i*.30+phase*.18,s=.12+.045*(i%3);
    ball(g,[x+rx*.81*Math.cos(a),.12*h+.024*Math.sin(i),z+rz*.83*Math.sin(a)],
      [rx*s,h*.07,rz*s],i%2?'#8e9e55':'#71904d',1);
  }
}
export function meadow(g,variant){
  for(let i=0;i<8;i++){
    const a=i*2.4, r=.046*Math.sqrt(i),x=r*Math.cos(a),z=r*Math.sin(a),y=.08+.055*(i%3);
    const tx=x+.065*Math.cos(a),tz=z+.065*Math.sin(a);
    faces(g,[[x-.014,0,z],[x+.014,0,z],[tx-.024,y*.60,tz],[tx+.024,y*.60,tz],[tx+.045*Math.cos(a),y,tz+.045*Math.sin(a)]],[0,1,2,1,3,2,2,3,4],i%2?'#759339':'#a8af4b');
    if(variant && i%3===0){
      const top=y+.065+.025*Math.sin(a);
      beam(g,[x,0,z],[tx,top,tz],.006,sage,.004);
      for(let j=0;j<7;j++){
        const b=j*tau/7+a, petal=ball(g,[tx+.027*Math.cos(b),top+.006*Math.sin(b),tz+.027*Math.sin(b)],[.028,.011,.014],variant===1?'#fff1cf':'#f4b74f',0);
        petal.rotation.y=-b;
      }
      ball(g,[tx,top+.008,tz],[.017,.014,.017],'#edb039',0);
    }
  }
}
export function reeds(g){
  for(let i=0;i<6;i++){
    const a=i*2.4,x=.09*Math.cos(a),z=.09*Math.sin(a),y=.16+.045*(i%3);
    beam(g,[x,0,z],[x*1.2,y,z*1.2],.009,'#7c8e48',.005);
    if(i%2===0) beam(g,[x*1.2,y-.02,z*1.2],[x*1.21,y+.05,z*1.21],.014,'#977247');
  }
}
export function post(g) {
  stone(g,0,0,.25,.21,.1,.5);
  beam(g,[0,.02,0],[.025,.57,0],.095,wood,.077,10);
  beam(g,[.025,.565,0],[.025,.58,0],.078,honey,.078,10);
  for(let j=0;j<3;j++) ring(g,[.02,.38+j*.029,0],.081,.017,rope);
  ring(g,[0,.48,.095],.058,.014,brass,[0,0,0]);
  cord(g,[[.02,.41,.09],[.18,.19,.13],[.14,.055,.21],[.06,.042,.23]],.014,rope);
}
export function cloud(g,v) {
  for(let i=0;i<6;i++){
    const a=i*2.4+v, r=i?.205:0;
    const p=part(g,new SphereGeometry(1,14,10),['#e3eef0','#fff6dd','#eaf3eb'][i%3],[Math.cos(a)*r,i?.22:.31,Math.sin(a)*r*.73]);
    p.scale.set(.22,.14+(i?0:.08),.18);
  }
}
export function pondIcon(g) {
  const water=ball(g,[0,.018,0],[.44,.048,.38],'#409eaa',2);
  water.rotation.y=.3;stone(g,-.32,.17,.11,.08,.11,1,true);
  const clump=new Group();g.add(clump);clump.position.set(.25,0,-.24);reeds(clump);
  for(let i=0;i<3;i++) cord(g,[[-.20+i*.07,.061,.03+i*.07],[-.09+i*.07,.066,.04+i*.07],[i*.07,.059,.025+i*.07]],.009,'#a9ded2');
}
