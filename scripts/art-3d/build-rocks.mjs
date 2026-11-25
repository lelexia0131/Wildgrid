import { NodeIO } from '@gltf-transform/core';
import { MeshoptSimplifier } from 'meshoptimizer';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// Six different scanned silhouettes from Kless Gyzen's CC0 Rock Moss Set 01.
// Retain the rounded fractures and moss islands; remap the photographic values to the camp palette.
const io=new NodeIO(),doc=await io.read(fileURLToPath(new URL('../../docs/3d/rock-moss-source.glb',import.meta.url)));
const root=doc.getRoot(),mat=root.listMaterials()[0],diffuse=mat.getBaseColorTexture();
const {data,info}=await sharp(diffuse.getImage()).resize(768,768).removeAlpha().blur(.65).raw().toBuffer({resolveWithObject:true});
const mix=(a,b,t)=>a+(b-a)*t, limit=v=>Math.max(0,Math.min(1,v));
for(let i=0;i<data.length;i+=3){
  const [r,g,b]=data.subarray(i,i+3), moss=limit((g-b-8)/42)*limit((g-r+19)/28);
  const light=limit((r*.33+g*.53+b*.14-25)/190);
  const shadow=[125,119,123],sun=[248,230,201],leafShade=[87,113,63],leafLight=[188,197,112];
  for(let c=0;c<3;c++)data[i+c]=mix(mix(shadow[c],sun[c],light),mix(leafShade[c],leafLight[c],light),moss*.91);
}
diffuse.setImage(await sharp(data,{raw:info}).jpeg({quality:88}).toBuffer());
const normal=mat.getNormalTexture();
normal.setImage(await sharp(normal.getImage()).resize(512).blur(.6).jpeg({quality:86}).toBuffer());
mat.setNormalScale(.48).setRoughnessFactor(.89);
const rough=mat.getMetallicRoughnessTexture();
rough.setImage(await sharp(rough.getImage()).resize(256).jpeg({quality:81}).toBuffer());
await MeshoptSimplifier.ready;
for(const [v,node] of root.listNodes().entries()){
  node.setName('rock_'+v).setTranslation([0,0,0]);
  const mesh=node.getMesh().setName(node.getName()),p=mesh.listPrimitives()[0],pos=p.getAttribute('POSITION'),values=pos.getArray();
  const [indices]=MeshoptSimplifier.simplify(Uint32Array.from(p.getIndices().getArray()),values,3,3400*3,.009);
  const [remap,count]=MeshoptSimplifier.compactMesh(indices);
  const min=pos.getMin([]),max=pos.getMax([]),scale=.85/Math.max(max[0]-min[0],max[2]-min[2]);
  for(let i=0;i<values.length;i+=3){
    values[i]=(values[i]-(min[0]+max[0])/2)*scale;
    values[i+1]=(values[i+1]-min[1])*scale-.038;
    values[i+2]=(values[i+2]-(min[2]+max[2])/2)*scale;
  }
  for(const attribute of p.listAttributes()){
    const src=attribute.getArray(),stride=attribute.getElementSize(),out=new src.constructor(count*stride);
    for(let old=0;old<remap.length;old++)if(remap[old]!==0xffffffff)out.set(src.subarray(old*stride,old*stride+stride),remap[old]*stride);
    attribute.setArray(out);
  }
  p.getIndices().setArray(Uint16Array.from(indices));
}
await io.write(fileURLToPath(new URL('../../src/assets/3d/rocks.glb',import.meta.url)),doc);
