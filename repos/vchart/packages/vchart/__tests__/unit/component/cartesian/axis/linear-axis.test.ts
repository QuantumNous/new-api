import { GlobalScale } from '../../../../../src/scale/global-scale';
import type { IEventDispatcher } from '../../../../../src/event/interface';
/* eslint-disable no-lone-blocks */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import { DataSet, csvParser } from '@visactor/vdataset';
import { dimensionStatistics } from '../../../../../src/data/transforms/dimension-statistics';
import type { CartesianLinearAxis } from '../../../../../src/index';
// eslint-disable-next-line no-duplicate-imports
import { CartesianAxis } from '../../../../../src/index';
import { ComponentTypeEnum, type IComponent, type IComponentOption } from '../../../../../src/component/interface';
import { EventDispatcher } from '../../../../../src/event/event-dispatcher';
import { getTestCompiler } from '../../../../util/factory/compiler';
import { getTheme, initChartDataSet } from '../../../../util/context';
import type { StringOrNumber } from '../../../../../src/typings/common';
import { getCartesianAxisInfo } from '../../../../../src/component/axis/cartesian/util';
import { wilkinsonExtended } from '@visactor/vscale';

const dataSet = new DataSet();
initChartDataSet(dataSet);
dataSet.registerParser('csv', csvParser);
dataSet.registerTransform('dimensionStatistics', dimensionStatistics);
// const dataView = new DataView(dataSet);
// const data = `x,type,y
// 1,1,850
// 2,2,740
// 3,3,901
// 4,4,569
// 5,5,670`;
// dataView.parse(data, {
//   type: 'csv'
// });
// /**
//  * By default, the data.y statistics range is [569, 901].
//  *
//  */
// const statisticData = new DataView(dataSet);
// statisticData.parse([dataView], { type: 'dataview' }).transform({
//   type: 'dimensionStatistics',
//   options: {
//     operations: ['max', 'min', 'values'],
//     fields: ['x', 'y', undefined]
//   }
// });

const ctx: IComponentOption = {
  type: ComponentTypeEnum.cartesianLinearAxis,
  // region: {} as any,
  eventDispatcher: new EventDispatcher({} as any, { addEventListener: () => {} } as any) as IEventDispatcher,
  dataSet,
  map: new Map(),
  mode: 'desktop-browser',
  globalInstance: {
    isAnimationEnable: () => true,
    getContainer: () => ({}),
    getTooltipHandlerByUser: (() => undefined) as () => undefined
  } as any,
  getCompiler: getTestCompiler,
  getAllRegions: () => [],
  getRegionsInIndex: () => {
    return [];
  },
  getChart: () =>
    ({
      getSpec() {
        return {};
      }
    } as any),
  getRegionsInIds: () => {
    return [];
  },
  getRegionsInUserIdOrIndex: () => {
    return [];
  },
  getAllSeries: () => [],
  getSeriesInIndex: () => {
    return [];
  },
  getSeriesInIds: () => {
    return [];
  },
  getSeriesInUserIdOrIndex: () => {
    return [];
  },
  getAllComponents: () => [],
  getComponentByIndex: (key: string, index: number) => {
    return undefined;
  },
  getComponentsByKey: (key: string) => {
    return [];
  },
  getComponentsByType: (type: string) => {
    return [];
  },
  getChartLayoutRect: () => {
    return { width: 0, height: 0, x: 0, y: 0 };
  },
  getChartViewRect: () => {
    return { width: 500, height: 500 } as any;
  },
  globalScale: new GlobalScale([], { getAllSeries: () => [] as any[] } as any),
  getTheme: getTheme,
  getComponentByUserId: function (user_id: string | number): IComponent | undefined {
    throw new Error('Function not implemented.');
  },
  animation: false,
  onError: () => {},
  getSeriesData: (id: StringOrNumber | undefined, index: number | undefined) => undefined
};

const getAxisSpec = (spec: any) => {
  return {
    sampling: 'simple',
    ...spec
  };
};

beforeAll(() => {
  // @ts-ignore
  jest.spyOn(CartesianAxis.prototype, 'collectData').mockImplementation(() => {
    return [{ min: 569, max: 901 }];
  });
});

/**
 * By default,`zero` is configured `true`, `nice` is configured `true`
 * As a result, the left linear axis domain should be [0, 1000].
 *
 */
test('config linearAxis.nice default [true] ', () => {
  let spec = getAxisSpec({
    orient: 'left'
  });
  const transformer = new CartesianAxis.transformerConstructor({
    type: 'cartesianAxis-linear',
    getTheme: getTheme,
    mode: 'desktop-browser'
  });
  spec = transformer.transformSpec(spec, {}).spec;
  const linearAxis = CartesianAxis.createComponent(
    {
      type: getCartesianAxisInfo(spec).componentName,
      spec
    },
    ctx
  );

  linearAxis.created();
  linearAxis.init({});
  // @ts-ignore
  linearAxis.updateScaleDomain();
  const scale = linearAxis.getScale();
  expect(scale.domain()).toEqual([0, 1000]);
});

test('config linearAxis.nice default [true] ', () => {
  let spec = getAxisSpec({
    orient: 'left',
    tick: { tickMode: 'd3' }
  });
  const transformer = new CartesianAxis.transformerConstructor({
    type: 'cartesianAxis-linear',
    getTheme: getTheme,
    mode: 'desktop-browser'
  });
  spec = transformer.transformSpec(spec, {}).spec;
  const linearAxis = CartesianAxis.createComponent(
    {
      type: getCartesianAxisInfo(spec).componentName,
      spec
    },
    ctx
  );

  linearAxis.created();
  linearAxis.init({});
  // @ts-ignore
  linearAxis.updateScaleDomain();
  const scale = linearAxis.getScale();
  expect(scale.domain()).toEqual([0, 1000]);
});

test('nice === false  ', () => {
  let spec = getAxisSpec({
    orient: 'left',
    nice: false
  });
  const transformer = new CartesianAxis.transformerConstructor({
    type: 'cartesianAxis-linear',
    getTheme: getTheme,
    mode: 'desktop-browser'
  });
  spec = transformer.transformSpec(spec, {}).spec;
  const linearAxis = CartesianAxis.createComponent(
    {
      type: getCartesianAxisInfo(spec).componentName,
      spec
    },
    ctx
  );

  linearAxis.created();
  linearAxis.init({});
  // @ts-ignore
  linearAxis.updateScaleDomain();
  const scale = linearAxis.getScale();
  expect(scale.domain()).toEqual([0, 901]);
});

test('zero === false && nice === false  ', () => {
  let spec = getAxisSpec({
    orient: 'left',
    nice: false,
    zero: false
  });
  const transformer = new CartesianAxis.transformerConstructor({
    type: 'cartesianAxis-linear',
    getTheme: getTheme,
    mode: 'desktop-browser'
  });
  spec = transformer.transformSpec(spec, {}).spec;
  const linearAxis = CartesianAxis.createComponent(
    {
      type: getCartesianAxisInfo(spec).componentName,
      spec
    },
    ctx
  );

  linearAxis.created();
  linearAxis.init({});
  // @ts-ignore
  linearAxis.updateScaleDomain();
  const scale = linearAxis.getScale();
  expect(scale.domain()).toEqual([569, 901]);
});

test('zero === true && range is specific  ', () => {
  let config = getAxisSpec({
    orient: 'left',
    range: {
      min: 10,
      max: 800
    }
  });
  const transformer = new CartesianAxis.transformerConstructor({
    type: 'cartesianAxis-linear',
    getTheme: getTheme,
    mode: 'desktop-browser'
  });
  config = transformer.transformSpec(config, {}).spec;

  /**
   * range is the highest priority, which will be the direct result for scale.domain.
   *
   */
  {
    const linearAxis = CartesianAxis.createComponent(
      {
        type: getCartesianAxisInfo(config).componentName,
        spec: config
      },
      ctx
    );
    linearAxis.created();
    linearAxis.init({});
    // @ts-ignore
    linearAxis.updateScaleDomain();
    const scale = linearAxis.getScale();
    expect(scale.domain()).toEqual([10, 800]);
  }
  {
    const spec = { ...config, range: { min: -10, max: 2000 } };
    const linearAxis = CartesianAxis.createComponent(
      {
        type: getCartesianAxisInfo(spec).componentName,
        spec
      },
      ctx
    );
    linearAxis.created();
    linearAxis.init({});
    // @ts-ignore
    linearAxis.updateScaleDomain();
    const scale = linearAxis.getScale();
    expect(scale.domain()).toEqual([-10, 2000]);
  }
  {
    // range优先级要高于nice，一旦设置了max/min，nice不应该改变相应的值
    const spec = { ...config, zero: false, range: { max: 599 } };
    const linearAxis = CartesianAxis.createComponent(
      {
        type: getCartesianAxisInfo(spec).componentName,
        spec
      },
      ctx
    );
    linearAxis.created();
    linearAxis.init({});
    // @ts-ignore
    linearAxis.updateScaleDomain();
    const scale = linearAxis.getScale();
    expect(scale.domain()).toEqual([565, 599]);
  }
  {
    // range优先级要高于nice，一旦设置了max/min，nice不应该改变相应的值(d3 tick)
    const spec = { ...config, zero: false, range: { max: 599 }, tick: { tickMode: 'd3' } };
    const linearAxis = CartesianAxis.createComponent(
      {
        type: getCartesianAxisInfo(spec).componentName,
        spec
      },
      ctx
    );
    linearAxis.created();
    linearAxis.init({});
    // @ts-ignore
    linearAxis.updateScaleDomain();
    const scale = linearAxis.getScale();
    expect(scale.domain()).toEqual([565, 599]);
  }
  {
    // range优先级要高于nice，一旦设置了max/min，nice不应该改变相应的值
    const spec = { ...config, zero: false, range: { min: 199 } };
    const linearAxis = CartesianAxis.createComponent(
      {
        type: getCartesianAxisInfo(spec).componentName,
        spec
      },
      ctx
    );
    linearAxis.created();
    linearAxis.init({});
    // @ts-ignore
    linearAxis.updateScaleDomain();
    const scale = linearAxis.getScale();
    expect(scale.domain()).toEqual([199, 1000]);
  }
});

test('expand', () => {
  let config = getAxisSpec({
    orient: 'left',
    expand: { max: 0.1, min: 0.1 }
  });
  const transformer = new CartesianAxis.transformerConstructor({
    type: 'cartesianAxis-linear',
    getTheme: getTheme,
    mode: 'desktop-browser'
  });
  config = transformer.transformSpec(config, {}).spec;

  {
    const linearAxis = CartesianAxis.createComponent(
      {
        type: getCartesianAxisInfo(config).componentName,
        spec: config
      },
      ctx
    );
    linearAxis.created();
    linearAxis.init({});
    // @ts-ignore
    linearAxis.updateScaleDomain();
    const scale = linearAxis.getScale();
    expect(scale.domain()).toEqual([0, 1000]);
  }

  /**
   * `range` is the highest priority, which will be the direct result for scale.domain.
   * `expand.min` will not affect domain.min.
   *    origin: [569, 901]
   * => with expand.min/max: [602.2, 934.2]
   * => with range.min: [500, 934.2]
   * => with nice: [500, 950]
   */
  {
    const spec = { ...config, range: { min: 500 } };
    const linearAxis = CartesianAxis.createComponent(
      {
        type: getCartesianAxisInfo(spec).componentName,
        spec
      },
      ctx
    );
    linearAxis.created();
    linearAxis.init({});
    // @ts-ignore
    linearAxis.updateScaleDomain();
    const scale = linearAxis.getScale();
    expect(scale.domain()).toEqual([500, 1000]);
  }
  /**
   * `range` is the highest priority, which will be the direct result for scale.domain.
   * `expand.min` will not affect domain.min.
   *    origin: [569, 901]
   * => with expand.min/max: [569, 967.4]
   * => with zero: [0, 967.4]
   * => with nice: [0, 1000]
   */
  {
    const spec = { ...config, expand: { max: 0.2 } };
    const linearAxis = CartesianAxis.createComponent(
      {
        type: getCartesianAxisInfo(spec).componentName,
        spec
      },
      ctx
    );
    linearAxis.created();
    linearAxis.init({});
    // @ts-ignore
    linearAxis.updateScaleDomain();
    const scale = linearAxis.getScale();
    expect(scale.domain()).toEqual([0, 1000]);
  }
});

test('extend', () => {
  let config = getAxisSpec({
    orient: 'left'
  });
  const transformer = new CartesianAxis.transformerConstructor({
    type: 'cartesianAxis-linear',
    getTheme: getTheme,
    mode: 'desktop-browser'
  });
  config = transformer.transformSpec(config, {}).spec;

  {
    const linearAxis = CartesianAxis.createComponent(
      {
        type: getCartesianAxisInfo(config).componentName,
        spec: config
      },
      ctx
    ) as CartesianLinearAxis;
    linearAxis.created();
    linearAxis.setExtendDomain('test', 1100);
    const scale = linearAxis.getScale();
    expect(scale.domain()).toEqual([0, 1200]);
  }

  {
    const linearAxis = CartesianAxis.createComponent(
      {
        type: getCartesianAxisInfo(config).componentName,
        spec: config
      },
      ctx
    ) as CartesianLinearAxis;
    linearAxis.created();
    linearAxis.setExtendDomain('test', 1100);
    linearAxis.setExtendDomain('test', 700);
    expect(linearAxis.getScale().domain()).toEqual([0, 1000]);
    linearAxis.setExtendDomain('test', undefined);
    expect(linearAxis.getScale().domain()).toEqual([0, 1000]);
  }

  /**
   * `range` is the highest priority, which will be the direct result for scale.domain.
   * `extend` will not affect domain.
   *    origin: [569, 901]
   * => with extend { testMin: -100, testMax: 1100 } => [-100, 1100]
   * => with range.min&max: [500, 800]
   */
  {
    const spec = { ...config, range: { min: 500, max: 800 } };
    const linearAxis = CartesianAxis.createComponent(
      {
        type: getCartesianAxisInfo(spec).componentName,
        spec
      },
      ctx
    ) as CartesianLinearAxis;
    linearAxis.created();
    linearAxis.setExtendDomain('testMin', -100);
    linearAxis.setExtendDomain('testMax', 1100);
    const scale = linearAxis.getScale();
    expect(scale.domain()).toEqual([500, 800]);
  }
});

test('niceDomain should work when domain is 0, and user does not set min or max', () => {
  // @ts-ignore
  jest.spyOn(CartesianAxis.prototype, 'collectData').mockImplementation(() => {
    return [{ min: 0, max: 0 }];
  });
  let spec = getAxisSpec({
    orient: 'left',
    nice: false,
    zero: false
  });
  const transformer = new CartesianAxis.transformerConstructor({
    type: 'cartesianAxis-linear',
    getTheme: getTheme,
    mode: 'desktop-browser'
  });
  spec = transformer.transformSpec(spec, {}).spec;
  const linearAxis = CartesianAxis.createComponent(
    {
      type: getCartesianAxisInfo(spec).componentName,
      spec
    },
    ctx
  );

  linearAxis.created();
  linearAxis.init({});
  // @ts-ignore
  linearAxis.updateScaleDomain();
  const scale = linearAxis.getScale();
  expect(scale.domain()).toEqual([0, 0]); // fix the test
});

test('niceDomain should not work when user set min or max', () => {
  // @ts-ignore
  jest.spyOn(CartesianAxis.prototype, 'collectData').mockImplementation(() => {
    return [{ min: 0, max: 5000 }];
  });
  let spec = getAxisSpec({
    orient: 'left',
    min: 300,
    max: 300
  });
  const transformer = new CartesianAxis.transformerConstructor({
    type: 'cartesianAxis-linear',
    getTheme: getTheme,
    mode: 'desktop-browser'
  });
  spec = transformer.transformSpec(spec, {}).spec;
  const linearAxis = CartesianAxis.createComponent(
    {
      type: getCartesianAxisInfo(spec).componentName,
      spec
    },
    ctx
  );

  linearAxis.created();
  linearAxis.init({});
  // @ts-ignore
  linearAxis.updateScaleDomain();
  const scale = linearAxis.getScale();
  expect(scale.domain()).toEqual([300, 300]);
});

test('dynamic tickCount', () => {
  let spec = getAxisSpec({
    orient: 'left',
    tick: {
      tickCount: (params: any) => {
        const density = 1;
        const fontSize = params.labelStyle.fontSize ?? 12;
        const height = params.axisLength;
        const count = ~~Math.max(Math.ceil(height / (fontSize * 1.5)) * (0.2 * density), 2);
        return count;
      }
    }
  });
  const transformer = new CartesianAxis.transformerConstructor({
    type: 'cartesianAxis-linear',
    getTheme: getTheme,
    mode: 'desktop-browser'
  });
  spec = transformer.transformSpec(spec, {}).spec;
  const linearAxis = CartesianAxis.createComponent(
    {
      type: getCartesianAxisInfo(spec).componentName,
      spec
    },
    ctx
  );

  linearAxis.created();
  linearAxis.init({});
  // @ts-ignore
  linearAxis.updateScaleDomain();
  {
    const scale = linearAxis.getScale();
    scale.range([0, 500]);
    // @ts-ignore
    linearAxis.computeData();
    // @ts-ignore
    const tickCount = linearAxis.getTickData().getLatestData()?.length;
    expect(tickCount).toEqual(6);
  }

  {
    const scale = linearAxis.getScale();
    scale.range([0, 1000]);
    // @ts-ignore
    linearAxis.computeData();
    // @ts-ignore
    const tickCount = linearAxis.getTickData().getLatestData()?.length;
    expect(tickCount).toEqual(11);
  }

  {
    const scale = linearAxis.getScale();
    scale.range([0, 200]);
    // @ts-ignore
    linearAxis.computeData();
    // @ts-ignore
    const tickCount = linearAxis.getTickData().getLatestData()?.length;
    expect(tickCount).toEqual(4);
  }
});

test('dynamic tickCount', () => {
  let spec = getAxisSpec({
    orient: 'left',
    tick: {
      tickMode: (scale: any, count: number) => {
        return [0, 25000, 50000];
      }
    }
  });
  const transformer = new CartesianAxis.transformerConstructor({
    type: 'cartesianAxis-linear',
    getTheme: getTheme,
    mode: 'desktop-browser'
  });
  spec = transformer.transformSpec(spec, {}).spec;
  const linearAxis = CartesianAxis.createComponent(
    {
      type: getCartesianAxisInfo(spec).componentName,
      spec
    },
    ctx
  );

  linearAxis.created();
  linearAxis.init({});
  // @ts-ignore
  linearAxis.updateScaleDomain();
  const scale = linearAxis.getScale();
  scale.range([0, 50000]);
  // @ts-ignore
  linearAxis.computeData();
  // @ts-ignore
  const tickValues = linearAxis
    // @ts-ignore
    .getTickData()
    .getLatestData()
    .map((tick: any) => tick.value);
  expect(tickValues).toEqual([0, 25000, 50000]);
});

test('dynamic tickCount with wilkson', () => {
  let spec = getAxisSpec({
    orient: 'left',
    tick: {
      tickMode: (scale: any, count: number) => {
        const d = scale.calculateVisibleDomain(scale.get('_range'));
        return wilkinsonExtended(d[0], d[1], count);
      }
    }
  });
  const transformer = new CartesianAxis.transformerConstructor({
    type: 'cartesianAxis-linear',
    getTheme: getTheme,
    mode: 'desktop-browser'
  });
  spec = transformer.transformSpec(spec, {}).spec;
  const linearAxis = CartesianAxis.createComponent(
    {
      type: getCartesianAxisInfo(spec).componentName,
      spec
    },
    ctx
  );

  linearAxis.created();
  linearAxis.init({});
  // @ts-ignore
  linearAxis.updateScaleDomain();
  const scale = linearAxis.getScale();
  scale.range([0, 50000]);
  scale.domain([0, 100]);
  // @ts-ignore
  linearAxis.computeData();
  // @ts-ignore
  const tickValues = linearAxis
    // @ts-ignore
    .getTickData()
    .getLatestData()
    .map((tick: any) => tick.value);
  expect(tickValues).toEqual([0, 25, 50, 75, 100]);
});

test('re-nice value axis with the real plot-area length on updateScaleRange when tickCount is a function', () => {
  // 数据域 [0, 700]（collectData 是 protected，用 `as any` 绕过类型检查）
  jest.spyOn(CartesianAxis.prototype as any, 'collectData').mockImplementation(() => [{ min: 0, max: 700 }]);

  // tickCount 依赖轴长（轴越长刻度越多），记录每次拿到的 axisLength
  const seenAxisLength: number[] = [];
  let spec = getAxisSpec({
    orient: 'left',
    tick: {
      tickMode: 'd3',
      tickCount: ({ axisLength }: { axisLength: number }) => {
        seenAxisLength.push(axisLength);
        return Math.max(2, Math.round(axisLength / 100));
      }
    }
  });
  const transformer = new CartesianAxis.transformerConstructor({
    type: 'cartesianAxis-linear',
    getTheme: getTheme,
    mode: 'desktop-browser'
  });
  spec = transformer.transformSpec(spec, {}).spec;
  const linearAxis = CartesianAxis.createComponent(
    {
      type: getCartesianAxisInfo(spec).componentName,
      spec
    },
    ctx
  ) as any;

  linearAxis.created();
  linearAxis.init({});

  // 布局前：scale.range 仍是 [0, 1]，setLinearScaleNice 回退用整块 chart viewRect 高度(500)
  linearAxis.updateScaleDomain();
  expect(seenAxisLength).toContain(500);
  // viewRect 高度 500 → tickCount 5 → nice 域 [0, 700]
  expect(linearAxis.getScale().domain()).toEqual([0, 700]);

  // 模拟布局：让 updateScaleRange 解析出真实绘图区轴长 200（远小于 viewRect 的 500），
  // 走真正的修复入口 updateScaleRange()，而不是直接调内部的 reTransformDomainByLayout()——
  // 这样一旦 updateScaleRange() 覆盖被移除，本用例就会失败。
  seenAxisLength.length = 0;
  jest.spyOn(linearAxis, 'getNewScaleRange').mockReturnValue([200, 0]);
  linearAxis.updateScaleRange();

  // updateScaleRange 内部用真实轴长 200 重算，而不是布局前回退的 viewRect 500
  expect(seenAxisLength).toContain(200);
  expect(seenAxisLength).not.toContain(500);
  // 真实轴更短 → tickCount 2 → nice 天花板抬到 [0, 1000]
  expect(linearAxis.getScale().domain()).toEqual([0, 1000]);

  // 恢复全局 collectData mock，避免影响其他用例
  jest.spyOn(CartesianAxis.prototype as any, 'collectData').mockImplementation(() => [{ min: 569, max: 901 }]);
});
