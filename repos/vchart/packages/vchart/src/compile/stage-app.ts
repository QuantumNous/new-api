import { acquireSharedVRenderApp } from '@visactor/vrender/entries/shared';
import type { IApp, IStage, IStageParams } from '@visactor/vrender-core';
import { RenderModeEnum, type RenderMode } from '../typings/spec/common';

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

export const getVRenderAppEnv = (mode?: RenderMode): VRenderAppEnv => {
  switch (mode) {
    case RenderModeEnum.node:
    case RenderModeEnum.worker:
      return 'node';
    case RenderModeEnum.miniApp:
    case RenderModeEnum['desktop-miniApp']:
      return 'feishu';
    case RenderModeEnum.wx:
      return 'wx';
    case RenderModeEnum.tt:
      return 'tt';
    case RenderModeEnum.harmony:
      return 'harmony';
    case RenderModeEnum.lynx:
      return 'lynx';
    default:
      return 'browser';
  }
};

const isObjectLike = (value: unknown): value is Record<string, unknown> =>
  value != null && (typeof value === 'object' || typeof value === 'function');

const APP_ENV_PARAM_KEYS_BY_ENV = {
  lynx: ['pixelRatio', 'lynx', 'runtime', 'canvasFactory'],
  harmony: ['pixelRatio', 'harmony', 'runtime', 'canvasFactory']
} as const;

/**
 * App envParams carry only app-scope environment capabilities. Concrete canvas
 * view binding, including Lynx domref/canvasIdLists/freeCanvasIdx, belongs to
 * app.createStage({ canvas, width, height, dpr }).
 */
export const getVRenderAppEnvParams = (mode?: RenderMode, modeParams?: unknown): unknown => {
  const env = getVRenderAppEnv(mode);
  const appEnvParamKeys = APP_ENV_PARAM_KEYS_BY_ENV[env as keyof typeof APP_ENV_PARAM_KEYS_BY_ENV];
  if (!appEnvParamKeys) {
    return modeParams;
  }
  if (!isObjectLike(modeParams)) {
    return undefined;
  }

  const envParams: Record<string, unknown> = {};
  appEnvParamKeys.forEach(key => {
    if (modeParams[key] !== undefined) {
      envParams[key] = modeParams[key];
    }
  });

  return Object.keys(envParams).length ? envParams : undefined;
};

const isIApp = (value: unknown): value is IApp => !!value && typeof (value as IApp).createStage === 'function';

const normalizeResolveOptions = (
  appOrOptions?: IApp | ResolveVRenderAppOptions,
  mode?: RenderMode
): ResolveVRenderAppOptions => {
  if (!appOrOptions || isIApp(appOrOptions)) {
    return {
      app: appOrOptions as IApp | undefined,
      mode
    };
  }

  return appOrOptions;
};

const acquireDefaultVRenderApp = (env: VRenderAppEnv, envParams?: unknown): ResolvedVRenderApp => {
  const handle = acquireSharedVRenderApp({
    env,
    ...(envParams === undefined ? {} : { envParams })
  });

  return {
    app: handle.app,
    releaseAppRef: () => handle.release()
  };
};

export const resolveVRenderApp = (
  appOrOptions?: IApp | ResolveVRenderAppOptions,
  mode?: RenderMode
): ResolvedVRenderApp => {
  const options = normalizeResolveOptions(appOrOptions, mode);

  if (options.app) {
    return { app: options.app };
  }

  const env = getVRenderAppEnv(options.mode);
  const envParams = getVRenderAppEnvParams(options.mode, options.modeParams);
  return acquireDefaultVRenderApp(env, envParams);
};

export const createStageFromApp = (app: IApp, params: Partial<IStageParams>): IStage => app.createStage(params);
