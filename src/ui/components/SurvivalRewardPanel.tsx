import { art } from '../../assets/art';
import { useLayoutEffect, useState } from 'react';
import type { SurvivalReward } from '../../game-modes/survival/survivalChallenge';
import { SURVIVAL_RANKS } from '../../game-modes/survival/survivalDifficulty';
import { useI18n } from '../../localization/LanguageContext';
import { rewardFrame, rewardSegments } from './survivalRewardAnimation';

export function SurvivalRewardPanel({ reward, difficulty, active }: { reward: SurvivalReward; difficulty: number | undefined; active: boolean }) {
  const { t, localize } = useI18n();
  const { xp, earned } = reward;
  const [frame, setFrame] = useState(() => rewardFrame(rewardSegments(xp, earned), 0));
  useLayoutEffect(() => {
    const segments = rewardSegments(xp, earned);
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let animation = 0;
    const finish = () => { cancelAnimationFrame(animation); setFrame(rewardFrame(segments, 1)); };
    if (!active || preference.matches || !earned) { finish(); return; }
    setFrame(rewardFrame(segments, 0));
    const start = performance.now() + 360;
    const tick = (now: number) => {
      const progress = Math.min(1, Math.max(0, (now - start) / 1200));
      setFrame(rewardFrame(segments, progress));
      if (progress < 1) animation = requestAnimationFrame(tick);
    };
    animation = requestAnimationFrame(tick);
    const onPreference = () => { if (preference.matches) finish(); };
    preference.addEventListener('change', onPreference);
    return () => { cancelAnimationFrame(animation); preference.removeEventListener('change', onPreference); };
  }, [active, xp, earned]);

  const before = xp - earned;
  const base = frame.next === undefined ? 1 : Math.max(0, (before - frame.start) / (frame.next - frame.start));
  return <div className="survival-reward">
    <div className={`reward-xp ${earned && active ? frame.done ? 'is-complete' : 'is-growing' : ''}`}>
      <div className="reward-xp-track" role="progressbar" aria-label={t('身份经验进度')} aria-valuemin={frame.start} aria-valuemax={frame.next ?? frame.xp} aria-valuenow={frame.xp} aria-valuetext={t('累计经验 {0} · {1}', frame.xp, localize(SURVIVAL_RANKS[frame.rank].name))}>
        <div className="reward-xp-rail">
          <i className="reward-xp-base" style={{ transform: `scaleX(${base})` }}/>
          <i className="reward-xp-gain" style={{ transform: `translateX(${base * 100}%) scaleX(${Math.max(0, frame.fill - base)})` }}/>
          <span className="reward-xp-cursor" style={{ left: `${frame.fill * 100}%` }}><img src={art.reward.leaf} alt="" aria-hidden="true"/></span>
        </div>
      </div>
      <div className="reward-xp-caption"><span className="reward-earned">{t('+{0}', earned)}</span><span>{frame.next === undefined ? t('{0} · 最高身份', frame.xp) : t('{0} / {1}', frame.xp, frame.next)}</span></div>
    </div>
    {!earned && <p className="reward-repeat">{t('这张地图已通关，本次不重复奖励')}</p>}
    <div className="reward-marks">
      <div className="reward-mark"><img src={art.reward.difficulty} alt="" aria-hidden="true"/><div><strong>{difficulty}</strong><span>{t('挑战难度')}</span></div></div>
      <div className="reward-mark"><img src={art.reward.count} alt="" aria-hidden="true"/><div><strong>{reward.count}</strong><span>{t('通关次数')}</span></div></div>
    </div>
  </div>;
}
