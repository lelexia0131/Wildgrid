import { useEffect, useState } from 'react';
import { useI18n } from '../../localization/LanguageContext';

const messages = [
  '篝火正在和森林保持距离',
  '餐车正在倒车入营',
  '野餐桌正在抢占风景位',
  '电塔正在整理发型',
  '帐篷正在练习站稳',
  '瞭望塔正在踮脚看路',
  '水源正在咕嘟咕嘟',
  '小树正在排队晒太阳',
  '山地正在努力不挡路',
  '泳池正在谢绝小鸭插队',
  '草地正在给营地腾位置',
  '地图正在藏好标准答案',
] as const;

export function GenerationMessage() {
  const { t } = useI18n();
  const [index, setIndex] = useState(() => Math.floor(Math.random() * messages.length));
  useEffect(() => {
    const timer = setInterval(() => setIndex(previous => (previous + 1 + Math.floor(Math.random() * (messages.length - 1))) % messages.length), 2000);
    return () => clearInterval(timer);
  }, []);
  return <h1 role="status">{t(messages[index])}</h1>;
}
