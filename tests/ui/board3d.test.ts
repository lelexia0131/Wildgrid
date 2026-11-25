import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { adventureFacilityLibrary, getLevelById, levels, offsets } from '../../src/engine';
import type { Level } from '../../src/engine';
import { facilityInstance, landscape } from '../../src/ui/board3d/landscape';
import { BufferGeometry, DoubleSide, InstancedMesh, LineSegments, Matrix4, Mesh, MeshStandardMaterial, PerspectiveCamera, Ray, Texture, Vector3 } from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { terrainMesh } from '../../src/ui/board3d/terrainMesh';
import { groundTransform } from '../../src/ui/board3d/camera';
import { passingSwallows } from '../../src/ui/board3d/birds';

test('the GLB and model-derived icons cover the registry, both layers and every journal preview',()=>{
  const root='src/assets/3d',glb=readFileSync(root+'/campsite.glb');
  assert.equal(glb.toString('ascii',0,4),'glTF');
  const model=JSON.parse(glb.toString('utf8',20,20+glb.readUInt32LE(12)));
  const nodes=new Map<string,{mesh:number}>(model.nodes.map((n:{name:string;mesh:number})=>[n.name,n]));
  for(const p of adventureFacilityLibrary){
    assert.ok(nodes.has(p.id),p.id);
    for(let i=0;i<(p.shape==='single'?1:4);i++){
      assert.ok(existsSync(`${root}/icons/${p.id}-${i}.webp`));
      if(p.shape!=='single')assert.ok(existsSync(`${root}/icons/${p.id}-${i}-plan.webp`));
    }
  }
  for(const id of ['water','anchor','cloud_0','cloud_1',...Array.from({length:4},(_,i)=>'forest_'+i)])assert.ok(nodes.has(id));
  const rocks=readFileSync(root+'/rocks.glb'), rockLibrary=JSON.parse(rocks.toString('utf8',20,20+rocks.readUInt32LE(12)));
  assert.deepEqual(rockLibrary.nodes.map((n:{name:string})=>n.name),Array.from({length:6},(_,i)=>'rock_'+i));
  for(const l of levels)assert.ok(existsSync(`${root}/scenes/day-${l.id}.webp`));
  const table=model.meshes[nodes.get('picnic_domino')!.mesh].primitives[0];
  const bounds=model.accessors[table.attributes.POSITION];
  assert.ok(bounds.max[0]-bounds.min[0]<1.45 && bounds.max[0]-bounds.min[0]>1.15,'a compact table within two cells');
  assert.ok(model.materials[0].normalTexture&&model.materials[0].pbrMetallicRoughness.baseColorTexture);
  const pylon=model.meshes[nodes.get('powerTower_single')!.mesh].primitives[0];
  assert.ok(model.accessors[pylon.attributes.POSITION].max[1]>1.16,'the cap rises above both crossarms');
  for(const id of ['pool_surface','footbridge','round_grove','apple_tree','pear_tree','willow','birch','mushrooms','stump','fallen_log','cairn','waymark',
    'swallow_body','swallow_left','swallow_right'])assert.ok(nodes.has(id),id);
});
test('connected water retains one wet surface and no internal horizontal or vertical grid stroke',()=>{
  const level:Level={...getLevelById(1)!,terrain:[{r:2,c:2,kind:'water'},{r:2,c:3,kind:'water'},{r:3,c:2,kind:'water'},{r:3,c:3,kind:'water'}]};
  const land=landscape(level,'ground','low'),texture=new Texture(),surface=terrainMesh(land,texture,texture,'low');
  const grid=surface.group.children.find(node=>node instanceof LineSegments) as LineSegments;
  const position=grid.geometry.getAttribute('position');let dryBoundary=false;
  for(let i=0;i<position.count;i+=2){
    const x=(position.getX(i)+position.getX(i+1))/2,z=(position.getZ(i)+position.getZ(i+1))/2;
    assert.ok(!(x===3&&z>2&&z<4) && !(z===3&&x>2&&x<4),'stroke crosses the lake at '+[x,z]);
    if(x===2&&z>2&&z<4)dryBoundary=true;
  }
  assert.ok(dryBoundary,'the outer logical perimeter remains readable');
  assert.ok(land.waterDepth(3,3)>.8,'a four-way join is the deep middle of the lake');
  for(let i=0;i<=16;i++){const t=2.12+i*.11;for(const [x,z] of [[3,t],[t,3]])assert.ok(land.height(x,z)<land.waterLevel(x,z));}
  surface.dispose();texture.dispose();
});
test('the game grid projects to the same screen pixels as the world at overhead, orbit and true horizontal angles',()=>{
  const w=1450,h=880,cam=new PerspectiveCamera(39,w/h,.045,180);
  for(const pitch of [0,.72,Math.PI/2])for(const yaw of [.18,1.74,3.11,5.73]){
    cam.position.set(4+Math.sin(yaw)*Math.cos(pitch)*16,1+16*Math.sin(pitch),4+Math.cos(yaw)*Math.cos(pitch)*16);
    cam.up.set(-Math.sin(yaw)*Math.sin(pitch),Math.cos(pitch),-Math.cos(yaw)*Math.sin(pitch));cam.lookAt(4,1,4);cam.updateMatrixWorld();
    const m=groundTransform(cam,w,h).slice(9,-1).split(',').map(Number);
    for(const [x,z] of [[.5,.5],[7.5,.5],[7.5,7.5],[.5,7.5],[3.5,4.5]]){
      const v=new Vector3(x,.014,z).project(cam),u=x*64,y=z*64,denom=m[3]*u+m[7]*y+m[15];
      assert.ok(Math.abs((m[0]*u+m[4]*y+m[12])/denom-(1+v.x)*w/2)<1e-6);
      assert.ok(Math.abs((m[1]*u+m[5]*y+m[13])/denom-(1-v.y)*h/2)<1e-6);
    }
  }
});

test('every rotated model uses exactly the same cell centres and handedness as Engine.occupied',()=>{
  for(const p of adventureFacilityLibrary)for(let rotation=0;rotation<4;rotation++){
    const at={r:1,c:2,rotation}, obj=facilityInstance(p,at), initial=offsets(p.shape,0);
    const cx=Math.max(...initial.map(t=>t.c))/2,cz=Math.max(...initial.map(t=>t.r))/2;
    const actual=initial.map(t=>{
      const x=t.c-cx,z=t.r-cz,a=obj.angle!;
      return [Math.round(obj.z-Math.sin(a)*x+Math.cos(a)*z-.5),Math.round(obj.x+Math.cos(a)*x+Math.sin(a)*z-.5)];
    });
    assert.deepEqual(actual,offsets(p.shape,rotation).map(t=>[t.r+at.r,t.c+at.c]));
  }
});
test('banks share a continuous surface, exterior follows the map, and unchanged cells reload identically',()=>{
  const base=getLevelById(1)!,l:Level={...base,size:6,terrain:[{r:0,c:2,kind:'water'},{r:0,c:3,kind:'water'},{r:1,c:2,kind:'water'},{r:3,c:0,kind:'rock'}]};
  const before=JSON.stringify(l),a=landscape(l,'ground','high',true),b=landscape(structuredClone(l),'ground','high',true);
  assert.deepEqual(a.objects,b.objects);
  for(const [x,z] of [[3,.5],[2.5,1],[3,-.33]])assert.ok(a.height(x,z)<a.waterLevel(x,z),'connected lake at '+[x,z]);
  assert.ok(a.height(1.5,.5)>a.waterLevel(1.5,.5));
  assert.ok(a.height(2.5,2.5)>a.height(2,2.5),'bevel around the physical turf');
  assert.notDeepEqual(a.objects,landscape({...l,terrain:[]},'ground','high',true).objects);
  assert.equal(landscape(l,'sky','low').hasWater,false);
  assert.equal(JSON.stringify(l),before);
});

test('each adventure clearing has a distinct exterior and keeps decorative trees and props outside the playable cells',()=>{
  const arrangements=new Set<string>(),models=new Set<string>();
  for(const level of levels){
    for(const layer of level.sky?['ground','sky'] as const:['ground'] as const){
      const world=landscape(level,layer,'medium',true),plan=landscape(level,layer,'medium');
      const interior=(scene:typeof world)=>scene.objects.filter(p=>!world.country.outside(p.x,p.z));
      assert.deepEqual(interior(world),interior(plan),`day ${level.id} ${layer}`);
      const scenery=world.objects.filter(p=>world.country.outside(p.x,p.z)>1);
      assert.ok(scenery.length>0);
      for(const p of scenery)models.add(p.model);
      const signature=JSON.stringify(scenery.map(p=>[p.model,p.x,p.y,p.z]));
      assert.ok(!arrangements.has(signature),`duplicate exterior on day ${level.id} ${layer}`);
      arrangements.add(signature);
      if(layer==='sky')assert.ok(scenery.some(p=>p.model.startsWith('cloud_') && (p.y??0)<0));
    }
  }
  assert.equal(arrangements.size,75);
  for(const id of ['apple_tree','pear_tree','willow','birch','mushrooms','stump','fallen_log','cairn','waymark'])assert.ok(models.has(id),id);
});

test('birds cross the scene, flap at their shoulders and leave a quiet interval between passes',()=>{
  const geometry=new BufferGeometry(),material=new MeshStandardMaterial(),mesh=new Mesh(geometry,material),texture=new Texture();
  const models=new Map(['swallow_body','swallow_left','swallow_right'].map(id=>[id,mesh]));
  for(const layer of ['ground','sky'] as const){
    const land=landscape(getLevelById(60)!,layer,'low',true);
    const birds=passingSwallows(land,{models,meadow:texture,granite:texture},'low');
    const [body,wing]=birds.group.children as InstancedMesh[];
    const pose=(batch:InstancedMesh)=>{const matrix=new Matrix4();batch.getMatrixAt(0,matrix);return matrix;};
    assert.equal(birds.update(0,true),0);assert.equal(body.count,2);
    const initial=pose(body),localWing=initial.clone().invert().multiply(pose(wing));
    birds.update(.15,true);
    assert.ok(new Vector3().setFromMatrixPosition(initial).distanceTo(new Vector3().setFromMatrixPosition(pose(body)))>.15);
    assert.ok(!localWing.equals(pose(body).invert().multiply(pose(wing))));
    const wait=birds.update(13,true);assert.ok(wait>0 && !birds.group.visible);
    assert.equal(birds.update(13+wait+.05,true),0);assert.ok(birds.group.visible);
    assert.equal(birds.update(14+wait,false),Infinity);assert.ok(!birds.group.visible);
    birds.dispose();
  }
  geometry.dispose();material.dispose();texture.dispose();
});

test('all 60 camp paths meet an open gate, keep dry footing, and connect both ends of any bridge',()=>{
  let bridges=0,banks=0;
  const texture=new Texture(),ray=new Ray(new Vector3(),new Vector3(0,-1,0));
  for(const level of levels){
    const land=landscape(level,'ground','low',true),path=land.path;
    assert.ok(path,'missing route on day '+level.id);
    const surface=terrainMesh(land,texture,texture,'low');
    const mesh=new MeshBVH((surface.group.children[0] as Mesh).geometry);
    const floor=(x:number,z:number)=>{ray.origin.set(x,40,z);return mesh.raycastFirst(ray,DoubleSide)!.point.y;};
    const entry=path.points[0],dx=land.country.sideX,dz=land.country.sideZ;
    const r=Math.floor(entry.z-dz*.5),c=Math.floor(entry.x-dx*.5);
    assert.ok(![...level.terrain,...(level.sky?.anchors??[])].some(p=>p.r===r&&p.c===c));
    if(path.bridge){
      bridges++;
      for(const end of [-1,1])for(const side of [-.29,0,.29]){
        const b=path.bridge,x=b.x+end*1.26*dx-side*dz,z=b.z+end*1.26*dz+side*dx;
        assert.ok(land.shore(x,z)>.09 && Math.abs(floor(x,z)-b.y-.16)<.045,'bridge landing on day '+level.id);
      }
    }else banks++;
    for(const [i,b] of path.points.entries()){
      if(!i)continue;
      const a=path.points[i-1],p={x:(a.x+b.x)/2,z:(a.z+b.z)/2};
      if(path.bridge && Math.hypot(p.x-path.bridge.x,p.z-path.bridge.z)<1.27)continue;
      assert.ok(floor(p.x,p.z)>land.waterLevel(p.x,p.z) && path.paint(p.x,p.z)>.7,'broken path on day '+level.id);
      assert.ok(Math.abs(path.sample(a.x,a.z)!.grade-path.sample(b.x,b.z)!.grade)<=.31*Math.hypot(a.x-b.x,a.z-b.z)+.035);
    }
    assert.ok(path.marker && land.shore(path.marker.x,path.marker.z)>.19);
    if(land.country.hasRiver){
      for(const [v,sign] of [[land.country.spring,-1],[land.country.outlet,1]]){
        const centre=land.country.world(land.country.bend(v),v);
        const beyond=land.country.world(land.country.bend(v),v+sign*2.8);
        assert.ok(land.shore(centre.x,centre.z)<0 && land.shore(beyond.x,beyond.z)>0,'open-ended water on day '+level.id);
      }
    }
    assert.ok(land.objects.every(obj=>obj.model==='footbridge'||land.country.outside(obj.x,obj.z)===0||
      (path.sample(obj.x,obj.z)?.distance??Infinity)>.34),'obstructed path on day '+level.id);
    surface.dispose();
  }
  texture.dispose();
  assert.ok(bridges>0&&banks>0);
  const base=getLevelById(1)!;
  const wetEdge=Array.from({length:base.size**2},(_,i)=>({r:Math.floor(i/base.size),c:i%base.size,kind:'water' as const}))
    .filter(p=>p.r===0||p.c===0||p.r===base.size-1||p.c===base.size-1);
  const isolated=landscape({...base,terrain:wetEdge},'ground','low',true);
  assert.equal(isolated.path,undefined);
  assert.ok(isolated.objects.every(p=>p.model!=='footbridge' && p.model!=='waymark'));
});
