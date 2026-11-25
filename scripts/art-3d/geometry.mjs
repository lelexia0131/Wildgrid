// Author in metres, centred on the footprint, with Y up and +Z towards row 2.
import * as T from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MeshBVH } from 'three-mesh-bvh';

export const wood = '#98613c', bark = '#694632', honey = '#ce9757', linen = '#ffda80', rope = '#dfc18a';
export const sage = '#66894e', dark = '#384e48', brass = '#c79447';
export const tau = Math.PI * 2;
const paint = new T.MeshStandardMaterial({ vertexColors: true, roughness: .84, side: T.DoubleSide });
const up = new T.Vector3(0, 1, 0);
const vector = a => new T.Vector3(...a);
const surfaceIndex={canvas:0,wood:1,stone:2,needle:3};
const timber=new Set([wood,bark,honey,'#ba8053','#a67840','#91683e','#b27948','#9b6342','#c39863','#c08b53']);

export function part(group, geometry, color, pos = [0,0,0], rot = [0,0,0]) {
  const mesh = new T.Mesh(geometry, paint);
  mesh.position.set(...pos); mesh.rotation.set(...rot);
  mesh.userData.color = color;
  group.add(mesh);
  return mesh;
}
export function block(g, pos, size, color, radius = .012, rot = [0,0,0]) {
  return part(g, radius ? new RoundedBoxGeometry(...size, 1, Math.min(radius, ...size.map(n => n / 3))) : new T.BoxGeometry(...size), color, pos, rot);
}
export function ball(g, pos, size, color, detail = 1) {
  const p = part(g, new T.IcosahedronGeometry(1, detail), color, pos);
  p.scale.set(...size);
  return p;
}
export function beam(g, a, b, radius, color, endRadius = radius, segments = 7) {
  const start = vector(a), end = vector(b), dir = end.clone().sub(start);
  const p = part(g, new T.CylinderGeometry(endRadius, radius, dir.length(), segments, 1), color);
  p.position.copy(start.add(end).multiplyScalar(.5)); p.quaternion.setFromUnitVectors(up, dir.normalize());
  return p;
}
export function cord(g, points, radius, color) {
  return part(g, new T.TubeGeometry(new T.CatmullRomCurve3(points.map(vector)), (points.length-1)*4, radius, 5, false), color);
}
export function ring(g, pos, radius, thickness, color, rot = [Math.PI/2,0,0]) {
  return part(g, new T.TorusGeometry(radius,thickness,6,20),color,pos,rot);
}
export function faces(g, vertices, indices, color) {
  const geo = new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute(vertices.flat(),3));
  geo.setIndex(indices); geo.computeVertexNormals();
  return part(g,geo,color);
}
export function lantern(g,x,y,z,s=1) {
  beam(g,[x,y,z],[x,y+.105*s,z],.035*s,'#ffd98a',.031*s,8);
  for(const h of [0,.1]) beam(g,[x,y+h*s,z],[x,y+(h+.017)*s,z],.043*s,dark,.038*s,8);
  for(const a of [0,2.1,4.2]) beam(g,[x+.032*s*Math.cos(a),y,z+.032*s*Math.sin(a)],[x+.032*s*Math.cos(a),y+.1*s,z+.032*s*Math.sin(a)],.004*s,brass);
  ring(g,[x,y+.14*s,z],.029*s,.005*s,brass,[0,0,0]);
}

// Bake short-range ambient occlusion into the colour channel once. Recesses between
// roof shingles, tree boughs and timber joints keep their depth even without GPU shadows.
function ambientOcclusion(geometry) {
  const tree=new MeshBVH(geometry),pos=geometry.getAttribute('position'),rgb=geometry.getAttribute('color');
  const directions=[[0,1,0],[.82,.54,.20],[-.75,.62,.17],[.11,.55,-.82],[.15,.58,.80],[-.57,.49,-.66],[.60,.58,-.55]].map(v=>vector(v).normalize());
  const ray=new T.Ray(),p=new T.Vector3();
  for(let i=0;i<pos.count;i++){
    p.fromBufferAttribute(pos,i);
    let occlusion=0;
    for(const direction of directions){
      ray.origin.copy(p).addScaledVector(direction,.003);ray.direction.copy(direction);
      const hit=tree.raycastFirst(ray,T.DoubleSide,.001,.29);
      if(hit)occlusion+=1-hit.distance/.29;
    }
    const light=1-.48*occlusion/directions.length;
    rgb.setXYZ(i,rgb.getX(i)*light,rgb.getY(i)*light,rgb.getZ(i)*light);
  }
}
// A model is one indexed, vertex-coloured primitive. Parts remain separately editable above.
export function bake(name, author) {
  const group = new T.Group();
  author(group); group.updateMatrixWorld(true);
  const parts = [];
  group.traverse(node => {
    if (!node.isMesh) return;
    const geo = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone();
    geo.applyMatrix4(node.matrixWorld);
    const authored=geo.getAttribute('color');
    for (const attr of Object.keys(geo.attributes)) if (!['position','normal'].includes(attr)) geo.deleteAttribute(attr);
    const pos=geo.getAttribute('position'), normal=geo.getAttribute('normal'), rgb=new Uint8Array(pos.count*3), uv=new Float32Array(pos.count*2);
    const color=new T.Color(node.userData.color);
    const surface=node.userData.surface || (timber.has(node.userData.color)?'wood':name.startsWith('forest')?'needle':null);
    const tile=surfaceIndex[surface];
    geo.computeBoundingBox();
    const {min,max}=geo.boundingBox;
    for(let i=0;i<pos.count;i++){
      const grain=.98+.024*Math.sin(pos.getX(i)*67+pos.getY(i)*43+pos.getZ(i)*57);
      const shade=grain*(.90+.09*Math.min(1,Math.max(0,pos.getY(i))*3)+.035*Math.max(0,normal.getY(i)));
      for(const [j,v] of [color.r,color.g,color.b].entries()) {
        const tint=authored?authored.getComponent(i,j):1;
        rgb[i*3+j]=Math.min(255,Math.round(255*v*tint*shade));
      }
      if(name==='flame'){
        const tongue=node.userData.tongue;
        uv[i*2]=(node.userData.color==='#ffe878'?0:.5)+(tongue+.5)/10;
        uv[i*2+1]=Math.min(.999,Math.max(0,(pos.getY(i)-.1)/(tongue?.26+tongue%2*.1:.46)));
      }else if(tile!==undefined){
        const x=(pos.getX(i)-min.x)/Math.max(.001,max.x-min.x),y=(pos.getY(i)-min.y)/Math.max(.001,max.y-min.y),z=(pos.getZ(i)-min.z)/Math.max(.001,max.z-min.z);
        const u=max.z-min.z>max.x-min.x?z:x, v=Math.abs(normal.getY(i))>.8?(u===x?z:x):y;
        uv[i*2]=((tile%2)+.03+.94*u)/2;uv[i*2+1]=(Math.floor(tile/2)+.03+.94*v)/2;
      }else{
        const glowing=['#ffd98a','#ffd083'].includes(node.userData.color);
        uv[i*2]=glowing?.012:.003;uv[i*2+1]=.004;
      }
    }
    geo.setAttribute('uv',new T.BufferAttribute(uv,2));geo.setAttribute('color',new T.Uint8BufferAttribute(rgb,3,true)); parts.push(geo);
    node.geometry.dispose();
  });
  const merged=mergeGeometries(parts), geometry=mergeVertices(merged, .00001);
  for(const geo of parts) geo.dispose();
  merged.dispose();
  if(name!=='flame')ambientOcclusion(geometry);
  const mesh=new T.Mesh(geometry,paint);
  mesh.name=name;
  return mesh;
}
