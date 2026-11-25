import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import libraryUrl from '../../assets/3d/campsite.glb?url';
import rockUrl from '../../assets/3d/rocks.glb?url';
import meadowUrl from '../../assets/3d/meadow.webp';
import graniteUrl from '../../assets/3d/granite.webp';
import type { ModelInstance, Quality } from './landscape';

export interface ArtLibrary { models: Map<string,T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>>; meadow: T.Texture; granite:T.Texture }
let pending: Promise<ArtLibrary> | undefined;
export function loadArtLibrary(): Promise<ArtLibrary> {
  return pending ??= Promise.all([new GLTFLoader().loadAsync(libraryUrl),new GLTFLoader().loadAsync(rockUrl),new T.TextureLoader().loadAsync(meadowUrl),new T.TextureLoader().loadAsync(graniteUrl)]).then(([file,rocks,meadow,granite])=>{
    for(const texture of [meadow,granite]){
      texture.colorSpace=T.SRGBColorSpace; texture.wrapS=texture.wrapT=T.RepeatWrapping; texture.anisotropy=4;
    }
    const models: ArtLibrary['models']=new Map();
    for(const node of [...file.scene.children,...rocks.scene.children]) if(node instanceof T.Mesh) models.set(node.name,node);
    for(const id of ['camp_single','rock_0'])if(!models.get(id)?.material.map)throw new Error('Missing embedded material for '+id);
    return {models,meadow,granite};
  }).catch(error=>{ pending=undefined; throw error; });
}
export function lightScene(scene:T.Scene, renderer:T.WebGLRenderer, size:number, quality:Quality) {
  scene.add(new T.HemisphereLight(0xfff3dd,0xb1c6a8,1.48));
  const sun=new T.DirectionalLight(0xffe2b0,2.92);
  sun.position.set(size*.5-5.2,7,size*.5+3.7); sun.target.position.set(size*.5,0,size*.5);
  sun.castShadow=quality!=='low'; sun.shadow.mapSize.setScalar(quality==='high'?2048:1024);
  const radius=size*.76+1.2;
  Object.assign(sun.shadow.camera,{left:-radius,right:radius,top:radius,bottom:-radius,near:.1,far:30});
  sun.shadow.normalBias=.012; sun.shadow.bias=-.00022;sun.shadow.radius=3.5;sun.shadow.intensity=.71;
  scene.add(sun,sun.target);
  const bounce=new T.DirectionalLight(0xffe4b4,.45);bounce.position.set(3,3,-5);scene.add(bounce);
  renderer.shadowMap.enabled=quality!=='low'; renderer.shadowMap.type=T.PCFShadowMap;
  renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.17;
}
export function modelBatches(assets:ArtLibrary, objects:ModelInstance[], override?:T.Material|((base:T.MeshStandardMaterial,id:string)=>T.Material), shadows=true) {
  const group=new T.Group(), batches=new Map<string,ModelInstance[]>();
  for(const obj of objects){
    const batch=batches.get(obj.model);
    if(batch)batch.push(obj);else batches.set(obj.model,[obj]);
  }
  const matrix=new T.Object3D();
  for(const [id,items] of batches){
    const source=assets.models.get(id);
    if(!source)throw new Error('Missing campsite model '+id);
    const material=typeof override==='function'?override(source.material,id):override||source.material;
    const mesh=new T.InstancedMesh(source.geometry,material,items.length);
    mesh.name=id; mesh.castShadow=shadows && id!=='flame'&&id!=='pool_surface'&&!id.startsWith('cloud_'); mesh.receiveShadow=shadows;
    items.forEach((obj,i)=>{
      matrix.position.set(obj.x,obj.y??.012,obj.z); matrix.rotation.set(0,obj.angle??0,0);
      const scale=obj.scale??1;matrix.scale.set(scale,scale*(obj.heightScale??1),scale);matrix.updateMatrix();mesh.setMatrixAt(i,matrix.matrix);
    });
    group.add(mesh);
  }
  return group;
}
export function disposeBatches(group:T.Group) {
  group.traverse(node=>{if(node instanceof T.InstancedMesh)node.dispose();});
  group.removeFromParent();
}
