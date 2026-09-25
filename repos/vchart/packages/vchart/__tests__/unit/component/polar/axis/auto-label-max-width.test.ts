import { DataSet } from '@visactor/vdataset';
import { EventDispatcher } from '../../../../../src/event/event-dispatcher';
import type { IEventDispatcher } from '../../../../../src/event/interface';
import { ComponentTypeEnum } from '../../../../../src/component/interface';
import type { IComponentOption } from '../../../../../src/component/interface';
import type { PolarLinearAxis } from '../../../../../src/index';
import { PolarAxis } from '../../../../../src/index';
import { getTheme } from '../../../../util/context';
import { getTestCompiler } from '../../../../util/factory/compiler';

const dataSet = new DataSet();

/**
 * 验证：极坐标角度轴在布局阶段向组件属性传递 `autoLabelMaxWidth`
 * 前置：构造最小上下文、Mock `_update` 捕获属性
 * 断言：`_update` 接收的属性包含 `autoLabelMaxWidth` 与 `layoutRect`
 */
test('autogen:polar/axis:autoLabelMaxWidth 应传递到组件属性', () => {
  const layoutRect = { x: 0, y: 0, width: 400, height: 300 } as any;
  const regionStub = {
    id: 'region-0',
    getLayoutRect: () => layoutRect,
    getLayoutStartPoint: () => ({ x: 0, y: 0 }),
    getSeries: (): any[] => []
  } as any;

  const ctx: IComponentOption = {
    type: ComponentTypeEnum.polarLinearAxis,
    eventDispatcher: new EventDispatcher({} as any, { addEventListener: () => {} } as any) as IEventDispatcher,
    dataSet,
    map: new Map(),
    mode: 'desktop-browser',
    globalInstance: {
      isAnimationEnable: () => false,
      getContainer: () => ({}),
      getStage: () => ({ find: () => ({}) })
    } as any,
    getCompiler: getTestCompiler,
    getAllRegions: () => [regionStub],
    getRegionsInIndex: () => [regionStub],
    getChart: () => ({ getSpec: () => ({}) } as any),
    getRegionsInIds: () => [regionStub],
    getRegionsInUserIdOrIndex: () => [regionStub],
    getAllSeries: () => [],
    getSeriesInIndex: () => [],
    getSeriesInIds: () => [],
    getSeriesInUserIdOrIndex: () => [],
    getAllComponents: () => [],
    getComponentByUserId: () => undefined,
    getComponentByIndex: () => undefined,
    getComponentsByKey: () => [],
    getComponentsByType: () => [],
    getChartLayoutRect: () => ({ width: 0, height: 0, x: 0, y: 0 }),
    getChartViewRect: () => ({ width: 500, height: 500 } as any),
    globalScale: {} as any,
    getTheme: getTheme,
    animation: false,
    onError: () => {},
    getSeriesData: () => undefined
  };

  const spec = {
    orient: 'angle',
    label: { visible: true, autoLabelMaxWidth: true },
    grid: { visible: false },
    subGrid: { visible: false },
    title: { visible: false },
    // 半径配置以避免计算过程依赖系列
    outerRadius: 1,
    innerRadius: 0
  } as any;

  const axis = PolarAxis.createComponent({ type: ComponentTypeEnum.polarLinearAxis, spec }, ctx) as PolarLinearAxis;
  axis.created();

  const updateSpy = jest.spyOn(axis as any, '_update').mockImplementation(() => {});

  axis.updateLayoutAttribute();

  expect(updateSpy).toHaveBeenCalled();
  const callArgs = updateSpy.mock.calls[0][0] as any;
  expect(callArgs.autoLabelMaxWidth).toBe(true);
  expect(callArgs.layoutRect).toEqual(layoutRect);
});
