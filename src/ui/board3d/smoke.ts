import * as T from 'three';
import { detailAt } from './landscape';
import type { ModelInstance } from './landscape';

// One soft billboard batch. The chimney/ember outlets use the building's actual rotation.
export function smokePlumes(buildings:ModelInstance[],clock:{value:number}) {
  const outlets=buildings.flatMap(obj=>obj.model==='cabin_el'?[detailAt(obj,'smoke',-.55,.94,-.44)]:
    obj.model==='fire_single'?[detailAt(obj,'bonfire',0,.28,0)]:[]);
  if(!outlets.length)return;
  const quad=new T.PlaneGeometry(1,1),geo=new T.InstancedBufferGeometry();
  geo.setIndex(quad.index);geo.setAttribute('position',quad.getAttribute('position'));geo.setAttribute('uv',quad.getAttribute('uv'));
  const origins:number[]=[],phases:number[]=[],sparks:number[]=[];
  for(const o of outlets)for(let i=0;i<(o.model==='bonfire'?9:5);i++){
    origins.push(o.x,o.y!,o.z);phases.push(i/5+(o.x*1.07+o.z*.31)%1);sparks.push(i>=5?1:0);
  }
  geo.setAttribute('spark',new T.InstancedBufferAttribute(new Float32Array(sparks),1));
  geo.setAttribute('outlet',new T.InstancedBufferAttribute(new Float32Array(origins),3));
  geo.setAttribute('phase',new T.InstancedBufferAttribute(new Float32Array(phases),1));geo.instanceCount=phases.length;
  const mat=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{time:clock},vertexShader:`
    attribute vec3 outlet;attribute float phase;attribute float spark;uniform float time;
    varying vec2 puff;varying float age;varying float ember;
    void main(){
      ember=spark;age=fract(time*mix(.34,.68,spark)+phase);puff=uv*2.-1.;
      vec3 center=outlet+vec3(.18*age*age+.029*sin(age*8.+phase*6.),age*.74,.039*sin(age*5.+phase));
      center.xz+=spark*.085*vec2(sin(age*6.+phase*9.),cos(age*8.-phase*5.));
      vec4 v=modelViewMatrix*vec4(center,1.);v.xy+=position.xy*mix(vec2(.075+age*.28),vec2(.02,.032)*(1.-age*.57),spark);
      gl_Position=projectionMatrix*v;
    }`,fragmentShader:`
    varying vec2 puff;varying float age;varying float ember;
    void main(){
      float edge=dot(puff,puff)+.10*sin(puff.x*6.+age*4.)*sin(puff.y*6.);
      float a=(1.-smoothstep(.14,.95,edge))*smoothstep(0.,.10,age)*(1.-smoothstep(.45,1.,age))*.34;
      vec3 color=mix(mix(vec3(.77,.78,.70),vec3(1.,.98,.89),age),mix(vec3(1.,.89,.31),vec3(1.,.36,.06),age),ember);
      gl_FragColor=vec4(color,mix(a,(1.-smoothstep(.10,.95,edge))*sin(age*3.14159),ember));
    }`});
  const mesh=new T.Mesh(geo,mat);mesh.frustumCulled=false;mesh.renderOrder=2;
  return {mesh,dispose(){mesh.removeFromParent();geo.dispose();mat.dispose();}};
}
