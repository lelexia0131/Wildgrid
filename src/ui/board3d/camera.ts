import { Matrix4, PerspectiveCamera, Plane, Raycaster, Vector2, Vector3 } from 'three';
import { clamp } from './landscape';

export type CameraPreset = 'home' | 'top' | 'turn';
const home = { yaw: .18, pitch: .82, zoom: 1, x: 0, z: 0 };
const cellPixels=64, planeY=.014;
// Ground area varies with the square of the viewing distance.
const minZoom=.68/Math.sqrt(.8),maxZoom=2.8;

// Project the real ground plane onto the semantic button grid. Homogeneous w matters
// at shallow angles: a six-pixel movement can pick quite different depths near the horizon.
export function groundTransform(camera:PerspectiveCamera,width:number,height:number){
  const e=new Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).elements;
  const column=(x:number,y:number,w:number,scale:number)=>[(x+w)*width/(2*scale),(w-y)*height/(2*scale),0,w/scale];
  return 'matrix3d('+[...column(e[0],e[1],e[3],cellPixels),...column(e[8],e[9],e[11],cellPixels),0,0,1,0,
    ...column(e[12]+planeY*e[4],e[13]+planeY*e[5],e[15]+planeY*e[7],1)].join(',')+')';
}

export function boardCamera(stage:HTMLElement,size:number,invalidate:()=>void,floorAt:(x:number,z:number)=>number) {
  const camera=new PerspectiveCamera(39,1,.045,180),view={...home},goal={...home};
  const board=stage.querySelector<HTMLElement>('.board')!;
  const rows=stage.querySelectorAll<HTMLElement>('.row-clues .clue'),cols=stage.querySelectorAll<HTMLElement>('.column-clues .clue');
  const plane=new Plane(new Vector3(0,1,0),-planeY),ray=new Raycaster(),pointer=new Vector2(),scratch=new Vector3();
  let width=1,height=1,left=0,right=0,top=0,bottom=0,fitDistance=15;
  let wheelAnchor:{x:number;y:number;point:Vector3}|undefined,savedView:typeof home|undefined;
  function screen(x:number,z:number) {
    scratch.set(x,planeY,z).project(camera);
    return {x:(scratch.x+1)*width/2,y:(1-scratch.y)*height/2,visible:scratch.z>=-1&&scratch.z<=1};
  }
  function update(){
    const cx=size/2+view.x,cz=size/2+view.z,s=Math.sin(view.yaw),c=Math.cos(view.yaw);
    const distance=fitDistance/view.zoom,horizontal=distance*Math.cos(view.pitch);
    const x=cx+s*horizontal,z=cz+c*horizontal;
    const eyeHeight=1-Math.min(1,view.pitch/.36);
    const targetY=.18+.80*eyeHeight*eyeHeight,rise=distance*Math.sin(view.pitch);
    // Keep the middle of the clearing visible over ridges and nearby tree crowns.
    let lift=0;
    const steps=Math.ceil(horizontal/.85);
    for(let i=1;i<=steps;i++){
      const t=i/steps,px=cx+(x-cx)*t,pz=cz+(z-cz)*t,side=(1-t)*size*.24;
      const ground=Math.max(floorAt(px,pz),floorAt(px+c*side,pz-s*side),floorAt(px-c*side,pz+s*side));
      lift=Math.max(lift,(ground+.16+.48*t-targetY)/Math.max(.20,t)-rise);
    }
    camera.up.set(-s*Math.sin(view.pitch),Math.cos(view.pitch),-c*Math.sin(view.pitch));
    camera.position.set(x,targetY+rise+lift,z);
    camera.lookAt(cx,targetY+lift,cz);camera.aspect=width/height;camera.updateProjectionMatrix();camera.updateMatrixWorld();
    const centerX=(width+left-right)/2,centerY=top+(height-top-bottom)*(.50-.13*eyeHeight*eyeHeight);
    camera.projectionMatrix.elements[8]=1-2*centerX/width;
    const verticalOffset=scratch.set(cx,targetY,cz).project(camera).y;
    camera.projectionMatrix.elements[9]=2*centerY/height-1+verticalOffset;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    board.style.transform=groundTransform(camera,width,height);
    stage.dataset.cameraView=view.pitch<.012?'level':'map';
    const p=screen(cx,cz),px=screen(cx+1,cz),pz=screen(cx,cz+1);
    const a=(px.x-p.x)/cellPixels,b=(px.y-p.y)/cellPixels,d=(pz.y-p.y)/cellPixels,k=(pz.x-p.x)/cellPixels,det=a*d-b*k;
    board.style.setProperty('--upright',Math.abs(det)>.035?'matrix('+[d/det,-b/det,-k/det,a/det,0,0].join(',')+')':'none');
    stage.style.setProperty('--clue-size',clamp(height*view.zoom/fitDistance*.58,14,27)+'px');
    const edge=c>=0?-.42:size+.42;
    for(let i=0;i<size;i++){
      const row=screen(edge,i+.5),col=screen(i+.5,edge);
      for(const [el,v] of [[rows[i],row],[cols[i],col]] as const){
        el.style.visibility=v.visible?'':'hidden';
        el.style.transform='translate('+v.x+'px,'+v.y+'px) translate(-50%,-50%)';
      }
    }
  }
  function groundAt(x:number,y:number){
    pointer.set(x/width*2-1,1-y/height*2);ray.setFromCamera(pointer,camera);
    if(ray.ray.direction.y>-.045)return null;
    return ray.ray.intersectPlane(plane,new Vector3());
  }
  function pin(from:Vector3|null,x:number,y:number){
    const to=groundAt(x,y);if(!from||!to)return false;
    view.x=goal.x=clamp(view.x+from.x-to.x,-size*.90,size*.90);
    view.z=goal.z=clamp(view.z+from.z-to.z,-size*.90,size*.90);return true;
  }
  function resize(w:number,h:number){
    width=w;height=h;
    const css=getComputedStyle(stage);
    left=parseFloat(css.paddingLeft);right=parseFloat(css.paddingRight);top=parseFloat(css.paddingTop);bottom=parseFloat(css.paddingBottom);
    const span=Math.max((size+1.22)*1.30*height/Math.max(100,width-left-right),(size+1.26)*1.03*height/Math.max(100,height-top-bottom));
    fitDistance=span/(2*Math.tan(camera.fov*Math.PI/360));
    wheelAnchor=undefined;update();
  }
  const points=new Map<number,{x:number;y:number;startX:number;startY:number;pan:boolean}>();
  let moved=false,suppressUntil=0;
  function down(e:PointerEvent){
    if((e.target as Element).closest('.camera-tools'))return;
    if(!points.size){moved=false;suppressUntil=0;}
    wheelAnchor=undefined;Object.assign(goal,view);
    const rect=stage.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;
    points.set(e.pointerId,{x,y,startX:x,startY:y,pan:e.button===1||e.button===2||e.shiftKey});
    if(points.size>1)moved=true;
    if(e.button===1)e.preventDefault();
  }
  function move(e:PointerEvent){
    const p=points.get(e.pointerId);if(!p)return;
    const rect=stage.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top,dx=x-p.x,dy=y-p.y;
    if(!moved&&Math.hypot(x-p.startX,y-p.startY)<6)return;
    moved=true;stage.dataset.gesture='camera';if(!stage.hasPointerCapture(e.pointerId))stage.setPointerCapture(e.pointerId);
    const other=[...points.entries()].find(([id])=>id!==e.pointerId)?.[1];
    if(other){
      const mid=groundAt((p.x+other.x)/2,(p.y+other.y)/2);
      const angle=Math.atan2(y-other.y,x-other.x)-Math.atan2(p.y-other.y,p.x-other.x);
      view.yaw=goal.yaw+=Math.atan2(Math.sin(angle),Math.cos(angle));
      const before=Math.hypot(p.x-other.x,p.y-other.y);
      if(before>5)view.zoom=goal.zoom=clamp(view.zoom*Math.hypot(x-other.x,y-other.y)/before,minZoom,maxZoom);
      update();pin(mid,(x+other.x)/2,(y+other.y)/2);
    }else if(p.pan){
      if(!pin(groundAt(p.x,p.y),x,y)){
        const scale=fitDistance/view.zoom/height,c=Math.cos(view.yaw),s=Math.sin(view.yaw);
        view.x=goal.x=clamp(view.x-scale*(dx*c+dy*s),-size*.90,size*.90);
        view.z=goal.z=clamp(view.z-scale*(-dx*s+dy*c),-size*.90,size*.90);
      }
    }else{
      view.yaw=goal.yaw-=dx*.0065;
      view.pitch=goal.pitch=clamp(view.pitch+dy*.0048,0,Math.PI/2);
    }
    p.x=x;p.y=y;update();e.preventDefault();invalidate();
  }
  function end(e:PointerEvent){
    if(!points.delete(e.pointerId))return;
    if(stage.hasPointerCapture(e.pointerId))stage.releasePointerCapture(e.pointerId);
    if(moved)suppressUntil=performance.now()+450;
    if(!points.size)delete stage.dataset.gesture;
  }
  function click(e:Event){
    if((e.target as Element).closest('.camera-tools'))return;
    if((moved&&points.size)||performance.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation();}
  }
  function wheel(e:WheelEvent){
    e.preventDefault();const rect=stage.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top,point=groundAt(x,y);
    wheelAnchor=point?{x,y,point}:undefined;
    goal.zoom=clamp(goal.zoom*Math.exp(-clamp(e.deltaY*(e.deltaMode===1?15:1),-160,160)*.0018),minZoom,maxZoom);invalidate();
  }
  const listeners=new AbortController(),opts={signal:listeners.signal,capture:true};
  stage.addEventListener('pointerdown',down,opts);stage.addEventListener('pointermove',move,opts);
  stage.addEventListener('pointerup',end,opts);stage.addEventListener('pointercancel',end,opts);
  stage.addEventListener('click',click,opts);stage.addEventListener('contextmenu',e=>{click(e);e.preventDefault();},opts);
  stage.addEventListener('wheel',wheel,{...opts,passive:false});
  return {camera,resize,refresh:update,
    celebrate(x:number,z:number,zoom:number){
      savedView??={...view};wheelAnchor=undefined;goal.x=x-size/2;goal.z=z-size/2;goal.zoom=zoom;goal.pitch=.77;invalidate();
    },
    leaveCelebration(){if(savedView){Object.assign(goal,savedView);savedView=undefined;invalidate();}},
    preset(preset:CameraPreset){
      wheelAnchor=undefined;
      if(preset==='home'){Object.assign(goal,home);goal.yaw=view.yaw+Math.atan2(Math.sin(home.yaw-view.yaw),Math.cos(home.yaw-view.yaw));}
      if(preset==='top')goal.pitch=Math.PI/2;
      if(preset==='turn')goal.yaw=(Math.round(goal.yaw/(Math.PI/2))+1)*Math.PI/2;
      invalidate();
    },
    step(dt:number,reduce:boolean){
      let active=false;
      for(const k of Object.keys(goal) as (keyof typeof goal)[]){
        const delta=goal[k]-view[k];if(Math.abs(delta)<.0001)continue;
        view[k]=reduce?goal[k]:view[k]+delta*(1-Math.exp(-Math.max(.008,dt)*16));active=true;
      }
      if(active){update();if(wheelAnchor&&pin(wheelAnchor.point,wheelAnchor.x,wheelAnchor.y))update();}
      else wheelAnchor=undefined;
      return active;
    },
    dispose(){
      listeners.abort();board.style.removeProperty('transform');board.style.removeProperty('--upright');
      for(const el of [...rows,...cols]){el.style.removeProperty('transform');el.style.removeProperty('visibility');}
      delete stage.dataset.cameraView;delete stage.dataset.gesture;
    }};
}
