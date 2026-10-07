import { Capacitor, registerPlugin } from '@capacitor/core';

interface NativeClipboard {
  writeText(options: { text: string }): Promise<void>;
  readText(): Promise<{ text: string }>;
}

declare global {
  interface Window {
    wildgridClipboard?: {
      writeText(text: string): Promise<void>;
      readText(): Promise<string>;
    };
  }
}

const nativeClipboard = registerPlugin<NativeClipboard>('WildgridClipboard');
const MAX_TEXT_LENGTH = 32768;

function checkText(text: string): string {
  if (text.length > MAX_TEXT_LENGTH) throw new Error('地图代码过长，请检查复制的内容');
  return text;
}

export async function writeClipboard(text: string): Promise<void> {
  checkText(text);
  if (window.wildgridClipboard) {
    try {
      return await window.wildgridClipboard.writeText(text);
    } catch {
      throw new Error('无法复制地图代码，请再次点击复制');
    }
  }
  if (Capacitor.isNativePlatform()) return nativeClipboard.writeText({ text });
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch { /* Older browsers can still copy during a button press. */ }
  }
  const focused = document.activeElement;
  const input = document.createElement('textarea');
  input.value = text;
  input.readOnly = true;
  input.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
  document.body.appendChild(input);
  input.select();
  input.setSelectionRange(0, text.length);
  try {
    if (!document.execCommand('copy')) throw new Error('无法复制地图代码，请再次点击复制');
  } catch {
    throw new Error('无法复制地图代码，请再次点击复制');
  } finally {
    input.remove();
    if (focused instanceof HTMLElement) focused.focus({ preventScroll: true });
  }
}

export async function readClipboard(): Promise<string> {
  if (window.wildgridClipboard) {
    let text: string;
    try {
      text = await window.wildgridClipboard.readText();
    } catch {
      throw new Error('无法读取剪贴板，请确认地图代码完整，或直接粘贴到输入框');
    }
    return checkText(text);
  }
  if (Capacitor.isNativePlatform()) return checkText((await nativeClipboard.readText()).text);
  if (navigator.clipboard?.readText) {
    let text: string | undefined;
    try {
      text = await navigator.clipboard.readText();
    } catch { /* The browser may require the player to paste manually. */ }
    if (text !== undefined) return checkText(text);
  }
  throw new Error('浏览器未允许读取剪贴板，请长按输入框或使用粘贴快捷键');
}
