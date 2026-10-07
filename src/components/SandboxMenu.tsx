import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ClipboardPaste, Map, PencilRuler } from 'lucide-react';
import { Art, FacilityArt } from './Art';
import { SandboxArt } from './SandboxArt';
import { readClipboard } from '../game/clipboard';
import { key } from '../game/rules';
import type { LocalMap } from '../game/localMaps';
import type { FacilityKind, Shape } from '../game/types';

type SandboxScreen = 'adventure' | 'sandbox' | 'sandbox-size' | 'sandbox-import' | 'local-maps';
type Props = {
  screen: SandboxScreen;
  onBack: () => void;
  onContinue: () => void;
  onNavigate: (screen: 'sandbox' | 'sandbox-size' | 'sandbox-import' | 'local-maps') => void;
  onCreate: (size: 6 | 8) => void;
  onImport: (code: string) => void;
  localMaps: LocalMap[];
  onOpenLocalMap: (map: LocalMap) => void;
  onSound?: () => void;
};

const facilityNames: Record<FacilityKind, string> = { camp: '营地', fire: '篝火', tower: '瞭望塔', picnic: '野餐桌', cabin: '林间木屋' };
const shapeNames: Record<Shape, string> = { single: '单格', domino: '双格', long: '三格', el: 'L 形' };

function LocalMapPreview({ map }: { map: LocalMap }) {
  const { level } = map.draft;
  return <div className="board local-map-preview" role="img" aria-label={`${map.name}的固定地形预览，${level.size}×${level.size}`} style={{ '--size': level.size } as React.CSSProperties}>
    {Array.from({ length: level.size * level.size }, (_, index) => {
      const cell = { r: Math.floor(index / level.size), c: index % level.size };
      const terrain = level.terrain.find(item => key(item) === key(cell));
      return <div key={index} className={`tile ${terrain ? `terrain-${terrain.kind}` : ''}`}>
        {terrain ? <Art kind={terrain.kind}/> : <span className={`grass grass-${index % 5}`}><i/><i/></span>}
      </div>;
    })}
  </div>;
}

export function SandboxMenu({ screen, onBack, onContinue, onNavigate, onCreate, onImport, localMaps, onOpenLocalMap, onSound }: Props) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [pasting, setPasting] = useState(false);
  const [selectedMapId, setSelectedMapId] = useState<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { setError(''); }, [screen]);

  const act = (action: () => void) => { onSound?.(); action(); };
  const title = screen === 'sandbox' ? '沙盒模式' : screen === 'sandbox-size' ? '选择地图尺寸' : screen === 'sandbox-import' ? '导入地图' : screen === 'local-maps' ? '本地地图' : '模式选择';
  const selectedMap = localMaps.find(map => map.id === selectedMapId) ?? localMaps[0];
  const items = selectedMap?.draft.level.pieces.filter((piece, index, all) => all.findIndex(item => item.kind === piece.kind && item.shape === piece.shape) === index) ?? [];

  async function paste() {
    onSound?.(); setError(''); setPasting(true);
    try {
      const value = await readClipboard();
      if (!value.trim()) setError('剪贴板里还没有地图代码，请复制后再试。');
      else { setCode(value); inputRef.current?.focus(); }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '暂时无法读取剪贴板，请在输入框中粘贴地图代码。');
    } finally { setPasting(false); }
  }

  function importMap() {
    onSound?.(); setError('');
    try { onImport(code.trim()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '地图代码无效或已损坏'); }
  }

  return <main className={`sandbox-menu-page ${screen === 'sandbox-import' ? 'sandbox-import-page' : ''} ${screen === 'local-maps' ? 'local-maps-page' : ''}`}>
    {screen === 'local-maps' ? <div className="local-maps-topline"><button className="back-link sandbox-back" aria-label="返回上一页" onClick={() => act(onBack)}><ArrowLeft size={16}/>返回</button><h1>{title}</h1></div> : <button className="back-link sandbox-back" aria-label="返回上一页" onClick={() => act(onBack)}><ArrowLeft size={16}/>返回</button>}
    <div className="sandbox-menu-layout">
      <div className="sandbox-menu-copy">
        {screen !== 'local-maps' && <h1>{title}</h1>}
        {screen === 'adventure' && <div className="sandbox-choices">
          <button className="sandbox-choice" onClick={() => act(onContinue)}><span className="sandbox-choice-art"><Art kind="camp"/></span><span className="sandbox-choice-copy"><strong>继续冒险</strong></span><ArrowRight size={18}/></button>
          <button className="sandbox-choice" onClick={() => act(() => onNavigate('sandbox'))}><span className="sandbox-choice-art"><Art kind="forest"/></span><span className="sandbox-choice-copy"><strong>沙盒模式</strong></span><ArrowRight size={18}/></button>
          <button className="sandbox-choice" onClick={() => act(() => onNavigate('local-maps'))}><span className="sandbox-choice-icon"><Art kind="fire"/></span><span className="sandbox-choice-copy"><strong>本地地图</strong></span><ArrowRight size={18}/></button>
        </div>}
        {screen === 'sandbox' && <div className="sandbox-choices">
          <button className="sandbox-choice" onClick={() => act(() => onNavigate('sandbox-size'))}><span className="sandbox-choice-icon"><PencilRuler size={25}/></span><span className="sandbox-choice-copy"><strong>创造地图</strong></span><ArrowRight size={18}/></button>
          <button className="sandbox-choice" onClick={() => act(() => onNavigate('sandbox-import'))}><span className="sandbox-choice-icon"><Map size={25}/></span><span className="sandbox-choice-copy"><strong>导入地图</strong></span><ArrowRight size={18}/></button>
        </div>}
        {screen === 'sandbox-size' && <div className="sandbox-size-choices">
          {([6, 8] as const).map(size => <button key={size} className="sandbox-size-card" onClick={() => act(() => onCreate(size))}>
            <span className="sandbox-size-preview" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }} aria-hidden="true">{Array.from({ length: size * size }, (_, i) => <i key={i}/>)}</span>
            <strong>{size}×{size}</strong>
          </button>)}
        </div>}
        {screen === 'sandbox-import' && <section className="sandbox-import-card">
          <div className="sandbox-import-heading"><label htmlFor="sandbox-map-code">地图代码</label><button className="sandbox-paste" disabled={pasting} onClick={() => { void paste(); }}><ClipboardPaste size={15}/>{pasting ? '正在粘贴…' : '从剪贴板粘贴'}</button></div>
          <textarea ref={inputRef} id="sandbox-map-code" value={code} placeholder="WG1:…" onChange={event => { setCode(event.target.value); setError(''); }} spellCheck={false} autoCapitalize="off" autoCorrect="off" aria-invalid={!!error} aria-describedby={error ? 'sandbox-import-error' : undefined}/>
          {error && <p id="sandbox-import-error" className="sandbox-import-error" role="alert">{error}</p>}
          <button className="primary sandbox-import-start" disabled={!code.trim() || pasting} onClick={importMap}>开始游玩<ArrowRight size={18}/></button>
        </section>}
        {screen === 'local-maps' && (selectedMap ? <div className="local-map-browser">
          <div className="local-map-list" aria-label="本地存档">
            {localMaps.map(map => <button key={map.id} className={`local-map-card ${map.id === selectedMap.id ? 'active' : ''}`} aria-pressed={map.id === selectedMap.id} onClick={() => act(() => setSelectedMapId(map.id))}>
              <span className="local-map-card-art"><Art kind="fire"/></span><span><strong>{map.name}</strong><small>{map.draft.level.size}×{map.draft.level.size} · {map.draft.level.pieces.length} 处设施</small></span><ArrowRight size={16}/>
            </button>)}
          </div>
          <section className="local-map-detail" aria-label={selectedMap.name}>
            <div className="local-map-heading"><h2>{selectedMap.name}</h2><span>{selectedMap.draft.level.size}×{selectedMap.draft.level.size}</span></div>
            <div className="local-map-content">
              <div className="local-map-view"><h3>地图样貌</h3><LocalMapPreview map={selectedMap}/></div>
              <div className="local-map-items"><h3>地图放置物品</h3><ul>{items.map(piece => <li key={`${piece.kind}_${piece.shape}`}><span className="local-map-item-art"><FacilityArt kind={piece.kind} shape={piece.shape}/></span><span><strong>{facilityNames[piece.kind]}</strong><small>{shapeNames[piece.shape]}</small></span><b>×{selectedMap.draft.level.pieces.filter(item => item.kind === piece.kind && item.shape === piece.shape).length}</b></li>)}</ul></div>
            </div>
            <button className="primary local-map-enter" onClick={() => act(() => onOpenLocalMap(selectedMap))}>进入地图<ArrowRight size={18}/></button>
          </section>
        </div> : <div className="local-map-empty"><span className="local-map-empty-art"><Art kind="fire"/></span><h2>还没有本地地图</h2><p>创造或导入地图后，点击保存，就能在这里找到本地存档。</p></div>)}
      </div>
      {screen !== 'local-maps' && <div className="sandbox-menu-art" aria-hidden="true"><SandboxArt variant={screen === 'adventure' ? 'adventure' : 'sandbox'}/></div>}
    </div>
  </main>;
}
