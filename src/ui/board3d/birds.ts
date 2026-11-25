import { DynamicDrawUsage, Group, InstancedMesh, Matrix4, Object3D } from 'three';
import { smooth } from './countryside';
import { noise } from './landscape';
import type { landscape, Quality } from './landscape';
import type { ArtLibrary } from './models';

export function passingSwallows(land:ReturnType<typeof landscape>,assets:ArtLibrary,quality:Quality,obstacleTop=land.height){
  const {size,seed}=land,count=quality==='low'?2:quality==='medium'?3:4;
  const group=new Group(),pose=new Object3D(),hinge=new Matrix4(),wingPose=new Matrix4();
  const [body,left,right]=['swallow_body','swallow_left','swallow_right'].map(id=>{
    const source=assets.models.get(id)!;
    const mesh=new InstancedMesh(source.geometry,source.material,count);
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);mesh.frustumCulled=false;group.add(mesh);
    return mesh;
  });
  group.visible=false;
  const flight=9+noise(seed,1,3)*3,period=flight+12+noise(seed,2,3)*8;
  function update(seconds:number,enabled:boolean){
    const clock=seconds+flight*.30,pass=Math.floor(clock/period),age=clock%period;
    group.visible=enabled && age<flight;
    if(!group.visible)return enabled?period-age:Infinity;
    const t=age/flight,sign=pass%2?-1:1,span=size+25;
    const angle=(noise(seed,pass,5)-.5)*.94+pass*1.37,c=Math.cos(angle),s=Math.sin(angle);
    const curve=Math.sin(t*Math.PI),bend=.8*curve-size*.55-1.35;
    const dx=sign*span*c-.8*Math.PI*Math.cos(t*Math.PI)*s;
    const dz=sign*span*s+.8*Math.PI*Math.cos(t*Math.PI)*c;
    const yaw=Math.atan2(dx,dz),leadX=Math.sin(yaw),leadZ=Math.cos(yaw),fade=smooth(0,.08,t)*(1-smooth(.92,1,t));
    for(let i=0;i<count;i++){
      const along=sign*((t-.5)*span-i*.76),across=bend+(i%2?1:-1)*i*.33;
      const x=size/2+along*c-across*s,z=size/2+along*s+across*c;
      const canopy=Math.max(obstacleTop(x,z),obstacleTop(x+leadX,z+leadZ)-.25,obstacleTop(x-leadX,z-leadZ)-.25);
      const y=Math.max(land.sky?2.05:3.10,land.height(x,z)+(land.sky?1.30:2.45),canopy+.62)+curve*.62+.13*Math.sin(seconds*.9+i);
      pose.position.set(x,y,z);pose.rotation.set(.04*Math.cos(seconds*.9+i),yaw,.28*Math.sin(t*5+i*.4),'YXZ');
      pose.scale.setScalar((1.12+noise(seed,i,9)*.30)*fade);pose.updateMatrix();body.setMatrixAt(i,pose.matrix);
      const beat=.12+.88*smooth(-.37,.40,Math.sin(seconds*1.18+i*.77));
      const flap=.14+beat*.82*Math.sin(seconds*13.4+i*2.17);
      for(const side of [-1,1]){
        hinge.makeRotationZ(side*flap).setPosition(side*.036,.01,.017);
        (side<0?left:right).setMatrixAt(i,wingPose.multiplyMatrices(pose.matrix,hinge));
      }
    }
    for(const mesh of [body,left,right])mesh.instanceMatrix.needsUpdate=true;
    return 0;
  }
  return {group,update,dispose(){group.removeFromParent();for(const mesh of [body,left,right])mesh.dispose();}};
}
