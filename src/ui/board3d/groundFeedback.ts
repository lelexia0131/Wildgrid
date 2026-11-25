import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Mesh, MeshBasicMaterial } from 'three';
import { facilityLayer, key, occupied, placementOrigin } from '../../engine';
import type { Cell } from '../../engine';
import type { BoardView, landscape } from './landscape';

// Ribbons and washes belong on the ground. Depth testing lets roofs, railings and
// rocks cover them naturally. Adjacent cells of one footprint share an outer outline.
export function groundFeedback(view:BoardView,land:ReturnType<typeof landscape>){
  const pos:number[]=[],rgba:number[]=[],indices:number[]=[],color=new Color();
  const y=(x:number,z:number)=>land.sky?.021:Math.max(land.height(x,z),land.waterLevel(x,z))+.016;
  function patch(x:number,z:number,w:number,d:number,hex:number,opacity:number,raise:number){
    const start=pos.length/3;color.setHex(hex);
    for(const [a,b] of [[x,z],[x,z+d],[x+w,z],[x+w,z+d]]){
      pos.push(a,y(a,b)+raise,b);rgba.push(color.r,color.g,color.b,opacity);
    }
    indices.push(start,start+1,start+2,start+2,start+1,start+3);
  }
  function outline(cells:readonly Cell[],hex:number,opacity:number,w=.039,raise=.009){
    const inside=new Set(cells.map(key));
    for(const {r,c} of cells){
      if(r<0||c<0||r>=land.size||c>=land.size)continue;
      for(let i=0;i<6;i++){
        const t=i/6;
        if(!inside.has(key({r:r-1,c})))patch(c+t,r,1/6,w,hex,opacity,raise);
        if(!inside.has(key({r:r+1,c})))patch(c+t,r+1-w,1/6,w,hex,opacity,raise);
        if(!inside.has(key({r,c:c-1})))patch(c,r+t,w,1/6,hex,opacity,raise);
        if(!inside.has(key({r,c:c+1})))patch(c+1-w,r+t,w,1/6,hex,opacity,raise);
      }
    }
  }
  if(!view.finished){
    for(const [id,status] of Object.entries(view.ruleHints??{})){
      const [r,c]=id.split(',').map(Number);
      patch(c+.05,r+.05,.90,.90,status==='INVALID'?0xe78264:status==='VALID'?0x87c966:0xe5c57a,.22,0);
    }
    let underPointer:readonly Cell[]|undefined;
    for(const at of view.placements){
      const piece=view.level.pieces.find(p=>p.id===at.id)!;
      if(facilityLayer(piece.kind)!==view.layer)continue;
      const cells=occupied(piece,at);
      if(view.hover&&cells.some(p=>p.r===view.hover!.r&&p.c===view.hover!.c))underPointer=cells;
      if(view.issues?.[at.id]?.status==='INVALID')outline(cells,0xd1684d,.92);
    }
    if(view.hintRegion?.length)outline(view.hintRegion,0xf5c36d,.92);
    if(view.hover){
      if(underPointer)outline(underPointer,0xffeab6,1,.049,.017);
      else if(view.selected){
        const rotation=view.rotation??0, origin=placementOrigin(view.selected.shape,rotation,view.hover);
        outline(occupied(view.selected,{...origin,id:view.selected.id,rotation}),view.blocked?0xf07858:0xc8f49a,1,.054,.017);
      }else outline([view.hover],0xfff0bd,.95);
    }
  }
  const geo=new BufferGeometry();geo.setAttribute('position',new Float32BufferAttribute(pos,3));
  geo.setAttribute('color',new Float32BufferAttribute(rgba,4));geo.setIndex(indices);
  const mat=new MeshBasicMaterial({vertexColors:true,transparent:true,depthTest:true,depthWrite:false,side:DoubleSide,polygonOffset:true,polygonOffsetFactor:-1});
  const mesh=new Mesh(geo,mat);mesh.renderOrder=1;
  return {mesh,dispose(){mesh.removeFromParent();geo.dispose();mat.dispose();}};
}
