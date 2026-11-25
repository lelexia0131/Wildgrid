import * as T from 'three';

// The tongue number and normalised height are baked into the fire model UV. Geometry at
// the base stays put while heat waves travel upward at a different phase in each tongue.
export function campEffects(clock:{value:number}){
  const flame=new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide,toneMapped:false});
  flame.onBeforeCompile=shader=>{
    shader.uniforms.campTime=clock;
    shader.vertexShader='uniform float campTime;varying float heat;varying float core;\n'+shader.vertexShader.replace('#include <begin_vertex>',`
      #include <begin_vertex>
      float tongue=mod(floor(uv.x*10.),5.),h=clamp(uv.y,0.,1.);
      float t=campTime+dot(instanceMatrix[3].xz,vec2(1.37,.74));
      float phase=t*(2.1+tongue*.24)+tongue*2.17;
      vec2 root=tongue<.5?vec2(0.):.077*vec2(cos(tongue*2.4),sin(tongue*2.4));
      float wave=sin(phase-h*5.1),twist=cos(phase*1.31-h*4.6);
      transformed.xz=root+(position.xz-root)*(1.+.22*h*wave);
      transformed.x+=h*h*(.100*wave+.043*sin(phase*.71+h*2.)+.035);
      transformed.z+=h*h*.074*twist;
      transformed.y+=h*h*(.066*sin(phase*.87)-.034*twist);
      heat=h+.08*h*wave;core=step(uv.x,.5);
    `);
    shader.fragmentShader='varying float heat;varying float core;\n'+shader.fragmentShader.replace('#include <color_fragment>',`
      diffuseColor.rgb=mix(mix(vec3(1.,.50,.035),vec3(1.,.098,.012),heat),
                           mix(vec3(1.,.88,.24),vec3(1.,.32,.022),heat),core);
    `);
  };
  const pool=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{time:clock},
    vertexShader:`varying vec2 lake;void main(){lake=position.xz;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform float time;varying vec2 lake;void main(){
      float basin=length((lake+vec2(.026,.025))/vec2(.336,.26));
      float line=sin(lake.y*47.+lake.x*11.+time*1.26+.85*sin(lake.x*22.-time*.72));
      float light=pow(max(0.,line),11.)*(.40+.60*cos(lake.x*16.+time*.64)*cos(lake.x*16.+time*.64));
      float rings=sin(length(lake-vec2(-.06,.18))*76.-time*2.4);
      vec3 c=mix(vec3(.045,.48,.57),vec3(.25,.77,.65),smoothstep(.38,1.,basin));
      c+=vec3(.31,.29,.17)*light+vec3(.08,.13,.11)*pow(max(0.,rings),20.);
      gl_FragColor=vec4(c,.65+.16*basin);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});
  return {flame,pool,dispose(){flame.dispose();pool.dispose();}};
}
