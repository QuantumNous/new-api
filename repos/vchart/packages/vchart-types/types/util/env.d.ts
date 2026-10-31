import type { RenderMode } from '../typings/spec';
export declare const isBrowser: boolean;
export declare const domDocument: Document;
export declare function isTrueBrowser(mode: RenderMode): boolean;
export declare function isPcLikeMode(mode: RenderMode): boolean;
export declare function isMobileLikeMode(mode: RenderMode): boolean;
export declare function isMiniAppLikeMode(mode: RenderMode): boolean;
