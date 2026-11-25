// Evidence adapters for frozen, pre-rename fixtures. The game accepts only the current ID.
import type { Level, Terrain } from '../../src/engine';

export const fixtureTerrain = (cells: readonly {kind:string;r:number;c:number}[]): Terrain[] => cells.map(t=>{
  if(t.kind==='mountain')return {...t,kind:'rock'};
  if(t.kind==='forest'||t.kind==='water')return {...t,kind:t.kind};
  throw new Error('Unexpected historical terrain '+t.kind);
});
export function historicalLevel(level:Level) {
  return {...level,tip:level.tip.replace('沿着岩石边缘','沿着山脚').replace('瞭望塔邻岩石，','瞭望塔邻山，').replaceAll('岩石','山地'),
    terrain:level.terrain.map(t=>({...t,kind:t.kind==='rock'?'mountain':t.kind}))};
}
export function fixtureCode(code:string,from:'mountain'|'rock',to:'rock'|'mountain'){
  const payload=JSON.parse(Buffer.from(code.slice(4),'base64url').toString('utf8'));
  for(const t of payload.t)if(t[0]===from)t[0]=to;
  return 'WG1:'+Buffer.from(JSON.stringify(payload)).toString('base64url');
}
