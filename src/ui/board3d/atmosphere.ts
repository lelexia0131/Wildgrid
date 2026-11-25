import * as T from 'three';
import { noise } from './landscape';

// The horizon, sun and cloud banks are in world space. Turning toward another valley
// reveals a different skyline, including when the camera is level with the campsite.
export function atmosphere(size:number,seed:number,sky:boolean,horizon:string){
  const group=new T.Group(), radius=145;
  const haze=new T.Color(horizon).lerp(new T.Color(sky?0xdaedf5:0xf3efe1),sky?.72:.58);
  const skyMaterial=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,
    uniforms:{haze:{value:new T.Color(haze)},zenith:{value:new T.Color(sky?0x8acbe3:0x97d7e7)}},
    vertexShader:'varying vec3 direction; void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 direction;uniform vec3 haze;uniform vec3 zenith;
      void main(){vec3 n=normalize(direction);vec3 sun=normalize(vec3(-.58,.46,.67));
      float glow=max(dot(n,sun),0.);vec3 color=mix(haze,zenith,smoothstep(-.01,.72,n.y));
      color+=vec3(.34,.24,.09)*pow(glow,12.)+vec3(.88,.68,.30)*smoothstep(.996,.999,glow);
      gl_FragColor=vec4(color,1.);
      #include <colorspace_fragment>
      }`});
  const dome=new T.Mesh(new T.SphereGeometry(radius,40,18),skyMaterial);
  dome.position.set(size/2,0,size/2);dome.renderOrder=-5;group.add(dome);
  const count=16, shape=new T.IcosahedronGeometry(1,2);
  const lobes=[[-1.55,-.25,.14,1.12,.55],[-.68,.14,.30,1.19,.88],[.19,.62,.02,1.34,1.13],
    [1.17,.05,-.21,1.04,.78],[1.89,-.29,.04,.72,.42],[.24,-.32,.46,1.49,.58],[-1.12,.32,-.28,.64,.59]];
  const material=new T.MeshStandardMaterial({color:0xfff3d9,roughness:1});
  const clouds=new T.InstancedMesh(shape,material,count*lobes.length),matrix=new T.Object3D();
  for(let i=0;i<count;i++){
    const a=(i+noise(seed,i,12)*.6)*Math.PI*2/count,r=20+noise(seed,i,13)*25;
    const x=size/2+Math.cos(a)*r,z=size/2+Math.sin(a)*r,y=5+noise(seed,i,14)*8;
    const scale=.74+noise(seed,i,15)*.87;
    for(const [j,[u,h,v,w,t]] of lobes.entries()){
      matrix.position.set(x+(Math.cos(a)*v-Math.sin(a)*u)*scale,y+h*scale,z+(Math.sin(a)*v+Math.cos(a)*u)*scale);
      matrix.scale.set(w*scale,t*scale,w*(.77+.26*noise(seed,i,j))*scale);matrix.updateMatrix();
      clouds.setMatrixAt(i*lobes.length+j,matrix.matrix);
    }
  }
  group.add(clouds);
  return {group,haze,tick(t:number){clouds.position.set(Math.sin(t*.021)*.82,0,Math.sin(t*.018)*.32);},dispose(){
    group.removeFromParent();dome.geometry.dispose();skyMaterial.dispose();clouds.dispose();shape.dispose();material.dispose();
  }};
}
