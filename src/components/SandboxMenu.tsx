import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ClipboardPaste, Map, Pencil, PencilRuler, Trash2, X } from 'lucide-react';
import { Art, FacilityArt } from './Art';
import { SandboxArt } from './SandboxArt';
import { readClipboard } from '../game/clipboard';
import { key } from '../game/rules';
import type { LocalMap } from '../game/localMaps';
import { deleteLocalMap, renameLocalMap } from '../game/localMaps';
import type { FacilityKind, Shape } from '../game/types';

type SandboxScreen = 'adventure' | 'sandbox' | 'sandbox-size' | 'sandbox-import' | 'local-maps';
type Props = {
  screen: SandboxScreen;
  onBack: () => void;
  onContinue: () => void;
  onSurvival: () => void;
  onNavigate: (screen: 'sandbox' | 'sandbox-size' | 'sandbox-import' | 'local-maps') => void;
  onCreate: (size: 6 | 8) => void;
  onImport: (code: string) => void;
  localMaps: LocalMap[];
  onOpenLocalMap: (map: LocalMap) => void;
  onEditLocalMap: (map: LocalMap) => void;
  onLocalMapsChange: () => void;
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

export function SandboxMenu({ screen, onBack, onContinue, onSurvival, onNavigate, onCreate, onImport, localMaps, onOpenLocalMap, onEditLocalMap, onLocalMapsChange, onSound }: Props) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [pasting, setPasting] = useState(false);
  const [selectedMapId, setSelectedMapId] = useState<number | null>(null);
  const [mapAction, setMapAction] = useState<'delete' | 'rename' | null>(null);
  const [mapName, setMapName] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { setError(''); }, [screen]);
  useEffect(() => {
    if (!mapAction) return;
    dialogRef.current?.showModal();
    if (mapAction === 'rename') { nameRef.current?.focus(); nameRef.current?.select(); }
    else cancelRef.current?.focus();
  }, [mapAction]);

  const act = (action: () => void) => { onSound?.(); action(); };
  const title = screen === 'sandbox' ? '沙盒模式' : screen === 'sandbox-size' ? '选择地图尺寸' : screen === 'sandbox-import' ? '导入地图' : screen === 'local-maps' ? '本地地图' : '模式选择';
  const selectedMap = localMaps.find(map => map.id === selectedMapId) ?? localMaps[0];
  const items = selectedMap?.draft.level.pieces.filter((piece, index, all) => all.findIndex(item => item.kind === piece.kind && item.shape === piece.shape) === index) ?? [];

  function closeMapDialog() { setMapAction(null); setError(''); }
  function editMap(action: 'delete' | 'rename') {
    onSound?.(); setError(''); setMapName(selectedMap.customName || ''); setMapAction(action);
  }
  function confirmMapAction() {
    onSound?.(); setError('');
    try {
      if (mapAction === 'delete') { deleteLocalMap(selectedMap.id); setSelectedMapId(null); }
      else renameLocalMap(selectedMap.id, mapName);
      onLocalMapsChange(); closeMapDialog();
    } catch (cause) { setError(cause instanceof Error ? cause.message : '本地地图保存失败，请重试'); }
  }

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
          <button className="sandbox-choice survival-entry" onClick={() => act(onSurvival)}><span className="sandbox-choice-art"><Art kind="tower"/></span><span className="sandbox-choice-copy"><strong>荒野求生</strong></span><ArrowRight size={18}/></button>
          <button className="sandbox-choice" onClick={() => act(() => onNavigate('sandbox'))}><span className="sandbox-choice-art"><Art kind="forest"/></span><span className="sandbox-choice-copy"><strong>沙盒模式</strong></span><ArrowRight size={18}/></button>
          <button className="sandbox-choice" onClick={() => act(() => onNavigate('local-maps'))}><span className="sandbox-choice-art"><Art kind="fire"/></span><span className="sandbox-choice-copy"><strong>本地地图</strong></span><ArrowRight size={18}/></button>
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
              <span className="local-map-card-art"><Art kind="fire"/></span><span><strong>{map.name}</strong><small className={map.survival ? "survival-card-state" : undefined}>{map.survival ? `荒野求生 · ${map.survival.difficulty}难 · ${map.survival.completed ? '已通关' : '未通关'}` : `${map.draft.level.size}×${map.draft.level.size} · ${map.draft.level.pieces.length} 处设施`}</small></span><ArrowRight size={16}/>
            </button>)}
          </div>
          <section className={`local-map-detail${selectedMap.survival ? ' survival-map-detail' : ''}`} aria-label={selectedMap.name}>
            <div className="local-map-heading"><h2 title={selectedMap.name}>{selectedMap.name}</h2><button className="icon-button local-map-rename" aria-label="编辑地图名称" title="编辑地图名称" onClick={() => editMap('rename')}><Pencil size={16}/></button><span>{selectedMap.draft.level.size}×{selectedMap.draft.level.size}</span></div>
            <div className="local-map-content">
              <div className="local-map-view"><h3>地图样貌</h3><LocalMapPreview map={selectedMap}/></div>
              <div className="local-map-items"><h3>地图放置物品</h3><ul>{items.map(piece => <li key={`${piece.kind}_${piece.shape}`}><span className="local-map-item-art"><FacilityArt kind={piece.kind} shape={piece.shape}/></span><span><strong>{facilityNames[piece.kind]}</strong><small>{shapeNames[piece.shape]}</small></span><b>×{selectedMap.draft.level.pieces.filter(item => item.kind === piece.kind && item.shape === piece.shape).length}</b></li>)}</ul></div>
            </div>
            <div className="local-map-actions"><button className="primary local-map-enter" onClick={() => act(() => onOpenLocalMap(selectedMap))}>进入地图<ArrowRight size={18}/></button>{(!selectedMap.survival || selectedMap.survival.blueprintUnlocked) && <button className="secondary local-map-edit" onClick={() => act(() => onEditLocalMap(selectedMap))}>编辑地图<PencilRuler size={18}/></button>}<button className="primary local-map-delete" onClick={() => editMap('delete')}>删除地图<Trash2 size={16}/></button></div>
          </section>
        </div> : <div className="local-map-empty"><span className="local-map-empty-art"><Art kind="fire"/></span><h2>还没有本地地图</h2><p>创造或导入地图后，点击保存，就能在这里找到本地存档。</p></div>)}
      </div>
      {screen !== 'local-maps' && <div className="sandbox-menu-art" aria-hidden="true"><SandboxArt variant={screen === 'adventure' ? 'adventure' : 'sandbox'}/></div>}
    </div>
    {mapAction && <dialog ref={dialogRef} className="modal local-map-modal" aria-labelledby="local-map-dialog-title" onCancel={event => { event.preventDefault(); closeMapDialog(); }} onClick={event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeMapDialog();
    }}>
      <button className="modal-close icon-button" aria-label="关闭" onClick={closeMapDialog}><X size={19}/></button>
      <h2 id="local-map-dialog-title">{mapAction === 'delete' ? '删除地图' : '编辑地图名称'}</h2>
      <form onSubmit={event => { event.preventDefault(); confirmMapAction(); }}>
        {mapAction === 'delete' ? <p>确定删除“{selectedMap.name}”吗？地图及游玩进度将被删除，剩余地图会顺次编号。</p> : <input ref={nameRef} id="local-map-name" aria-label="地图名称" value={mapName} placeholder={selectedMap.name} onChange={event => { setMapName(event.target.value); setError(''); }} />}
        {error && <p className="sandbox-import-error" role="alert">{error}</p>}
        <div className="sandbox-modal-actions"><button ref={cancelRef} type="button" className="secondary" onClick={closeMapDialog}>取消</button><button type="submit" className={`primary ${mapAction === 'delete' ? 'local-map-delete' : ''}`}>{mapAction === 'delete' ? '删除地图' : '保存名称'}</button></div>
      </form>
    </dialog>}
  </main>;
}
