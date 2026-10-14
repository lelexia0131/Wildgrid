import type { Language } from '../i18n';
import type { useTutorial } from '../hooks/useTutorial';
import { audio } from '../game/audio';

export function TutorialSettings({ tutorial }: { tutorial: ReturnType<typeof useTutorial> }) {
  const { state, copy, saved, message, update, reset } = tutorial;
  return <div className="tutorial-settings">
    <label className="tutorial-language">{copy.settings.language}<select data-sound="handled" aria-label={copy.settings.language} value={state.language} onChange={e => { update(s => ({ ...s, language: e.target.value as Language })); audio.feedback('select'); }}><option value="zh">中文</option><option value="en">English</option></select></label>
    <button className={`mute-setting ${state.enabled ? 'is-muted' : ''}`} data-sound="select" role="switch" aria-checked={state.enabled} onClick={() => update(s => ({ ...s, enabled: !s.enabled }))}><span>{copy.settings.tutorials}</span><i/></button>
    <button className="tutorial-setting-action" data-sound="confirm" onClick={reset}>{copy.settings.reset}</button>
    {(!saved || message) && <p role="status">{!saved ? copy.settings.saveError : message && copy.settings[message]}</p>}
  </div>;
}
