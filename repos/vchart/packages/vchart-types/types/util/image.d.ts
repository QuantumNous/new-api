import type { utilFunctionCtx } from '../typings/params';
export declare function URLToImage(name: string, url: string): void;
export declare function OffscreenCanvasToDataURL(c: OffscreenCanvas): Promise<string>;
export declare function getCanvasDataURL(c: HTMLCanvasElement | OffscreenCanvas, ctx?: utilFunctionCtx): Promise<string>;
