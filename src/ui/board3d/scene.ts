import * as T from 'three';
import { facilityLayer, occupied, placementOrigin } from '../../engine';
import { boardCamera } from './camera';
import { facilityInstance, facilityParts, landscape } from './landscape';
import { smokePlumes } from './smoke';
import type { BoardView, ModelInstance, Quality } from './landscape';
import { disposeBatches, lightScene, modelBatches } from './models';
import type { ArtLibrary } from './models';
import { terrainMesh } from './terrainMesh';
import { atmosphere } from './atmosphere';
import { campEffects } from './campEffects';
import { groundFeedback } from './groundFeedback';
import { smooth } from './countryside';
import { passingSwallows } from './birds';

export function createBoardScene(stage:HTMLElement,canvas:HTMLCanvasElement,assets:ArtLibrary,quality:Quality,initial:BoardView,onFailure:()=>void) {
  const renderer=new T.WebGLRenderer({canvas,alpha:false,antialias:quality!=='low',powerPreference:'high-performance'});
  const scene=new T.Scene(), size=initial.level.size;
  lightScene(scene,renderer,size,quality);
  renderer.setClearColor(0xd8e9ca,1);renderer.shadowMap.autoUpdate=false;
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  let disposed=false,frame=0,timer=0,last=0,phase=0,flightTime=0,slowFrames=0,dirty=true;
  let density=Math.min(devicePixelRatio,quality==='low'?1:quality==='medium'?1.5:2);
  renderer.setPixelRatio(density);
  let layout:ReturnType<typeof landscape>|undefined, weather:ReturnType<typeof atmosphere>|undefined;
  let birds:ReturnType<typeof passingSwallows>|undefined;
  const crowns:{x:number;z:number;radius:number;top:number}[]=[];
  function obstacleTop(x:number,z:number){
    const floor=layout?.height(x,z)??0;
    let clearance=floor;
    for(const crown of crowns){
      const dx=x-crown.x,dz=z-crown.z,r=crown.radius+.65;
      if(Math.abs(dx)>r||Math.abs(dz)>r)continue;
      const edge=smooth(crown.radius*.55,r,Math.hypot(dx,dz));
      clearance=Math.max(clearance,crown.top+(floor-crown.top)*edge);
    }
    return clearance;
  }
  const camera=boardCamera(stage,size,invalidate,obstacleTop);
  const clock={value:0},effects=campEffects(clock);
  function solid(source:T.MeshStandardMaterial,id:string){
    if(id==='flame')return effects.flame;
    if(id==='pool_surface')return effects.pool;
    return source;
  }
  const contactGeometry=new T.PlaneGeometry(1,1).rotateX(-Math.PI/2);
  const contactMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,
    vertexShader:'varying vec2 spot; void main(){spot=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec2 spot; void main(){float a=1.-smoothstep(.0,1.,dot(spot,spot));gl_FragColor=vec4(.18,.19,.09,a*a*.30);}'});
  let contacts:T.InstancedMesh|undefined,staticObjects:ModelInstance[]=[],placedObjects:ModelInstance[]=[];
  const previewMaterials=[0x88db9a,0xed8267,0xf7c76d].map(color=>new T.MeshStandardMaterial({color,transparent:true,opacity:.59,roughness:.8,depthWrite:false}));
  let ground:ReturnType<typeof terrainMesh>|undefined, nature=new T.Group(), buildings=new T.Group(), preview=new T.Group();
  let previous:BoardView|undefined, lastPreview='', water=false;
  let smoke:ReturnType<typeof smokePlumes>;
  let feedback:ReturnType<typeof groundFeedback>|undefined;
  let animated:{mesh:T.InstancedMesh; originals:T.Matrix4[]}[]=[];
  const matrix=new T.Matrix4(),animation=new T.Matrix4();
  function invalidate(){
    dirty=true;window.clearTimeout(timer);
    if(!disposed&&!document.hidden&&!frame)frame=requestAnimationFrame(render);
  }
  function resize(){
    const width=stage.clientWidth,height=stage.clientHeight;
    if(!width||!height)return;
    renderer.setSize(width,height,false);camera.resize(width,height);invalidate();
  }
  function setView(view:BoardView) {
    const old=previous, {level,layer}=view;
    const landscapeChanged=!old||old.layer!==layer||old.level.terrain!==level.terrain||old.level.sky?.anchors!==level.sky?.anchors||old.level.sky?.clouds!==level.sky?.clouds;
    const piecesChanged=!old||old.placements!==view.placements||old.level.pieces!==level.pieces||old.layer!==layer;
    if(landscapeChanged){
      ground?.dispose();disposeBatches(nature);
      layout=landscape(level,layer,quality,true);
      ground=terrainMesh(layout,assets.meadow,assets.granite,quality);water=layout.hasWater;
      weather?.dispose();weather=atmosphere(size,layout.seed,layout.sky,layout.country.palette.haze);scene.add(weather.group);
      birds?.dispose();birds=passingSwallows(layout,assets,quality,obstacleTop);scene.add(birds.group);
      scene.background=new T.Color(weather.haze);scene.fog=new T.Fog(weather.haze,23+size*.18,62+size);
      staticObjects=ground.objects;
      crowns.length=0;
      for(const obj of staticObjects){
        if(!layout.country.outside(obj.x,obj.z)|| !/^(grove_|round_grove|forest_|rock_|apple_tree|pear_tree|birch|willow)/.test(obj.model))continue;
        const geometry=assets.models.get(obj.model)!.geometry;
        if(!geometry.boundingBox)geometry.computeBoundingBox();
        const {min,max}=geometry.boundingBox!,s=obj.scale??1;
        crowns.push({x:obj.x,z:obj.z,radius:Math.hypot(max.x-min.x,max.z-min.z)*s*.5,top:(obj.y??0)+max.y*s});
      }
      if(old)camera.refresh();
      nature=modelBatches(assets,staticObjects,solid);scene.add(ground.group,nature);
    }
    if(piecesChanged){
      disposeBatches(buildings);
      const instances:ModelInstance[]=[];
      for(const at of view.placements){
        const piece=level.pieces.find(p=>p.id===at.id)!;
        if(facilityLayer(piece.kind)!==layer)continue;
        instances.push(...facilityParts(facilityInstance(piece,at)));
      }
      placedObjects=instances;buildings=modelBatches(assets,instances,solid);scene.add(buildings);
      smoke?.dispose();smoke=quality==='low'?undefined:smokePlumes(instances,clock);if(smoke)scene.add(smoke.mesh);
    }
    if(landscapeChanged||piecesChanged){
      renderer.shadowMap.needsUpdate=true;
      contacts?.removeFromParent();contacts?.dispose();
      const major=[...staticObjects,...placedObjects].filter(obj=>!/^(meadow|reeds|pebble|flame|propeller|pennant|pool_surface|footbridge|mushrooms|stump|fallen_log|cairn|waymark)/.test(obj.model)&&
        !(obj.model.startsWith('cloud_')&&layout!.country.outside(obj.x,obj.z)));
      contacts=new T.InstancedMesh(contactGeometry,contactMaterial,major.length);
      major.forEach((obj,i)=>{
        const footprint=obj.model.split('_')[1], scale=obj.scale??1, pivot=new T.Object3D();
        const w=footprint==='long'?2.8:footprint==='domino'?1.82:footprint==='el'?1.65:.96;
        pivot.position.set(obj.x,(obj.y??.012)+.027,obj.z);pivot.rotation.y=obj.angle??0;pivot.scale.set(w*scale,1,(footprint==='el'?1.65:.87)*scale);
        pivot.updateMatrix();contacts!.setMatrixAt(i,pivot.matrix);
      });
      scene.add(contacts);
      animated=[...nature.children,...buildings.children].filter((n):n is T.InstancedMesh=>n instanceof T.InstancedMesh&&(/^(propeller|pennant|balloon_single|kite_long)$/.test(n.name)||quality!=='low'&&/^(reeds|meadow_1|forest_)/.test(n.name))).map(mesh=>({
        mesh,originals:Array.from({length:mesh.count},(_,i)=>{const m=new T.Matrix4();mesh.getMatrixAt(i,m);return m;})
      }));
    }
    const suggestion=view.hint, selected=suggestion?level.pieces.find(p=>p.id===suggestion.id):view.selected;
    const rotation=suggestion?.rotation??view.rotation??0;
    const origin=suggestion??(selected&&view.hover?placementOrigin(selected.shape,rotation,view.hover):null);
    const ghost=selected&&origin&&(suggestion||!view.obstructed)&&facilityLayer(selected.kind)===layer?facilityInstance(selected,{...origin,rotation}):undefined;
    const material=suggestion?2:view.blocked?1:0;
    const token=ghost?[ghost.model,ghost.x,ghost.z,ghost.angle,material].join('/'):'';
    if(token!==lastPreview){
      disposeBatches(preview);
      const instances=ghost?facilityParts(ghost):[];
      preview=modelBatches(assets,instances,previewMaterials[material],false);scene.add(preview);lastPreview=token;
    }
    if(layout&&(landscapeChanged||piecesChanged||old?.hover!==view.hover||old?.selected!==view.selected||old?.rotation!==view.rotation||old?.ruleHints!==view.ruleHints||old?.hintRegion!==view.hintRegion||old?.finished!==view.finished)){
      feedback?.dispose();feedback=groundFeedback(view,layout);scene.add(feedback.mesh);invalidate();
    }
    if(view.finished&&!old?.finished){
      const cells=view.placements.flatMap(at=>{const p=level.pieces.find(p=>p.id===at.id)!;return facilityLayer(p.kind)===layer?occupied(p,at):[];});
      if(cells.length){
        const xs=cells.map(p=>p.c),zs=cells.map(p=>p.r),xmin=Math.min(...xs),xmax=Math.max(...xs),zmin=Math.min(...zs),zmax=Math.max(...zs);
        camera.celebrate((xmin+xmax+1)/2,(zmin+zmax+1)/2,Math.min(1.72,size/(2.0+Math.max(xmax-xmin,zmax-zmin))));
      }
    } else if(!view.finished&&old?.finished)camera.leaveCelebration();
    previous=view;
    if(landscapeChanged||piecesChanged||token||old?.hover!==view.hover||old?.selected!==view.selected||old?.hint!==view.hint||stage.querySelector('.world-cell-label'))invalidate();
  }
  const labelPosition=new T.Vector3();
  function render(now:number){
    frame=0;if(disposed||document.hidden)return;
    const elapsed=last?(now-last)/1000:.016,dt=Math.min(.5,elapsed);last=now;
    if(!motion.matches)flightTime+=elapsed;
    const nextFlight=birds?.update(flightTime,!motion.matches)??Infinity;
    const moving=camera.step(dt,motion.matches), ambient=!motion.matches&&(quality!=='low'||water||animated.length>0||placedObjects.some(p=>p.model==='flame'||p.model==='pool_surface'));
    if(smoke)smoke.mesh.visible=!motion.matches;
    if(ambient){
      phase+=Math.min(dt,.24);clock.value=phase;
      weather?.tick(phase);
      if(ground)ground.time.value=phase;
      for(const {mesh,originals} of animated) {
        originals.forEach((base,i)=>{
          const wave=Math.sin(phase*1.4+i*1.8);
          switch(mesh.name){
            case 'propeller': animation.makeRotationX(phase*6.4);break;
            case 'pennant': animation.makeRotationY(.34*wave+.14*Math.sin(phase*3.7));break;
            case 'balloon_single': animation.makeRotationZ(.028*wave).setPosition(0,.026*wave,0);break;
            case 'kite_long': animation.makeRotationX(.052*wave);break;
            default: animation.makeRotationZ((mesh.name.startsWith('forest')?.012:.046)*wave);
          }
          mesh.setMatrixAt(i,matrix.multiplyMatrices(base,animation));
        });
        mesh.instanceMatrix.needsUpdate=true;
      }
    }
    if(dirty||moving||ambient){
      const label=stage.querySelector<HTMLElement>('.world-cell-label'), inspect=previous?.hover;
      if(label&&inspect){
        labelPosition.set(inspect.c+.5,.64,inspect.r+.5).project(camera.camera);
        label.style.visibility=labelPosition.z>=-1&&labelPosition.z<=1?'visible':'hidden';
        label.style.left=(labelPosition.x+1)*50+'%';label.style.top=(1-labelPosition.y)*50+'%';
      }
      renderer.render(scene,camera.camera);dirty=false;
      canvas.dataset.draws=String(renderer.info.render.calls);canvas.dataset.triangles=String(renderer.info.render.triangles);
      canvas.dataset.ready='true';
    }
    if(moving){
      slowFrames=dt>.105?slowFrames+1:0;
      if(slowFrames>=24&&density>.76){density=Math.max(.75,density*.75);renderer.setPixelRatio(density);slowFrames=0;}
      else if(slowFrames>=42){onFailure();return;}
      frame=requestAnimationFrame(render);
    }else{
      slowFrames=0;
      if(ambient||nextFlight===0)timer=window.setTimeout(invalidate,quality==='high'?45:quality==='medium'?70:150);
      else if(Number.isFinite(nextFlight))timer=window.setTimeout(invalidate,Math.ceil(nextFlight*1000));
    }
  }
  const visibility=()=>{last=0;window.clearTimeout(timer);cancelAnimationFrame(frame);frame=0;if(!document.hidden)invalidate();};
  const lost=(e:Event)=>{e.preventDefault();if(!disposed)onFailure();};
  canvas.addEventListener('webglcontextlost',lost);document.addEventListener('visibilitychange',visibility);
  motion.addEventListener('change',visibility);
  let resizeFrame=0;
  const observer=new ResizeObserver(()=>{if(!resizeFrame)resizeFrame=requestAnimationFrame(()=>{resizeFrame=0;resize();});});observer.observe(stage);
  function dispose(){
    disposed=true;observer.disconnect();cancelAnimationFrame(resizeFrame);motion.removeEventListener('change',visibility);
    document.removeEventListener('visibilitychange',visibility);canvas.removeEventListener('webglcontextlost',lost);
    window.clearTimeout(timer);cancelAnimationFrame(frame);camera.dispose();ground?.dispose();
    for(const group of [nature,buildings,preview])disposeBatches(group);
    smoke?.dispose();weather?.dispose();birds?.dispose();effects.dispose();
    feedback?.dispose();
    contacts?.dispose();contactMaterial.dispose();contactGeometry.dispose();
    for(const mat of previewMaterials)mat.dispose();
    scene.traverse(node=>{if(node instanceof T.DirectionalLight)node.dispose();});
    renderer.dispose();renderer.forceContextLoss();delete canvas.dataset.ready;
  }
  try {setView(initial);resize();} catch(error){dispose();throw error;}
  return {setView,preset:camera.preset,dispose};
}
