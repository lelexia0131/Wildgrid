import { checkSandbox } from './sandbox';
import type { SandboxDraft } from './sandbox';

self.onmessage = (event: MessageEvent<SandboxDraft>) => {
  try { self.postMessage(checkSandbox(event.data)); }
  catch { self.postMessage({ status: 'invalid', message: '营地自检失败：地图数据无效，请检查后重试' }); }
};
