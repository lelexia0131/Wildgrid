import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import sharp from 'sharp';
import { Scene } from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { bake } from './geometry.mjs';
import { airship, balloon, cabin, fire, flame, footbridge, kite, lookout, pennant, picnic, pool, poolSurface, propeller, pylon, tent, truck } from './facilities.mjs';
import { birch, cairn, cloud, fallenLog, forest, fruitTree, grove, meadow, pondIcon, post, reeds, roundGrove, stone, swallowBody, swallowWing, treeStump, waymark, willow, woodlandMushrooms } from './nature.mjs';

// GLTFExporter writes browser Blobs. Node provides Blob but lacks this small reader.
globalThis.FileReader = class {
  async readAsArrayBuffer(blob) { this.result=await blob.arrayBuffer(); this.onloadend?.(); }
};
const scene=new Scene();
const add=(id,fn)=>scene.add(bake(id,fn));
add('propeller',propeller);add('pennant',pennant);
add('pool_surface',poolSurface);add('footbridge',footbridge);add('round_grove',roundGrove);
for(const shape of ['single','domino','long','el'])add('camp_'+shape,g=>tent(g,shape));
for(const [id,fn] of Object.entries({fire_single:fire,flame,tower_single:lookout,picnic_domino:picnic,cabin_el:cabin,foodTruck_single:truck,powerTower_single:pylon,pool_single:pool,balloon_single:balloon,airship_domino:airship,kite_long:kite,anchor:post,water:pondIcon,reeds}))add(id,fn);
for(let i=0;i<4;i++){
  add('forest_'+i,g=>forest(g,i));
  add('pebble_'+i,g=>stone(g,0,0,.13+i*.014,.10,.10+i*.015,.4+i,true));
}
for(let i=0;i<3;i++)add('meadow_'+i,g=>meadow(g,i));
for(let i=0;i<2;i++)add('cloud_'+i,g=>cloud(g,i));
for(let i=0;i<2;i++)add('grove_'+i,g=>grove(g,i));
for(const [id,build] of Object.entries({apple_tree:fruitTree,pear_tree:g=>fruitTree(g,true),birch,willow,fallen_log:fallenLog,
  stump:treeStump,mushrooms:woodlandMushrooms,cairn,waymark}))add(id,build);
add('swallow_body',swallowBody);add('swallow_left',g=>swallowWing(g,-1));add('swallow_right',g=>swallowWing(g,1));
const data=await new GLTFExporter().parseAsync(scene,{binary:true,onlyVisible:true});
const dir=new URL('../../src/assets/3d/',import.meta.url);
await mkdir(dir,{recursive:true});
const io=new NodeIO(), document=await io.readBinary(new Uint8Array(data));
// Neutral detail preserves the authored colours. A normal atlas uses the same UVs and
// adds fibre, grain and mineral relief to the standard PBR material in any glTF viewer.
const size=1024, source=fileURLToPath(new URL('../../docs/3d/material-source.png',import.meta.url));
const height=await sharp(source).resize(size,size).blur(.62).greyscale().raw().toBuffer();
const color=Buffer.alloc(size*size*3),normal=Buffer.alloc(color.length);
for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=y*size+x, neutral=x<15&&y<15, gain=y<size/2 && x<size/2?.50:.74;
  const value=neutral?255:Math.min(255,174+height[i]*gain);
  color.fill(value,i*3,i*3+3);
  const dx=neutral?0:(height[y*size+Math.min(size-1,x+1)]-height[y*size+Math.max(0,x-1)])*.004;
  const dy=neutral?0:(height[Math.min(size-1,y+1)*size+x]-height[Math.max(0,y-1)*size+x])*.004;
  const len=Math.hypot(dx,dy,1);
  normal.set([(-dx/len*.5+.5)*255,(dy/len*.5+.5)*255,(.5/len+.5)*255],i*3);
}
async function texture(name,bytes){
  const jpeg=await sharp(bytes,{raw:{width:size,height:size,channels:3}}).jpeg({quality:89,chromaSubsampling:'4:4:4'}).toBuffer();
  return document.createTexture(name).setImage(jpeg).setMimeType('image/jpeg');
}
const material=document.getRoot().listMaterials()[0];
material.setBaseColorTexture(await texture('Canvas, cedar, granite and needles',color));
material.setNormalTexture(await texture('Surface relief',normal)).setNormalScale(.33);
const emission=Buffer.alloc(256*256*3);
for(let y=0;y<3;y++)for(let x=2;x<=4;x++)emission.fill(255,(y*256+x)*3,(y*256+x+1)*3);
const emissive=await sharp(emission,{raw:{width:256,height:256,channels:3}}).png().toBuffer();
material.setEmissiveTexture(document.createTexture('Lantern glass and embers').setImage(emissive).setMimeType('image/png')).setEmissiveFactor([.46,.20,.038]);
// The fire is a light source. Its amber core and orange tips retain their colour in sunshine.
const flamePixels=Buffer.alloc(16*64*3);
for(let y=0;y<64;y++)for(let x=0;x<16;x++){
  const t=y/63,hot=x<8;
  flamePixels.set([255,hot?222-70*t:153-83*t,hot?94-73*t:24-17*t],(y*16+x)*3);
}
const fireTexture=await sharp(flamePixels,{raw:{width:16,height:64,channels:3}}).png().toBuffer();
const firelight=document.createMaterial('Amber flame').setBaseColorFactor([.025,.012,.004,1]).setDoubleSided(true)
  .setEmissiveFactor([1,1,1]).setEmissiveTexture(document.createTexture('Flame temperature').setImage(fireTexture).setMimeType('image/png'));
document.getRoot().listNodes().find(node=>node.getName()==='flame').getMesh().listPrimitives()[0].setMaterial(firelight);
for(const primitive of document.getRoot().listMeshes().flatMap(mesh=>mesh.listPrimitives())){
  const uv=primitive.getAttribute('TEXCOORD_0');
  uv.setArray(Uint16Array.from(uv.getArray(),v=>Math.round(v*65535))).setNormalized(true);
}
const result=await io.writeBinary(document);
await writeFile(new URL('campsite.glb',dir),result);
console.log(`Exported ${scene.children.length} textured models, ${result.byteLength} bytes.`);
