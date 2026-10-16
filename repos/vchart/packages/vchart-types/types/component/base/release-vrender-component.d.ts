import type { IGraphic } from '@visactor/vrender-core';
type ReleaseVRenderComponentOptions = {
    enableExitAnimation?: boolean;
    removeFromParent?: boolean;
    onComplete?: () => void;
};
export declare const releaseVRenderComponentSync: (component: IGraphic, removeFromParent?: boolean) => void;
export declare const collectVRenderComponents: (component: IGraphic) => IGraphic[];
export declare const releaseVRenderComponent: (component: IGraphic, options?: ReleaseVRenderComponentOptions) => boolean;
export {};
