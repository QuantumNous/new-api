import type { IApp, IStage, IStageParams } from '@visactor/vrender-core';
import { type RenderMode } from '../typings/spec/common';
type VRenderAppEnv = 'browser' | 'node' | 'feishu' | 'tt' | 'wx' | 'lynx' | 'harmony';
export type ResolveVRenderAppOptions = {
    app?: IApp;
    mode?: RenderMode;
    modeParams?: unknown;
};
export type ResolvedVRenderApp = {
    app: IApp;
    releaseAppRef?: () => void;
};
export declare const getVRenderAppEnv: (mode?: RenderMode) => VRenderAppEnv;
export declare const getVRenderAppEnvParams: (mode?: RenderMode, modeParams?: unknown) => unknown;
export declare const resolveVRenderApp: (appOrOptions?: IApp | ResolveVRenderAppOptions, mode?: RenderMode) => ResolvedVRenderApp;
export declare const createStageFromApp: (app: IApp, params: Partial<IStageParams>) => IStage;
export {};
