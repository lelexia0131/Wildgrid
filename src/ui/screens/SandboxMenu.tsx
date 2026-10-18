import { useI18n } from '../../localization/LanguageContext';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ClipboardPaste, Image, Map, Pencil, PencilRuler, Trash2, X } from 'lucide-react';
import { Art, FacilityArt } from '../components/Art';
import { MenuIcon } from '../components/MenuIcon';
import { SandboxArt } from '../components/SandboxArt';
import { readClipboard } from '../../platform/clipboard';
import { audio } from '../../platform/audio/WildernessAudio';
import { key } from '../../engine';
import { facilityNames, shapeNames } from '../../engine';
import type { LocalMap } from '../../game-modes/sandbox/localMapCollection';
import { deleteLocalMap, renameLocalMap, setLocalMapIcon } from '../../save-system/localMapStorage';
import { MAP_ICON_CHOICES } from '../../game-modes/sandbox/mapIcons';
import type { MapIconId } from '../../game-modes/sandbox/mapIcons';

function ModeLettering({ children }: { children: string }) {
  return <strong className="mode-lettering" aria-label={children}>{[...children].map((letter, i) => <span key={i} aria-hidden="true">{letter}</span>)}</strong>;
}

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
};

function LocalMapPreview({ map }: { map: LocalMap }) {
  const { t, localize } = useI18n();
  const { level } = map.draft;
  return <div className="board local-map-preview" role="img" aria-label={localize(t("{0}的固定地形预览，{1}×{2}", map.name, level.size, level.size))} style={{ '--size': level.size } as React.CSSProperties}>
    {Array.from({ length: level.size * level.size }, (_, index) => {
      const cell = { r: Math.floor(index / level.size), c: index % level.size };
      const terrain = level.terrain.find(item => key(item) === key(cell));
      return <div key={index} className={`tile ${terrain ? `terrain-${terrain.kind}` : ''}`}>
        {terrain ? <Art kind={terrain.kind}/> : <span className={`grass grass-${index % 5}`}><i/><i/></span>}
      </div>;
    })}
  </div>;
}

export function SandboxMenu({ screen, onBack, onContinue, onSurvival, onNavigate, onCreate, onImport, localMaps, onOpenLocalMap, onEditLocalMap, onLocalMapsChange }: Props) {
  const { t, localize } = useI18n();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [pasting, setPasting] = useState(false);
  const [selectedMapId, setSelectedMapId] = useState<number | null>(null);
  const [mapAction, setMapAction] = useState<'delete' | 'rename' | 'icon' | null>(null);
  const [mapName, setMapName] = useState('');
  const [mapIcon, setMapIcon] = useState<MapIconId>('maps');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { setError(''); }, [screen]);
  useEffect(() => {
    if (!mapAction) return;
    dialogRef.current?.showModal();
    if (mapAction === 'rename') { nameRef.current?.focus(); nameRef.current?.select(); }
    else if (mapAction === 'icon') dialogRef.current?.querySelector<HTMLButtonElement>('.map-icon-picker button[aria-pressed="true"]')?.focus();
    else cancelRef.current?.focus();
  }, [mapAction]);

  const title = screen === 'sandbox' ? '沙盒模式' : screen === 'sandbox-size' ? '选择地图尺寸' : screen === 'sandbox-import' ? '导入地图' : screen === 'local-maps' ? '本地地图' : '模式选择';
  const selectedMap = localMaps.find(map => map.id === selectedMapId) ?? localMaps[0];
  const items = selectedMap?.draft.level.pieces.filter((piece, index, all) => all.findIndex(item => item.kind === piece.kind && item.shape === piece.shape) === index) ?? [];

  function closeMapDialog(playClose = true) { if (playClose) audio.feedback('close'); setMapAction(null); setError(''); }
  function editMap(action: 'delete' | 'rename' | 'icon') {
    setError(''); setMapName(selectedMap.customName || ''); setMapIcon(selectedMap.icon || 'maps'); setMapAction(action);
  }
  function confirmMapAction() {
    setError('');
    try {
      if (mapAction === 'delete') { deleteLocalMap(selectedMap.id); setSelectedMapId(null); }
      else if (mapAction === 'icon') setLocalMapIcon(selectedMap.id, mapIcon);
      else renameLocalMap(selectedMap.id, mapName);
      onLocalMapsChange(); closeMapDialog(false); audio.feedback('success');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '本地地图保存失败，请重试'); audio.feedback('error'); }
  }

  async function paste() {
    setError(''); setPasting(true);
    try {
      const value = await readClipboard();
      if (!value.trim()) { setError('剪贴板里还没有地图代码，请复制后再试。'); audio.feedback('error'); }
      else { setCode(value); inputRef.current?.focus(); audio.feedback('success'); }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '暂时无法读取剪贴板，请在输入框中粘贴地图代码。');
      audio.feedback('error');
    } finally { setPasting(false); }
  }

  function importMap() {
    setError('');
    try { onImport(code.trim()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '地图代码无效或已损坏'); audio.feedback('error'); }
  }

  return <main className={`sandbox-menu-page ${screen === 'sandbox-import' ? 'sandbox-import-page' : ''} ${screen === 'local-maps' ? 'local-maps-page' : ''}`}>
    {screen === 'local-maps' ? <div className="local-maps-topline"><button className="back-link sandbox-back" data-sound="close" aria-label={t("返回上一页")} onClick={onBack}><ArrowLeft size={16}/>{t("返回")}</button><h1>{localize(title)}</h1></div> : <button className="back-link sandbox-back" data-sound="close" aria-label={t("返回上一页")} onClick={onBack}><ArrowLeft size={16}/>{t("返回")}</button>}
    <div className="sandbox-menu-layout">
      <div className="sandbox-menu-copy">
        {screen !== 'local-maps' && <h1>{localize(title)}</h1>}
        {screen === 'adventure' && <div className="sandbox-choices">
          <button className="sandbox-choice mode-adventure" data-sound="handled" onClick={onContinue}><span className="sandbox-choice-art"><MenuIcon kind="adventure"/></span><span className="sandbox-choice-copy"><ModeLettering>{t("继续冒险")}</ModeLettering></span><ArrowRight size={18}/></button>
          <button className="sandbox-choice survival-entry mode-survival" data-sound="handled" onClick={onSurvival}><span className="sandbox-choice-art"><MenuIcon kind="survival"/></span><span className="sandbox-choice-copy"><ModeLettering>{t("荒野求生")}</ModeLettering></span><ArrowRight size={18}/></button>
          <button className="sandbox-choice mode-sandbox" onClick={() => onNavigate('sandbox')}><span className="sandbox-choice-art"><MenuIcon kind="sandbox"/></span><span className="sandbox-choice-copy"><ModeLettering>{t("沙盒模式")}</ModeLettering></span><ArrowRight size={18}/></button>
          <button className="sandbox-choice mode-maps" onClick={() => onNavigate('local-maps')}><span className="sandbox-choice-art"><MenuIcon kind="maps"/></span><span className="sandbox-choice-copy"><ModeLettering>{t("本地地图")}</ModeLettering></span><ArrowRight size={18}/></button>
        </div>}
        {screen === 'sandbox' && <div className="sandbox-choices">
          <button className="sandbox-choice" onClick={() => onNavigate('sandbox-size')}><span className="sandbox-choice-icon"><PencilRuler size={25}/></span><span className="sandbox-choice-copy"><strong>{t("创造地图")}</strong></span><ArrowRight size={18}/></button>
          <button className="sandbox-choice" onClick={() => onNavigate('sandbox-import')}><span className="sandbox-choice-icon"><Map size={25}/></span><span className="sandbox-choice-copy"><strong>{t("导入地图")}</strong></span><ArrowRight size={18}/></button>
        </div>}
        {screen === 'sandbox-size' && <div className="sandbox-size-choices">
          {([6, 8] as const).map(size => <button key={size} className="sandbox-size-card" data-sound="handled" onClick={() => onCreate(size)}>
            <span className="sandbox-size-preview" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }} aria-hidden="true">{Array.from({ length: size * size }, (_, i) => <i key={i}/>)}</span>
            <strong>{size}×{size}</strong>
          </button>)}
        </div>}
        {screen === 'sandbox-import' && <section className="sandbox-import-card">
          <div className="sandbox-import-heading"><label htmlFor="sandbox-map-code">{t("地图代码")}</label><button className="sandbox-paste" data-sound="handled" disabled={pasting} onClick={() => { void paste(); }}><ClipboardPaste size={15}/>{localize(pasting ? t("正在粘贴…") : t("从剪贴板粘贴"))}</button></div>
          <textarea ref={inputRef} id="sandbox-map-code" value={code} placeholder="WG1:…" onChange={event => { setCode(event.target.value); setError(''); }} spellCheck={false} autoCapitalize="off" autoCorrect="off" aria-invalid={!!error} aria-describedby={error ? 'sandbox-import-error' : undefined}/>
          {error && <p id="sandbox-import-error" className="sandbox-import-error" role="alert">{localize(error)}</p>}
          <button className="primary sandbox-import-start" data-sound="handled" disabled={!code.trim() || pasting} onClick={importMap}>{t("开始游玩")}<ArrowRight size={18}/></button>
        </section>}
        {screen === 'local-maps' && (selectedMap ? <div className="local-map-browser">
          <div className="local-map-list" aria-label={t("本地存档")}>
            {localMaps.map(map => <button key={map.id} className={`local-map-card ${map.id === selectedMap.id ? 'active' : ''}`} data-sound="select" aria-pressed={map.id === selectedMap.id} onClick={() => setSelectedMapId(map.id)}>
              <span className="local-map-card-art"><MenuIcon kind={map.icon || 'maps'}/></span><span><strong>{localize(map.name)}</strong><small className={map.survival ? "survival-card-state" : undefined}>{localize(map.survival ? t("{0}难 · {1}", map.survival.difficulty, map.survival.completed ? '已通关' : '未通关') : t("{0}×{1} · {2} 处设施", map.draft.level.size, map.draft.level.size, map.draft.level.pieces.length))}</small></span><ArrowRight size={16}/>
            </button>)}
          </div>
          <section className="local-map-detail" aria-label={localize(selectedMap.name)}>
            <div className="local-map-heading"><h2 title={localize(selectedMap.name)}>{localize(selectedMap.name)}</h2><button className="icon-button local-map-rename" aria-label={t("编辑地图名称")} title={t("编辑地图名称")} onClick={() => editMap('rename')}><Pencil size={16}/></button><span>{selectedMap.draft.level.size}×{selectedMap.draft.level.size}</span></div>
            <div className="local-map-content">
              <div className="local-map-view"><h3>{t("地图样貌")}</h3><LocalMapPreview map={selectedMap}/></div>
              <div className="local-map-items"><h3>{t("地图放置物品")}</h3><ul>{items.map(piece => <li key={`${piece.kind}_${piece.shape}`}><span className="local-map-item-art"><FacilityArt kind={piece.kind} shape={piece.shape}/></span><span><strong>{localize(facilityNames[piece.kind])}</strong><small>{localize(shapeNames[piece.shape])}</small></span><b>×{selectedMap.draft.level.pieces.filter(item => item.kind === piece.kind && item.shape === piece.shape).length}</b></li>)}</ul></div>
            </div>
            <div className="local-map-actions"><button className="primary local-map-enter" data-sound="handled" onClick={() => onOpenLocalMap(selectedMap)}>{t("进入地图")}<ArrowRight size={18}/></button><button className="secondary local-map-edit" data-sound="handled" disabled={!!selectedMap.survival && !selectedMap.survival.blueprintUnlocked} title={localize(selectedMap.survival && !selectedMap.survival.blueprintUnlocked ? t("通关或放弃荒野求生挑战后可编辑") : t("编辑地图"))} onClick={() => onEditLocalMap(selectedMap)}>{t("编辑地图")}<PencilRuler size={18}/></button><button className="primary local-map-delete" onClick={() => editMap('delete')}>{t("删除地图")}<Trash2 size={16}/></button><button className="secondary local-map-icon-edit" onClick={() => editMap('icon')}>{t("编辑图标")}<Image size={18}/></button></div>
          </section>
        </div> : <div className="local-map-empty"><span className="local-map-empty-art"><MenuIcon kind="maps"/></span><h2>{t("还没有本地地图")}</h2><p>{t("创造或导入地图后，点击保存，就能在这里找到本地存档。")}</p></div>)}
      </div>
      {screen !== 'local-maps' && <div className="sandbox-menu-art" aria-hidden="true"><SandboxArt variant={screen === 'adventure' ? 'adventure' : 'sandbox'}/></div>}
    </div>
    {mapAction && <dialog ref={dialogRef} className="modal local-map-modal" aria-labelledby="local-map-dialog-title" onCancel={event => { event.preventDefault(); closeMapDialog(); }} onClick={event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeMapDialog();
    }}>
      <button className="modal-close icon-button" data-sound="handled" aria-label={t("关闭")} onClick={() => closeMapDialog()}><X size={19}/></button>
      <h2 id="local-map-dialog-title">{localize(mapAction === 'delete' ? t("删除地图") : mapAction === 'icon' ? t("编辑图标") : t("编辑地图名称"))}</h2>
      <form onSubmit={event => { event.preventDefault(); confirmMapAction(); }}>
        {mapAction === 'delete' ? <p>{t("确定删除“")}{localize(selectedMap.name)}{t("”吗？地图及游玩进度将被删除，剩余地图会顺次编号。")}</p> : mapAction === 'icon' ? <div className="map-icon-picker" role="group" aria-label={t("选择图标")}>{MAP_ICON_CHOICES.map(icon => <button type="button" key={icon.id} data-map-icon={icon.id} data-sound="select" className={mapIcon === icon.id ? 'active' : ''} aria-label={localize(icon.name)} aria-pressed={mapIcon === icon.id} onClick={() => { setMapIcon(icon.id); setError(''); }}><MenuIcon kind={icon.id}/></button>)}</div> : <input ref={nameRef} id="local-map-name" aria-label={t("地图名称")} value={mapName} placeholder={localize(selectedMap.name)} onChange={event => { setMapName(event.target.value); setError(''); }} />}
        {error && <p className="sandbox-import-error" role="alert">{localize(error)}</p>}
        <div className="sandbox-modal-actions"><button ref={cancelRef} type="button" className="secondary" data-sound="handled" onClick={() => closeMapDialog()}>{t("取消")}</button><button type="submit" data-sound="handled" className={`primary ${mapAction === 'delete' ? 'local-map-delete' : ''}`}>{localize(mapAction === 'delete' ? t("删除地图") : mapAction === 'icon' ? t("保存图标") : t("保存名称"))}</button></div>
      </form>
    </dialog>}
  </main>;
}
