import * as T from 'three';
import type { landscape, Quality } from './landscape';
import { noise } from './landscape';

type Landscape = ReturnType<typeof landscape>;
function groundedObjects(land:Landscape,pos:number[],faces:number[],start:number){
  if(!land.surround)return land.objects;
  const objects=land.objects.map(obj=>({...obj}));
  const bins=new Map<number,{obj:typeof objects[number];offset:number}[]>();
  const key=(x:number,z:number)=>(x+32)*128+z+32;
  for(const obj of objects){
    if(land.country.outside(obj.x,obj.z)<.48||obj.model.startsWith('cloud')||obj.model==='footbridge')continue;
    const bin=key(Math.floor(obj.x),Math.floor(obj.z)),items=bins.get(bin)??[];
    items.push({obj,offset:(obj.y??0)-land.height(obj.x,obj.z)});bins.set(bin,items);
  }
  // Sample the actual coarse hillside triangles, not the smooth function used to author
  // their vertices. This keeps distant tree roots on the mesh when seen from the horizon.
  for(let i=start;i<faces.length;i+=3){
    const a=faces[i]*3,b=faces[i+1]*3,c=faces[i+2]*3,ax=pos[a],az=pos[a+2];
    const bx=pos[b]-ax,bz=pos[b+2]-az,cx=pos[c]-ax,cz=pos[c+2]-az,det=bx*cz-bz*cx;
    if(Math.abs(det)<1e-8)continue;
    const xl=Math.max(-18,Math.floor(ax+Math.min(0,bx,cx))),xh=Math.min(land.size+18,Math.floor(ax+Math.max(0,bx,cx)));
    const zl=Math.max(-18,Math.floor(az+Math.min(0,bz,cz))),zh=Math.min(land.size+18,Math.floor(az+Math.max(0,bz,cz)));
    for(let x=xl;x<=xh;x++)for(let z=zl;z<=zh;z++)for(const {obj,offset} of bins.get(key(x,z))??[]){
      const dx=obj.x-ax,dz=obj.z-az,u=(dx*cz-dz*cx)/det,v=(bx*dz-bz*dx)/det;
      if(u>=0&&v>=0&&u+v<=1)obj.y=pos[a+1]+u*(pos[b+1]-pos[a+1])+v*(pos[c+1]-pos[a+1])+offset;
    }
  }
  return objects;
}
export function terrainMesh(land:Landscape, meadow:T.Texture, granite:T.Texture, quality:Quality,showGrid=true) {
  const {size,sky,height,shore,seed}=land, group=new T.Group();
  const sample=[-.39,-.20,-.07];
  for(let i=0;i<size;i++)for(const f of quality==='low'?[0,.042,.25,.5,.75,.958]:[0,.033,.12,.24,.38,.5,.62,.76,.88,.967])sample.push(i+f);
  sample.push(size,size+.07,size+.20,size+.39);
  const stride=sample.length,segments=stride-1;
  const positions:number[]=[],colors:number[]=[],uv:number[]=[],indices:number[]=[],rim:number[]=[];
  const tint=new T.Color(), grass=new T.Color('#dbedbc'), sand=new T.Color('#f6dfaf'), mist=new T.Color('#c2dbe2');
  const {palette,form}=land.country;
  const highland=new T.Color(palette.rock),valley=new T.Color(palette.land),grassland=new T.Color(palette.shade);
  const turfColor={brook:'#90c5a8',cove:'#b2d6b6',meadow:'#e4c689',grove:'#84ae88',bluff:'#b1bdba',cloudbank:'#a4c3c4'};
  valley.lerp(new T.Color(sky?'#93b4bc':turfColor[form]),.66);
  const bankSand=new T.Color(palette.sand);
  const extent=size+.78, origin=-.39;
  for(let j=0;j<=segments;j++) for(let i=0;i<=segments;i++){
    let x=sample[i],z=sample[j];
    const vertical=i===0||i===segments,horizontal=j===0||j===segments;
    if(vertical)x+=(i===0?-1:1)*(.038*Math.sin(z*4+seed)+.02*Math.cos(z*9));
    if(horizontal)z+=(j===0?-1:1)*(.05*Math.cos(x*4+seed)+.017*Math.sin(x*7));
    // Round off the four corners of the cut earth rather than clipping a square slab.
    const cornerX=Math.max(0,.35-Math.min(Math.abs(x-origin),Math.abs(x-origin-extent)));
    const cornerZ=Math.max(0,.35-Math.min(Math.abs(z-origin),Math.abs(z-origin-extent)));
    x+=Math.sign(size/2-x)*cornerX*cornerZ*.9; z+=Math.sign(size/2-z)*cornerX*cornerZ*.9;
    const y=height(x,z), distance=shore(x,z);
    positions.push(x,y,z);uv.push(x*.85,z*.85);
    tint.copy(sky?mist:grass);
    if(!sky)tint.lerp(sand,T.MathUtils.clamp((.10-distance)*7,0,1));
    const shade=1+.062*Math.sin(x*2.7+seed)*Math.cos(z*2.1)+.043*noise(seed,j,i);
    colors.push(tint.r*shade,tint.g*shade,tint.b*shade);
    if(i<segments&&j<segments){const a=j*stride+i;indices.push(a,a+stride,a+1,a+1,a+stride,a+stride+1);}
  }
  for(let i=0;i<segments;i++)rim.push(i);
  for(let j=0;j<segments;j++)rim.push(j*stride+segments);
  for(let i=segments;i>0;i--)rim.push(segments*stride+i);
  for(let j=segments;j>0;j--)rim.push(j*stride);
  const innerFaces=indices.length;
  if(land.surround){
    let prior=rim;
    // A single opaque mesh continues through the visible valley out to the fog horizon.
    const expansion=[...Array.from({length:30},(_,i)=>(i+1)*.16),
      ...Array.from({length:15},(_,i)=>4.8+(i+1)*.36),11.5,13,15,18,22,28,36,47,62,82];
    for(const distance of expansion){
      const next:number[]=[];
      for(const vertex of rim){
        const k=vertex*3,dx=positions[k]-size/2,dz=positions[k+2]-size/2,m=Math.max(Math.abs(dx),Math.abs(dz));
        const x=positions[k]+dx/m*distance,z=positions[k+2]+dz/m*distance;
        next.push(positions.length/3);
        const y=height(x,z);
        positions.push(x,y,z);uv.push(x*.85,z*.85);
        const patch=.5+.5*Math.sin(x*.51+Math.sin(z*.38)+seed)*Math.cos(z*.37-x*.16);
        if(sky)tint.copy(mist).lerp(highland,T.MathUtils.smoothstep(y,-2.8,1.2)*(.52+patch*.25));
        else{
          tint.copy(grass).lerp(valley,T.MathUtils.smoothstep(distance,0,2));
          tint.lerp(grassland,patch*.43*T.MathUtils.smoothstep(distance,.25,2.2));
          tint.lerp(highland,T.MathUtils.smoothstep(distance,form==='bluff'?2:5,17)*(.45+patch*.37));
          tint.lerp(bankSand,T.MathUtils.clamp((.25-shore(x,z))*3.5,0,1));
        }
        const shade=.99+.055*Math.sin(x*.91+seed)*Math.cos(z*.63);
        colors.push(tint.r*shade,tint.g*shade,tint.b*shade);
      }
      for(let i=0;i<rim.length;i++){const j=(i+1)%rim.length;indices.push(prior[i],prior[j],next[i],prior[j],next[j],next[i]);}
      prior=next;
    }
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  // A continuous mask keeps the path intact even on the coarsest hillside triangles.
  const bounds=land.path?.bounds??{xmin:0,xmax:1,zmin:0,zmax:1};
  const width=bounds.xmax-bounds.xmin,depth=bounds.zmax-bounds.zmin;
  const cols=land.path?Math.ceil(width*24):1,rows=land.path?Math.ceil(depth*24):1;
  const mask=new Uint8Array(cols*rows);
  if(land.path)for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
    mask[j*cols+i]=Math.round(255*land.path.paint(bounds.xmin+(i+.5)*width/cols,bounds.zmin+(j+.5)*depth/rows));
  }
  const trailMap=new T.DataTexture(mask,cols,rows,T.RedFormat);
  trailMap.minFilter=trailMap.magFilter=T.LinearFilter;trailMap.needsUpdate=true;
  const surfaceMaterial=new T.MeshStandardMaterial({vertexColors:true,map:sky?(land.surround?granite:null):meadow,roughness:.94});
  if(sky && land.surround)surfaceMaterial.onBeforeCompile=shader=>{
    shader.uniforms.cloudLight={value:new T.Color('#f7f8ef').lerp(new T.Color(palette.paper),.30)};
    shader.uniforms.cloudShade={value:new T.Color('#a0c4d6').lerp(new T.Color(palette.haze),.20)};
    shader.uniforms.wind={value:seed%27};
    shader.vertexShader='varying vec3 plateau;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nplateau=position;');
    shader.fragmentShader='varying vec3 plateau;uniform vec3 cloudLight,cloudShade;uniform float wind;\n'+shader.fragmentShader.replace('#include <color_fragment>',`
      #include <color_fragment>
      vec2 p=plateau.xz;
      vec2 drift=p+vec2(1.7*sin(p.y*.46+wind),1.1*cos(p.x*.38-wind));
      float curl=sin(drift.x*.76+drift.y*.36)+.72*cos(drift.y*.95-drift.x*.25);
      float wisps=.12*sin(drift.y*2.7+curl*2.)+.06*cos(drift.x*3.1+curl);
      vec3 vapor=mix(cloudShade,cloudLight,smoothstep(-1.45,1.14,curl+wisps));
      float exposed=smoothstep(-1.74,-.79,plateau.y+.14*curl);
      vec3 summit=mix(vec3(.21,.34,.41),vec3(.55,.68,.69),diffuseColor.g);
      diffuseColor.rgb=mix(vapor,summit,exposed);
    `);
  };
  else if(!sky)surfaceMaterial.onBeforeCompile=shader=>{
    shader.uniforms.granite={value:granite};shader.uniforms.boardWidth={value:size};
    shader.uniforms.rockSlope={value:form==='bluff'?.065:.13};
    shader.uniforms.trailMap={value:trailMap};shader.uniforms.trailBounds={value:new T.Vector4(bounds.xmin,bounds.zmin,width,depth)};
    shader.vertexShader='varying vec3 soilPosition; varying vec3 soilNormal;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nsoilPosition=position;soilNormal=normal;');
    shader.fragmentShader='uniform sampler2D granite,trailMap; uniform vec4 trailBounds; uniform float boardWidth,rockSlope; varying vec3 soilPosition,soilNormal;\n'+shader.fragmentShader.replace('#include <map_fragment>',`
      #include <map_fragment>
      vec2 p=soilPosition.xz;float verge=max(max(-p.x,-p.y),max(p.x-boardWidth,p.y-boardWidth));
      vec3 gn=normalize(soilNormal);
      float slope=1.-abs(gn.y)+.035*sin(soilPosition.y*5.7+p.x*.83-p.y*.36);
      float facet=smoothstep(rockSlope,rockSlope+.29,slope)*smoothstep(.6,1.8,verge);
      vec3 stone=texture2D(granite,vec2(p.x*.40+p.y*.35,soilPosition.y*.8+p.y*.16)).rgb;
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.77,.85,.83),smoothstep(9.,34.,verge)*.30);
      diffuseColor.rgb=mix(diffuseColor.rgb,stone,facet);
      float pathMix=texture2D(trailMap,(p-trailBounds.xy)/trailBounds.zw).r;
      float grit=texture2D(granite,p*1.6).r;
      vec3 soil=mix(vec3(.42,.28,.16),vec3(.76,.57,.35),smoothstep(.12,.70,grit));
      diffuseColor.rgb=mix(diffuseColor.rgb,soil,smoothstep(.06,.96,pathMix)*(.74+.15*grit));
      vec2 edges=.5-abs(fract(p)-.5);float seam=min(edges.x,edges.y);
      float interior=1.-step(0.001,verge);
      diffuseColor.rgb*=1.-.23*interior*(1.-smoothstep(.004,.030,seam));
      float dapple=sin(p.x*1.7+sin(p.y*.96)*1.6)*cos(p.y*1.64-p.x*.32);
      diffuseColor.rgb*=1.+.085*dapple+.045*sin(p.x*7.+p.y*4.)*sin(p.y*3.);
    `);
  };
  const sod=new T.Mesh(geometry,surfaceMaterial);
  sod.renderOrder=-2;
  sod.receiveShadow=true;group.add(sod);
  // Short, tapered blades give the cut turf a real silhouette along the grooves and banks.
  if(!sky && quality!=='low'){
    const blades:number[]=[],paint:number[]=[],normals:number[]=[],faces:number[]=[];
    const density=quality==='high'?106:41,root=new T.Color('#9aa34f'),tip=new T.Color('#d5c971');
    for(let r=-1;r<=size;r++)for(let c=-1;c<=size;c++)for(let i=0;i<density;i++){
      const x=c+noise(seed,r,c,i*7+1),z=r+noise(seed,r,c,i*7+2);
      if(x<-.26||z<-.26||x>size+.26||z>size+.26||shore(x,z)<.035)continue;
      const a=noise(seed,r,c,i*7+3)*Math.PI*2,dx=Math.cos(a),dz=Math.sin(a);
      const y=height(x,z)-.002,w=.0035+.003*noise(seed,r,c,i*7+4),h=.021+.031*noise(seed,r,c,i*7+5),k=blades.length/3;
      blades.push(x-dz*w,y,z+dx*w,x+dz*w,y,z-dx*w,x+.010*dx+dz*w*.54,y+h*.56,z+.010*dz-dx*w*.54,x+.023*dx,y+h,z+.023*dz);
      faces.push(k,k+1,k+2,k,k+2,k+3);
      const v=.83+.22*noise(seed,r,c,i*7+6);
      for(const col of [root,root,tip,tip]){paint.push(col.r*v,col.g*v,col.b*v);normals.push(.1*dx,.99,.1*dz);}
    }
    const turf=new T.BufferGeometry();turf.setAttribute('position',new T.Float32BufferAttribute(blades,3));
    turf.setAttribute('color',new T.Float32BufferAttribute(paint,3));turf.setAttribute('normal',new T.Float32BufferAttribute(normals,3));turf.setIndex(faces);
    const bladeMaterial=new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.97});
    bladeMaterial.onBeforeCompile=shader=>{
      shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>','#include <normal_fragment_begin>\nnormal *= faceDirection;');
    };
    const fringe=new T.Mesh(turf,bladeMaterial);
    fringe.receiveShadow=true;group.add(fringe);
  }

  const walls:number[]=[],wallColors:number[]=[],wallFaces:number[]=[];
  const layers=sky?['#bfd4d7','#a1bdc4','#8ea9ae','#889e9e']:['#91a261','#a79569','#917857','#735d49'];
  for(let i=0;i<(land.surround?0:rim.length);i++){
    const k=rim[i]*3,x=positions[k],z=positions[k+2];
    for(let j=0;j<4;j++){
      const bevel=[0,.017,.01,-.08][j];
      walls.push(x+Math.sign(x-size/2)*bevel,positions[k+1]-[0,.07,.19,.37][j]-(j?noise(seed,i,j)*.027:0),z+Math.sign(z-size/2)*bevel);
      tint.set(layers[j]).multiplyScalar(.87+.15*noise(seed,Math.floor(i/3),j));wallColors.push(tint.r,tint.g,tint.b);
      if(j<3){const a=i*4+j,b=(i+1)%rim.length*4+j;wallFaces.push(a,b,a+1,b,b+1,a+1);}
    }
  }
  if(walls.length){
  const side=new T.BufferGeometry();
  side.setAttribute('position',new T.Float32BufferAttribute(walls,3));side.setAttribute('color',new T.Float32BufferAttribute(wallColors,3));
  side.setIndex(wallFaces);side.computeVertexNormals();
  group.add(new T.Mesh(side,new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:1})));
  }
  if(sky && land.surround){
    const deck=new T.Mesh(new T.PlaneGeometry(size,size),new T.MeshBasicMaterial({color:0xd3f0f0,transparent:true,opacity:.46,depthWrite:false}));
    deck.rotation.x=-Math.PI/2;deck.position.set(size/2,-.012,size/2);group.add(deck);
  }

  const waterVertices:number[]=[];
  if(land.hasWater)for(let i=0;i<indices.length;i+=3){
    const face=indices.slice(i,i+3).map(id=>positions.slice(id*3,id*3+3)), clipped:number[][]=[];
    for(let j=0;j<3;j++){
      const a=face[j],b=face[(j+1)%3];
      const ya=land.waterLevel(a[0],a[2]),yb=land.waterLevel(b[0],b[2]),da=a[1]-ya,db=b[1]-yb;
      if(da<0)clipped.push([a[0],ya,a[2]]);
      if((da<0)!==(db<0)){
        const t=da/(da-db);
        clipped.push([a[0]+(b[0]-a[0])*t,ya+(yb-ya)*t,a[2]+(b[2]-a[2])*t]);
      }
    }
    for(let j=1;j<clipped.length-1;j++)waterVertices.push(...clipped[0],...clipped[j],...clipped[j+1]);
  }
  const time={value:0};
  if(waterVertices.length){
    const surface=new T.BufferGeometry();
    surface.setAttribute('position',new T.Float32BufferAttribute(waterVertices,3));
    const depths=waterVertices.filter((_,i)=>i%3===0).map((x,i)=>land.waterDepth(x,waterVertices[i*3+2]));
    surface.setAttribute('depth',new T.Float32BufferAttribute(depths,1));
    const water=new T.ShaderMaterial({fog:true,uniforms:{...T.UniformsUtils.clone(T.UniformsLib.fog),time},vertexShader:`
      #include <fog_pars_vertex>
      attribute float depth; varying vec2 lake; varying float bank; varying vec3 eye;
      void main(){lake=position.xz;bank=depth;eye=cameraPosition-position;
        vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;
        #include <fog_vertex>
      }
    `,fragmentShader:`
      #include <fog_pars_fragment>
      uniform float time; varying vec2 lake; varying float bank; varying vec3 eye;
      void main(){
        vec2 p=lake+vec2(.035*sin(lake.y*8.+time*.53),.046*cos(lake.x*5.-time*.38));
        float w=sin(p.y*31.+p.x*6.+time*.92+sin(p.x*9.+time*.3)*.8);
        float crossWave=sin(p.x*18.-p.y*7.-time*.73);
        vec3 n=normalize(vec3(.082*crossWave,1.,.14*w));
        vec3 view=normalize(eye),h=normalize(view+normalize(vec3(-.55,.78,.3)));
        float fresnel=.09+.45*pow(1.-max(dot(n,view),0.),3.);
        float lines=1.-smoothstep(.0,.15,abs(w+crossWave*.64));
        float shore=1.-smoothstep(.0,.037,bank);
        vec3 color=mix(vec3(.22,.71,.57),vec3(.037,.36,.44),smoothstep(.0,.40,bank));
        color=mix(color,vec3(.69,.89,.83),fresnel+.037*w);
        color+=vec3(.13,.17,.13)*lines*(.3+.7*(1.-smoothstep(.14,.4,bank)));
        color+=vec3(.86,.74,.46)*pow(max(dot(n,h),0.),100.)+vec3(.17,.17,.105)*shore;
        vec2 glintCell=floor(lake*4.), local=fract(lake*4.)-.5;
        float twinkle=pow(max(0.,sin(dot(glintCell,vec2(2.34,4.27))+time*1.18)),20.);
        float spark=max(exp(-abs(local.x)*145.-abs(local.y)*19.),exp(-abs(local.y)*136.-abs(local.x)*20.));
        color+=vec3(1.,.95,.72)*twinkle*spark*smoothstep(.035,.14,bank);
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`});
    group.add(new T.Mesh(surface,water));
  }
  // A lake has one uninterrupted surface. Its cells remain individual DOM hit targets.
  const grid:number[]=[];
  const lineY=(x:number,z:number)=>sky?.012:Math.max(land.hasWater?land.waterLevel(x,z):-1,height(x,z))+.012;
  for(let i=0;showGrid&&i<=size;i++)for(let j=0;j<size*6;j++){
    const a=j/6,b=(j+1)/6,cell=Math.floor(a);
    if(!(land.waterCell(cell,i-1)&&land.waterCell(cell,i)))grid.push(i,lineY(i,a),a,i,lineY(i,b),b);
    if(!(land.waterCell(i-1,cell)&&land.waterCell(i,cell)))grid.push(a,lineY(a,i),i,b,lineY(b,i),i);
  }
  const lines=new T.BufferGeometry();lines.setAttribute('position',new T.Float32BufferAttribute(grid,3));
  group.add(new T.LineSegments(lines,new T.LineBasicMaterial({color:sky?0x65878e:0x475c32,transparent:true,opacity:sky?.43:.24})));
  return {group,time,objects:groundedObjects(land,positions,indices,innerFaces),dispose(){
    trailMap.dispose();
    group.removeFromParent();
    group.traverse(node=>{if(node instanceof T.Mesh || node instanceof T.LineSegments){node.geometry.dispose();node.material.dispose();}});
  }};
}
