import type { utilFunctionCtx } from '../typings/params';
import { error } from './debug';
/**
 * @description 图片导出相关接口
 */

export function URLToImage(name: string = 'vchart', url: string) {
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('target', '_blank');
  link.setAttribute('download', `${name}.png`);
  link.dispatchEvent(new MouseEvent('click'));
}

export function OffscreenCanvasToDataURL(c: OffscreenCanvas) {
  // eslint-disable-next-line promise/param-names
  return new Promise((r: (s: string) => void) => {
    c.convertToBlob().then((b: any) => {
      const reader = new FileReader();
      reader.readAsDataURL(b);
      reader.onload = () => {
        r(reader.result as string);
      };
    });
  });
}

export async function getCanvasDataURL(c: HTMLCanvasElement | OffscreenCanvas, ctx?: utilFunctionCtx) {
  if (!c) {
    return '';
  }
  try {
    if (OffscreenCanvas !== undefined && c instanceof OffscreenCanvas) {
      return OffscreenCanvasToDataURL(c);
    }
  } catch (_error) {
    (ctx?.onError ?? error)(`getCanvasDataURL error : ${_error.toString()}`);
  }
  return (<HTMLCanvasElement>c).toDataURL();
}
