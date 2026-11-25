import * as T from 'three';
import { adventureFacilityLibrary, facilityLayer, getLevelById, offsets } from '../../src/engine';
import { facilityInstance, facilityParts, landscape } from '../../src/ui/board3d/landscape';
import type {Level,Terrain} from '../../src/engine';
import { campEffects } from '../../src/ui/board3d/campEffects';
import { disposeBatches, lightScene, loadArtLibrary, modelBatches } from '../../src/ui/board3d/models';
import { terrainMesh } from '../../src/ui/board3d/terrainMesh';

const assets=await loadArtLibrary(), renderer=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
document.body.append(renderer.domElement);renderer.setClearColor(0,0);
const clock={value:.63},effects=campEffects(clock);
const materialFor=(base:T.MeshStandardMaterial,id:string)=>id==='pool_surface'?effects.pool:id==='flame'?effects.flame:base;
const scene=new T.Scene();lightScene(scene,renderer,0,'high');
const camera=new T.OrthographicCamera(-1,1,1,-1,.01,60);
const shadow=new T.Mesh(new T.PlaneGeometry(35,35),new T.ShadowMaterial({opacity:.18}));
shadow.rotation.x=-Math.PI/2;shadow.receiveShadow=true;scene.add(shadow);
function take(group:T.Object3D,width:number,height:number,yaw:number,pitch:number,plan?:[number,number]){
  renderer.setSize(width,height,false);
  const bounds=new T.Box3().setFromObject(group),center=bounds.getCenter(new T.Vector3());
  const sun=scene.children.find(o=>o instanceof T.DirectionalLight) as T.DirectionalLight;
  const radius=bounds.getSize(new T.Vector3()).length()*.55+.45;
  sun.position.set(center.x-4,8,center.z+3.3);sun.target.position.copy(center);
  Object.assign(sun.shadow.camera,{left:-radius,right:radius,top:radius,bottom:-radius});sun.shadow.camera.updateProjectionMatrix();
  const dir=new T.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));
  if(plan){center.set(0,0,0);dir.set(0,1,0);}
  camera.up.set(0,plan?0:1,plan?-1:0);camera.position.copy(center).addScaledVector(dir,18);camera.lookAt(center);camera.updateMatrixWorld();
  let halfW=0,halfH=0;
  for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
    const corner=new T.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse);
    halfW=Math.max(halfW,Math.abs(corner.x));halfH=Math.max(halfH,Math.abs(corner.y));
  }
  const span=plan?plan[1]/2:Math.max(halfH,halfW*height/width)*1.065;
  camera.top=span;camera.bottom=-span;camera.right=plan?plan[0]/2:span*width/height;camera.left=-camera.right;camera.updateProjectionMatrix();
  scene.add(group);renderer.render(scene,camera);group.removeFromParent();
  return renderer.domElement.toDataURL('image/png').split(',')[1];
}
export const jobs:{id:string;rotation:number;plan?:boolean}[]=[];
for(const p of adventureFacilityLibrary)for(let rotation=0;rotation<(p.shape==='single'?1:4);rotation++){
  jobs.push({id:p.id,rotation});
  if(p.shape!=='single')jobs.push({id:p.id,rotation,plan:true});
}
for(const id of ['water','forest_0','rock_0','anchor','cloud_0'])jobs.push({id,rotation:0});
export function icon({id,rotation,plan}:typeof jobs[number]){
  const instances=facilityParts({model:id,x:0,z:0,angle:-rotation*Math.PI/2});
  const batch=modelBatches(assets,instances,materialFor);
  const piece=adventureFacilityLibrary.find(p=>p.id===id),cells=offsets(piece?.shape??'single',rotation);
  const w=1+Math.max(...cells.map(p=>p.c)),h=1+Math.max(...cells.map(p=>p.r));
  shadow.visible=!plan;shadow.position.y=-.009;
  const result=take(batch,plan?128*w:288,plan?128*h:256,.44,.55,plan?[w,h]:undefined);
  disposeBatches(batch);return result;
}

const tableaux=[
  {map:['fww','..w','m..'],items:[['camp_single',1,1],['fire_single',2,1],['tower_single',2,2]]},
  {map:['f..w','f..w','...w','m...'],items:[['cabin_el',1,0],['fire_single',2,2],['camp_single',1,2],['picnic_domino',3,2]]},
  {map:['mm.w','m..w','f...','....'],items:[['tower_single',1,1],['foodTruck_single',2,3],['camp_domino',2,1],['pool_single',1,2]]},
  {map:['m...','....','f..w','..ww'],items:[['balloon_single',0,0],['airship_domino',0,2],['kite_long',1,0],['camp_single',2,2],['tower_single',1,3]]},
];
function tableau(i:number){
  const {map,items}=tableaux[i],terrain:Terrain[]=[],names={f:'forest',m:'rock',w:'water'} as const;
  map.forEach((line,r)=>[...line].forEach((ch,c)=>{if(ch in names)terrain.push({r,c,kind:names[ch as keyof typeof names]});}));
  const level:Level={id:210+i,size:map.length,terrain,pieces:[],name:'',chapter:'',tip:'',rows:[],cols:[]};
  const objects=items.flatMap(([id,r,c])=>{
    const piece=adventureFacilityLibrary.find(p=>p.id===id)!;
    const obj=facilityInstance(piece,{r:Number(r),c:Number(c),rotation:0});
    if(facilityLayer(piece.kind)==='sky')obj.y=.24;
    return facilityParts(obj);
  });
  return {level,objects};
}
export function scenery(id:string,frame?:number){
  const day=id.startsWith('day-')?Number(id.slice(4)):0;
  const chapter=id==='home'?0:Number(id.split('-')[1]);
  const {level,objects}=day?{level:getLevelById(day)!,objects:[]}:tableau(chapter);
  const group=new T.Group(),layout=landscape(level,'ground',day?'medium':'high');
  const ground=terrainMesh(layout,assets.meadow,assets.granite,'high',Boolean(day));
  const angle=(frame??0)*Math.PI*2;
  // A periodic sample keeps the water, firelight and camera continuous at the loop seam.
  clock.value=.63+1.6*Math.sin(angle);
  ground.time.value=1.8*Math.sin(angle);
  if(day && level.sky)for(const cloud of level.sky.clouds)objects.push({model:'cloud_0',x:cloud.c+.5,z:cloud.r+.5,y:.38,scale:.65});
  const batch=modelBatches(assets,[...layout.objects,...objects],materialFor);group.add(ground.group,batch);
  shadow.visible=true;shadow.position.y=-.39;
  const result=take(group,frame!==undefined?720:day?320:id==='home'?1000:640,frame!==undefined?468:day?210:id==='home'?650:440,
    day?.24+(day%5)*.08:.48+.078*Math.sin(angle),day?.90:.65+.020*(1-Math.cos(angle)));
  ground.dispose();disposeBatches(batch);return result;
}
