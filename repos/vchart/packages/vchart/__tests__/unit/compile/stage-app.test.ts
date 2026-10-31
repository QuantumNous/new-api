import type { IApp, IStage, IStageParams } from '@visactor/vrender-core';

type MockApp = IApp & {
  id: string;
  releaseMock: jest.Mock;
  createStage: jest.Mock;
};

const createMockStage = (params?: Partial<IStageParams>) =>
  ({
    params,
    release: jest.fn()
  } as unknown as IStage);

const createMockApp = (id: string): MockApp => {
  const app = {
    id,
    released: false,
    createStage: jest.fn(params => createMockStage(params)),
    releaseMock: jest.fn(),
    release() {
      (app as any).released = true;
      app.releaseMock();
    }
  } as unknown as MockApp;

  return app;
};

const setupStageApp = (overrides: Record<string, unknown> = {}) => {
  jest.resetModules();

  const sharedApps = new Map<string, MockApp>();
  const acquireSharedVRenderApp = jest.fn(({ env, key = 'default' }: { env: string; key?: string }) => {
    const sharedKey = `${env}:${String(key)}`;
    const app = sharedApps.get(sharedKey) ?? createMockApp(`shared-${sharedKey}`);
    sharedApps.set(sharedKey, app);

    return {
      app,
      env,
      key,
      release: jest.fn()
    };
  });

  const factories = {
    createBrowserVRenderApp: jest.fn(() => createMockApp('browser')),
    createNodeVRenderApp: jest.fn(() => createMockApp('node')),
    createFeishuVRenderApp: jest.fn(() => createMockApp('feishu')),
    createTTVRenderApp: jest.fn(() => createMockApp('tt')),
    createWxVRenderApp: jest.fn(() => createMockApp('wx')),
    createLynxVRenderApp: jest.fn(() => createMockApp('lynx')),
    createHarmonyVRenderApp: jest.fn(() => createMockApp('harmony')),
    acquireSharedVRenderApp,
    ...overrides
  };

  jest.doMock('@visactor/vrender', () => factories);
  jest.doMock('@visactor/vrender/entries/shared', () => ({
    acquireSharedVRenderApp: factories.acquireSharedVRenderApp
  }));

  return {
    factories,
    stageApp: require('../../../src/compile/stage-app')
  };
};

describe('stage app lifecycle helpers', () => {
  afterEach(() => {
    jest.dontMock('@visactor/vrender');
    jest.dontMock('@visactor/vrender/entries/shared');
    jest.resetModules();
  });

  it('keeps lynx app envParams scoped to global runtime capabilities', () => {
    const { stageApp } = setupStageApp();
    const canvasFactory = jest.fn();
    const lynxRuntime = { createCanvas: jest.fn() };
    const runtime = { createCanvasNG: jest.fn() };

    expect(
      stageApp.getVRenderAppEnvParams('lynx', {
        domref: { width: 100, height: 80 },
        canvasIdLists: ['chart', 'tooltip'],
        freeCanvasIdx: 1,
        tooltipCanvasId: 'tooltip',
        force: true,
        pixelRatio: 2,
        lynx: lynxRuntime,
        runtime,
        canvasFactory
      })
    ).toEqual({
      pixelRatio: 2,
      lynx: lynxRuntime,
      runtime,
      canvasFactory
    });
  });

  it('keeps harmony app envParams scoped to global runtime capabilities', () => {
    const { stageApp } = setupStageApp();
    const canvasFactory = jest.fn();
    const harmonyRuntime = { createCanvas: jest.fn() };
    const runtime = { createOffscreenCanvas: jest.fn() };

    expect(
      stageApp.getVRenderAppEnvParams('harmony', {
        domref: { width: 100, height: 80 },
        canvasIdLists: ['chart', 'tooltip'],
        freeCanvasIdx: 1,
        tooltipCanvasId: 'tooltip',
        force: true,
        pixelRatio: 2,
        harmony: harmonyRuntime,
        runtime,
        canvasFactory
      })
    ).toEqual({
      pixelRatio: 2,
      harmony: harmonyRuntime,
      runtime,
      canvasFactory
    });
  });

  it('acquires the default shared lynx app with sanitized envParams', () => {
    const sharedApp = createMockApp('shared-lynx-default');
    const releaseHandle = jest.fn();
    const acquireSharedVRenderApp = jest.fn(() => ({
      app: sharedApp,
      env: 'lynx',
      key: 'default',
      release: releaseHandle
    }));
    const { stageApp, factories } = setupStageApp({ acquireSharedVRenderApp });

    const resolved = stageApp.resolveVRenderApp({
      mode: 'lynx',
      modeParams: {
        domref: { width: 100, height: 80 },
        canvasIdLists: ['chart'],
        freeCanvasIdx: 0,
        pixelRatio: 3,
        canvasFactory: jest.fn()
      }
    });

    expect(resolved.app).toBe(sharedApp);
    expect(acquireSharedVRenderApp).toHaveBeenCalledWith({
      env: 'lynx',
      envParams: {
        pixelRatio: 3,
        canvasFactory: expect.any(Function)
      }
    });
    expect(factories.createLynxVRenderApp).not.toHaveBeenCalled();

    resolved.releaseAppRef?.();

    expect(releaseHandle).toHaveBeenCalledTimes(1);
    expect(sharedApp.releaseMock).not.toHaveBeenCalled();
  });

  it('uses VRender shared app instead of creating an exclusive lynx app by default', () => {
    const { stageApp, factories } = setupStageApp();

    const resolved = stageApp.resolveVRenderApp({
      mode: 'lynx',
      modeParams: {
        domref: { width: 120, height: 90 },
        canvasIdLists: ['chart'],
        freeCanvasIdx: 0,
        pixelRatio: 2
      }
    });

    expect(factories.acquireSharedVRenderApp).toHaveBeenCalledWith({
      env: 'lynx',
      envParams: {
        pixelRatio: 2
      }
    });
    expect(factories.createLynxVRenderApp).not.toHaveBeenCalled();

    resolved.releaseAppRef?.();

    expect((resolved.app as MockApp).releaseMock).not.toHaveBeenCalled();
  });

  it('passes node app-scope envParams when acquiring the default shared app', () => {
    const { stageApp, factories } = setupStageApp();
    const nodeCanvasPackage = { createCanvas: jest.fn() };

    const resolved = stageApp.resolveVRenderApp({
      mode: 'node',
      modeParams: nodeCanvasPackage
    });

    expect(factories.acquireSharedVRenderApp).toHaveBeenCalledWith({
      env: 'node',
      envParams: nodeCanvasPackage
    });
    expect(factories.createNodeVRenderApp).not.toHaveBeenCalled();

    resolved.releaseAppRef?.();
  });

  it('keeps default shared app ownership in VRender while stages stay isolated', () => {
    const sharedApp = createMockApp('shared-page-app');
    let refCount = 0;
    const acquireSharedVRenderApp = jest.fn(() => {
      refCount += 1;
      let released = false;

      return {
        app: sharedApp,
        env: 'browser',
        key: 'default',
        release: () => {
          if (released) {
            return;
          }
          released = true;
          refCount -= 1;

          if (refCount <= 0) {
            sharedApp.release();
          }
        }
      };
    });
    const { stageApp } = setupStageApp({ acquireSharedVRenderApp });

    const first = stageApp.resolveVRenderApp({
      mode: 'desktop-browser'
    });
    const second = stageApp.resolveVRenderApp({
      mode: 'desktop-browser'
    });

    const firstStage = stageApp.createStageFromApp(first.app, {
      canvas: 'first-canvas',
      width: 200,
      height: 100,
      dpr: 2
    });
    const secondStage = stageApp.createStageFromApp(second.app, {
      canvas: 'second-canvas',
      width: 240,
      height: 120,
      dpr: 2
    });

    expect(first.app).toBe(sharedApp);
    expect(second.app).toBe(sharedApp);
    expect(firstStage).not.toBe(secondStage);
    expect(acquireSharedVRenderApp).toHaveBeenCalledWith({
      env: 'browser'
    });

    firstStage.release();
    first.releaseAppRef?.();

    expect(sharedApp.releaseMock).not.toHaveBeenCalled();

    secondStage.release();
    second.releaseAppRef?.();

    expect(sharedApp.releaseMock).toHaveBeenCalledTimes(1);
  });

  it('passes concrete canvas view binding through stage params', () => {
    const { stageApp } = setupStageApp();
    const app = createMockApp('stage-owner');

    const stage = stageApp.createStageFromApp(app, {
      canvas: 'vchart-canvas',
      width: 320,
      height: 180,
      dpr: 2
    });

    expect(app.createStage).toHaveBeenCalledWith({
      canvas: 'vchart-canvas',
      width: 320,
      height: 180,
      dpr: 2
    });
    expect(stage.params).toMatchObject({
      canvas: 'vchart-canvas',
      width: 320,
      height: 180,
      dpr: 2
    });
  });
});
