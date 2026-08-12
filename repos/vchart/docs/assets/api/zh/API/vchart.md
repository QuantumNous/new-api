# VChart

全局 `VChart` 对象，也作为图表的总入口，用于图表的创建、更新和销毁。

## 静态属性

### ThemeManager

主题管理器。可用于全局主题的注册、设置以及获取等，详见[theme](./theme)。

### globalConfig

VChart 的全局配置项。这个对象里的属性可以直接修改，配置的生效时机依具体配置项而定。

#### uniqueTooltip(number) = true

是否全局显示唯一 tooltip。如果置为 true，当某个图表触发 tooltip 时，同一页面的所有其他图表的 tooltip 将自动消失。

此配置修改后即时生效。

## 静态方法

### useRegisters

```ts
  /**
   *  按需注册图表和组件
   * @param comps
   * @since 1.5.1
   */
  static useRegisters(comps: (() => void)[]) {
    comps.forEach((fn: () => void) => {
      fn();
    });
  }

```

1.5.1 版本开始支持。
用于按需加载图表、系列、组件、环境兼容代码等。具体使用请参考 [按需引入教程](../../../guide/zh/tutorial_docs/Basic/How_to_Import_VChart.md)

### useChart

```ts
/**
 * 注册自定义图表
 * @param charts 图表类
 */
useChart: (charts: IChartConstructor[]) => void;
```

用于注册扩展的自定义图表 Chart。

### useSeries

```ts
/**
 * 注册自定义系列
 * @param series 系列类
 */
useSeries: (series: ISeriesConstructor[]) => void;
```

用于注册扩展的自定义系列 Series。

### useComponent

```ts
/**
 * 注册自定义组件
 * @param components 组件类
 */
useComponent: (components: IComponentConstructor[]) => void;
```

用于注册扩展的自定义组件 Component。

### useMark

```ts
/**
 * 注册自定义 Mark
 * @param  marks Mark 图元类
 */
useMark: (marks: MarkConstructor[]) => void;
```

用于注册扩展的自定义 组件 Mark。

### useLayout

```ts
/**
 * 注册自定义的布局
 * @param layouts 布局类
 */
useLayout: (layouts: ILayoutConstructor[]) => void;
```

用于注册扩展的自定义布局 Layout。

### registerDataSetTransform

```ts
  /**
   * 注册 DataSet 数据方法
   * @param name 数据 transform 方法名称
   * @param transform 具体的 Transform 执行方法
   */
  registerDataSetTransform: (name: string, transform: Transform) => void;
```

用于注册 DataSet 数据方法，常用于按需加载。

### registerMap

```ts
/**
 * 注册地图数据
 * @param key 地图名称
 * @param source 地图数据
 * @param option 地图数据配置
 */
registerMap: (key: string, source: GeoSourceType, option?: GeoSourceOption) => void;
```

注册地图数据。

```ts
export type GeoSourceOption = IGeoJsonOption | ITopoJsonOption;

/** geojson 相关配置 */
export interface GeoSourceOption {
  type: 'geojson';
  /** 计算中心点 */
  /** @default true */
  centroid?: boolean;
  /** 地图简化 */
  /** @default false */
  simplify?:
    | boolean
    | {
        /**
         * 一个以度为单位的数字（例如，纬度/经度距离）。
         * 1度大约相当于69英里。默认值是0.001，大约是一个城市街区的长度。
         * @default 0.01
         * @since 1.11.0
         */
        tolerance: number;
      };
  /** 逆时针回绕(Multi)LineString或(Multi)Polygon的外部环，内部环顺时针。*/
  /** @default false */
  rewind?:
    | boolean
    | {
        /** 启用反向绕行 */
        /** @default false */
        reverse?: boolean;
      };
}

/** topojson 相关配置 */
export interface ITopoJsonOption extends Omit<IGeoJsonOption, 'type'> {
  type: 'topojson';
  object: string;
}
```

### unregisterMap

```ts
/**
 * 卸载地图数据
 * @param key 地图名称
 */
unregisterMap: (key: string) => void;
```

用于卸载地图数据。

### getMap

```ts
/**
 * 根据地图名称获取地图数据
 * @param key 地图名称
 * @returns 地图数据
 */
getMap: (key: string) => GeoSourceType;
```

根据注册的地图名称获取对应的地图数据。

## 初始化(new VChart)

```ts
new VChart(spec: ISpec, options: IInitOption);
```

用于创建 VChart 实例。

### 参数说明

#### spec

图表的 spec 配置，详见[配置项](../../option/)页面。

#### options

图表配置，包含渲染容器等，详见的配置如下表：

| 属性名                  | 类型                        | 必选 | 描述                                                                                                                                                                                                                                                                 |
| ----------------------- | --------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dom`                   | `string\|HTMLElement`       | 否   | **仅生效于浏览器环境。** 图表挂载的父容器，可以直接指定容器 id，也可以传入 dom 对象                                                                                                                                                                                  |
| `renderCanvas`          | `string\|HTMLCanvasElement` | 否   | 除去选择 dom 属性进行挂载父容器，也可以使用 renderCanvas 属性直接传入 canvas 实例/ canvasId，小程序/小组件环境请直接传入 id                                                                                                                                          |
| `dataSet`               | `DataSet`                   | 否   | 数据集                                                                                                                                                                                                                                                               |
| `autoFit`               | `boolean`                   | 否   | 是否自适应容器大小，默认为 `true`                                                                                                                                                                                                                                    |
| `animation`             | `boolean`                   | 否   | 是否开启动画，默认为 `true`                                                                                                                                                                                                                                          |
| `options3d`             | `srIOption3DType`           | 否   | 3d 配置                                                                                                                                                                                                                                                              |
| `layout`                | `LayoutCallBack`            | 否   | 自定义布局函数                                                                                                                                                                                                                                                       |
| `mode`                  | `string`                    | 否   | 配置渲染环境，默认为 'desktop-browser'，当需要在非浏览器环境渲染 VChart 时，需要配置该属性。 `'desktop-browser'`: 默认模式，适用于 PC 及 H5; `'mobile-browser'`: H5 模式; `'node'`: Node 渲染; `'worker'`: worker 模式; `'miniApp'`: 小程序模式; `'lynx'`: lynx 渲染 |
| `modeParams`            | any                         | 否   | 配置 `mode` 参数一起使用，用于配置 `mode` 参数对应的环境的一些特殊配置                                                                                                                                                                                               |
| `dpr`                   | `number`                    | 否   | 设置屏幕分辨率                                                                                                                                                                                                                                                       |
| `interactive`           | `boolean`                   | 否   | 图表交互全局开关，默认为 `true`，开启。                                                                                                                                                                                                                              |
| `viewBox`               | `object`                    | 否   | 指定绘制的矩形区域，如 `{ x1: 100, y1: 100, x2: 300, y2: 300 }`                                                                                                                                                                                                      |
| `canvasControled`       | `boolean`                   | 否   | 用于告诉底层的渲染引擎 VRender，图表的 Canvas 是否是受控制的 canvas，如果不是的话，不会进行 resize 等操作。                                                                                                                                                          |
| `stage`                 | `Stage`                     | 否   | 外部传入的 VRender stage                                                                                                                                                                                                                                             |
| `layer`                 | `Layer`                     | 否   | 外部传入的 VRender layer                                                                                                                                                                                                                                             |
| `beforeRender`          | `Function`                  | 否   | 绘制之前的钩子函数，`(stage: IStage) => void`                                                                                                                                                                                                                        |
| `afterRender`           | `Function`                  | 否   | 绘制之后的钩子函数，`(stage: IStage) => void`                                                                                                                                                                                                                        |
| `background`            | `string\object`             | 否   | 绘图区域背景色设置，可以配置渐变色                                                                                                                                                                                                                                   |
| `logLevel`              | `number`                    | 否   | 日志类型，用于开发调试                                                                                                                                                                                                                                               |
| `disableDirtyBounds`    | `boolean`                   | 否   | 是否关闭 dirtyBounds                                                                                                                                                                                                                                                 |
| `enableView3dTransform` | `boolean`                   | 否   | 是否开启 view3d 的变换模式                                                                                                                                                                                                                                           |
| `poptip`                | `boolean`                   | 否   | 是否开启省略文本的 poptip，用于查看完整的文本内容，默认开启                                                                                                                                                                                                          |
| `disableTriggerEvent`   | `boolean`                   | 否   | 是否关闭交互效果；从`1.9.0`版本开始支持                                                                                                                                                                                                                              |
| `theme`                 | `string \| ITheme`          | 否   | 默认主题（支持完整主题对象或者主题名称，主题名称需要提前在 `ThemeManager` 中注册）                                                                                                                                                                                   |
| `enableHtmlAttribute`   | `boolean`                   | 否   | 底层 vrender 图形节点是否支持`html`属性; 从`1.8.3`版本开始支持                                                                                                                                                                                                       |
| `supportsTouchEvents`   | `boolean`                   | 否   | 是否支持 touch 事件，不支持就不监听 touch 事件; 从`1.8.9`版本开始支持                                                                                                                                                                                                |
| `supportsPointerEvents` | `boolean`                   | 否   | 是否支持 pointer 事件，不支持就监听 mouse 事件; 从`1.8.9`版本开始支持                                                                                                                                                                                                |
| `ReactDOM`              | `object`                    | 否   | `react-dom`包导出产物，用于开启 vrender 渲染 react 元素; 从`1.11.0`版本开始支持                                                                                                                                                                                      |
| `resizeDelay`           | `number`                    | 否   | 当自动响应容器 resize 事件时，触发 resize 的间隔时长，单位毫秒；从`1.12.5`开始支持                                                                                                                                                                                   |
| `gestureConfig`         | `GestureConfig`             | 否   | 手势事件配置；当配置非空，开启手势相关事件                                                                                                                                                                                                                           |
| `autoRefreshDpr`        | `boolean`                   | 是   | 当切换屏幕的时候，dpr 发发生变更，是否自动刷新 dpr；当没有显示设置 dpr 的时候，默认开启该功能；自`1.12.14`版本开始支持                                                                                                                                               |

- `srIOption3DType` 类型定义如下

```ts
export interface srIOption3DType extends IOption3D {
  enable?: boolean;
  enableView3dTransform?: boolean;
}
export interface IOption3D {
  alpha?: number;
  beta?: number;
  gama?: number;
  center?: IPointLike;
  fieldRatio?: number;
  fieldDepth?: number;
  light?: {
    dir?: vec3;
    color?: string;
    ambient?: number;
  };
  camera?: any;
}
```

- `LayoutCallBack` 类型定义如下:

```ts
export type LayoutCallBack = (
  chart: IChart,
  item: ILayoutItem[],
  chartLayoutRect: IRect,
  chartViewBox: IBoundsLike
) => void;
```

- `GestureConfig` 类型定义如下:

```ts
export interface GestureConfig {
  press?: {
    /**
     * @default 251
     * 最小按压时间，单位为毫秒。
     */
    time?: number;
    /**
     * @default 10
     * 按压时允许的最大移动距离。
     */
    threshold?: number;
  };
  swipe?: {
    /**
     * 识别滑动所需的最小距离。
     * @default 10
     */
    threshold?: number;
    /**
     * 识别滑动所需的最小速度，单位为每毫秒像素。
     * @default 0.3
     */
    velocity?: number;
  };
  tap?: {
    /**
     * 多次点击之间的最大时间间隔。
     * @default 300
     */
    interval?: number;
  };
}
```

### 示例

```ts
import VChart from '@visactor/vchart';

const spec = {
  //  chart spec
};
// create an instance of VChart
const chart = new VChart(spec, {
  dom: 'chart' // the id of chart container
});
```

## 属性

### id

只读属性，VChart 实例的 id，内部生成。

## 方法

### renderSync

**同步**渲染图表。

```ts
/**
 * **同步**渲染图表。
 * @param morphConfig 图表 morph 动画配置，可选
 * @returns VChart 实例
 */
renderSync: (morphConfig?: IMorphConfig) => IVChart;
```

### renderAsync

1.9.0 版本以后不推荐使用，后续会废弃异步渲染/异步更新相关 API

**异步**渲染图表。

```ts
/**
 * **异步**渲染图表。
 * @async
 * @param morphConfig 图表 morph 动画配置，可选
 * @returns VChart 实例
 */
renderAsync: (morphConfig?: IMorphConfig) => Promise<IVChart>;
```

### updateData

**异步**更新数据。参数 `id` 对应在 spec 中 `data` 属性上的 `id` 字段，会自动渲染图表不需要再调用 `renderAsync()` 等渲染方法。

```ts
/**
 * **异步**更新数据。
 * @param id 数据 id
 * @param data 数据值
 * @param options 数据参数
 * @returns VChart 实例
 */
updateData: (id: StringOrNumber, data: DataView | Datum[] | string, options?: IParserOptions) => Promise<IVChart>;
```

```javascript livedemo
const spec = {
  type: 'pie',
  data: [
    {
      id: 'pie',
      values: [
        { type: '1', value: 100 },
        { type: '2', value: 200 },
        { type: '3', value: 300 }
      ]
    }
  ],
  categoryField: 'type',
  valueField: 'value'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

setTimeout(() => {
  vchart.updateData('pie', [
    { type: '1', value: 200 },
    { type: '2', value: 200 },
    { type: '3', value: 100 }
  ]);
}, 2000);
```

### updateDataInBatches

**异步**批量更新数据，会自动渲染图表不需要再调用 `renderAsync()` 等渲染方法。

```ts
/**
 * **异步**批量更新数据。
 * @param list 待更新的数据列表
 * @returns VChart 实例
 */
updateDataInBatches: (list: { id: string; data: DataView | Datum[]; options?: IParserOptions }[]) => Promise<IVChart>;
```

### updateDataSync

**同步**更新数据。参数 `id` 对应在 spec 中 `data` 属性上的 `id` 字段，会自动渲染图表不需要再调用 `renderAsync()` 等渲染方法。

```ts
/**
 * **同步**更新数据。
 * @param id 数据 id
 * @param data 数据值
 * @param options 数据参数
 * @returns VChart 实例
 */
updateDataSync: (id: StringOrNumber, data: DataView | Datum[], options?: IParserOptions) => IVChart;
```

### updateFullData

更新数据接口。参数为完整的数据项配置，可以通过此接口更新数据的 `fields` 配置，默认会自动渲染图表不需要再调用 `renderAsync()` 等渲染方法。

```ts
/**
 * 更新数据。
 * @param data 数据配置
 * @param reRender 是否重新绘制
 * @returns VChart 实例
 * @since 1.3.0
 */
updateFullData: (data: IDataValues | IDataValues[], reRender: boolean = true) => IVChart;
```

### updateFullDataSync

**同步**更新数据。参数为完整的数据项配置，可以通过此接口更新数据的 `fields` 配置，默认会自动渲染图表不需要再调用 `renderAsync()` 等渲染方法。

```ts
/**
 * **同步**更新数据。
 * @param data 数据配置
 * @param reRender 是否重新绘制
 * @returns VChart 实例
 * @since 1.3.0
 */
updateFullDataSync: (data: IDataValues | IDataValues[], reRender: boolean = true) => IVChart;
```

### updateSpec

**异步**spec 更新，会自动渲染图表不需要再调用 `renderAsync()` 等渲染方法。

```ts
/**
 * spec 更新
 * @param spec
 * @param forceMerge 是否强制合并，默认为 false
 * @param morphConfig morph 动画配置
 * @returns
 */
updateSpec: (spec: ISpec, forceMerge?: boolean, morphConfig?: IMorphConfig) => Promise<IVChart>;
```

### updateModelSpec

**异步**模块 spec 更新，可以通过 filter 指定更新某一个图表模块的配置，会自动渲染图表不需要再调用 `renderAsync()` 等渲染方法。

```ts
/**
 * 模块 spec 更新
 * @param filter
 * @param spec
 * @param forceMerge
 * @returns
 * @sync 1.4.0
 */
updateModelSpec: (
  filter: string | { type: string; index: number },
  spec: unknown,
  forceMerge?: boolean,
  morphConfig?: IMorphConfig
) => Promise<IVChart>;
```

### updateViewBox

更新绘制区域。viewBox 为绘制区域，格式为 `{ x1: number; x2: number; y1: number; y2: number }`。

```ts
/**
 * 更新绘制区域。
 * @param viewBox 绘制区域
 * @param reRender 是否重新渲染，默认为 true
 * @returns
 */
updateViewBox: (viewBox: IBoundsLike, reRender?: boolean) => IVChart;
```

### resize

**异步方法**，图表尺寸更新方法。

```ts
/**
 * **异步方法**，图表尺寸更新方法。
 * @param width 宽度
 * @param height 高度
 * @returns VChart 当前实例
 */
resize: (width: number, height: number) => Promise<IVChart>;
```

### release

销毁图表。

```ts
  /**
   * 销毁图表。
   */
  release: () => void;
```

### on

```ts
on(event: string, callback: (params: EventParams) => void): void;
on(event: string, query: EventQuery, callback: (params: EventParams) => void): void;
```

事件绑定。更加具体的使用，请移步[event](./event)。

### off

```ts
off(event: string, callback: (params: EventParams) => void): void;
```

事件卸载。

### updateState

更新或设置图元状态。

```ts
  /**
   * 更新或设置图元状态。
   * @param state 状态筛选器
   * @param filter 筛选器
   */
  updateState: (
    state: Record<string, Omit<IMarkStateSpec<unknown>, 'style'>>,
    filter?: (series: ISeries, mark: IMark, stateKey: string) => boolean //series + mark 筛选
  ) => void;
```

下方例子展示了如何更新状态的筛选条件，当我们点击图中的一个点，与这个点 `type` 值不同的点都变为半透明， 使用示例：

```ts
const spec = {
  type: 'scatter',
  data: [
    {
      id: 'data1',
      values: [
        { x: 1, y: 80, type: 'a' },
        { x: 2, y: 10, type: 'a' },
        { x: 1, y: 10, type: 'b' },
        { x: 2, y: 20, type: 'b' }
      ]
    }
  ],
  xField: 'x',
  yField: 'y',
  seriesField: 'type',
  point: {
    style: {
      // 默认情况下透明的设置为1
      fillOpacity: 1
    }
    state: {
      // 先设置好状态对应的属性
      custom_unSelected: {
        fillOpacity: 0.5
      }
    }
  }
};

const vchart = new VChart(spec);
vchart.renderSync();
// 监听点击事件
vchart.on('click', { level: 'mark' }, ctx => {
  vchart.updateState({
    // 名称与上方配置要对应
    custom_unSelected: {
      filter: datum => {
        // 数据 type 不相等的进入这个状态
        return datum.type !== ctx.datum.type;
      }
    }
  });
});
```

### setSelected

更新图元选中状态。

```ts
  /**
   * 更新图元选中状态。
   * @param datum hover 图元数据
   * @param filter 筛选器 用来筛选系列与mark
   * @param region region 筛选器
   */
  setSelected: (
    datum: MaybeArray<any> | null,
    filter?: (series: ISeries, mark: IMark) => boolean,
    region?: IRegionQuerier
  ) => void;
```

设置一组数据为选中状态，也可以直接设置 null 来取消选中状态。

```ts
/**
 * 假定图表数据如下
   [
    {x: 'US' , y: 10, type: 'A'}
    {x: 'NZ' , y: 20, type: 'A'}
    {x: 'US' , y: 30, type: 'B'}
    {x: 'NZ' , y: 40, type: 'B'}
   ]
 */
// 选定 type === 'A' 的数据
vchart.setSelected({ type: 'A' });
// 选定数据  {x: 'US' , y: 10, type: 'A'}
vchart.setSelected({ x: 'US', y: 10, type: 'A' });
// 取消当前的选中数据
vchart.setSelected(null);
```

### setHovered

更新图元 hover 状态。

```ts
  /**
   * 更新图元 hover 状态
   * @param datum hover 图元数据
   * @param filter 筛选器 用来筛选系列与mark
   * @param region region 筛选器
   */
  setHovered: (
    datum: MaybeArray<Datum> | null,
    filter?: (series: ISeries, mark: IMark) => boolean,
    region?: IRegionQuerier
  ) => void;
```

设置一个数据为 `hover` 状态，也可以直接设置 null 来取消 `hover` 状态。

`setHovered` 效果类似 `setSelected`，支持一次将多条数据设置为 `hover` 状态。

```ts
/**
 * 假定图表数据如下
   [
    {x: 'US' , y: 10, type: 'A'}
    {x: 'NZ' , y: 20, type: 'A'}
    {x: 'US' , y: 30, type: 'B'}
    {x: 'NZ' , y: 40, type: 'B'}
   ]
 */
// 选定 type === 'A' 的数据
vchart.setHovered({ type: 'A' });
// 选定数据  {x: 'US' , y: 10, type: 'A'}
vchart.setHovered({ x: 'US', y: 10, type: 'A' });
// 取消当前的选中数据
vchart.setHovered(null);
```

### clearState

清除图元的状态

```ts
 /**
   * 清除所有图元的状态
   * @param state 状态名
   *
   * @since 1.11.0
   */
  clearState: (state: string) => void;
```

### clearAllStates

清除图元的所有状态

```ts
 /**
   * 清除所有图元的状态
   *
   * @since 1.12.4
   */
  clearAllStates: (state: string) => void;
```

### clearSelected

清除图元的选中状态

```ts
/**
   * 清除所有图元的选中状态
   *
   * @since 1.11.0
   */
  clearSelected: () => void;
```

### clearHovered

清除图元的 hover 状态

```ts
/**
   * 清除所有图元的hover状态
   *
   * @since 1.11.0
   */
  clearHovered: () => void;
```

### getCurrentTheme

获取当前主题，会返回完整的主题配置。

```ts
getCurrentTheme: () => ITheme;
```

### getCurrentThemeName

获取当前主题名称（只能获取用户通过 `setCurrentTheme` 方法设置过的主题，默认值为 `ThemeManager` 统一设置的主题）。

```ts
getCurrentThemeName: () => string;
```

### setCurrentTheme

**异步方法**， 设置当前主题。

**注意：如果在图片的 spec 中配置了 `theme` 属性，则 spec.theme 的优先级更高。**

```ts
/**
 * **异步方法**， 设置当前主题。
 * @param name 主题名称
 * @returns
 */
setCurrentTheme: (name: string) => Promise<IVChart>;
```

使用示例：

```javascript livedemo
// 定义自定义主题
const customTheme = {
  colorScheme: {
    default: [
      '#FF6B6B',
      '#4ECDC4',
      '#45B7D1',
      '#FFA07A',
      '#98D8C8',
      '#F7DC6F',
      '#BB8FCE',
      '#85C1E2'
    ]
  },
  series: {
    bar: {
      barMaxWidth: 20,
      label: {
        visible: true,
        position: 'top'
      }
    }
  }
};

// 注册主题
VChart.ThemeManager.registerTheme('myCustomTheme', customTheme);

const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { type: 'A', value: 120 },
        { type: 'B', value: 200 },
        { type: 'C', value: 150 },
        { type: 'D', value: 80 }
      ]
    }
  ],
  xField: 'type',
  yField: 'value'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 通过实例方法设置主题
vchart.setCurrentTheme('myCustomTheme');
```

**注意**：
- 使用 `setCurrentTheme` 方法前，需要先通过 `VChart.ThemeManager.registerTheme()` 注册主题
- 该方法为异步方法，返回 Promise，可以使用 `await` 或 `.then()` 处理
- 如果图表 spec 中配置了 `theme` 属性，则 spec 中的主题优先级更高

### setTooltipHandler

当配置项无法满足 tooltip 的展示需求时，我们还提供了自定义 tooltip 的能力。可以通过配置 `TooltipHandler` 来覆盖默认 tooltip 展示逻辑。

```ts
  /**
   * 自定义 TooltipHandler。
   * @param tooltipHandler
   */
  setTooltipHandler: (tooltipHandler: ITooltipHandler) => void;
```

注意：

- 当给图表设置了自定义`TooltipHandler`后，内置的 tooltip 将不再起作用。
- VChart 不感知、不托管自定义 tooltip 的渲染，请按照需要自行实现 tooltip 渲染，包括**处理原始数据**、**tooltip 内容设计**，以及**根据项目环境创建组件并设置样式**。
- 当图表删除时会调用当前`TooltipHandler`的`release`函数，请按照需要删除。
- 由于自定义`TooltipHandler`会覆盖内置 tooltip 逻辑，**图表`spec`中的部分 tooltip 配置项便不再起作用**。但以下配置项作用于所有自定义`TooltipHandler`：
  - `tooltip.visible`
  - `tooltip.activeType`
  - `tooltip.trigger`
  - `tooltip.triggerOff`

`ITooltipHandler`接口定义如下：

```ts
interface ITooltipHandler {
  /** 显示 tooltip，可以选择返回是否遇到异常 */
  showTooltip: (
    activeType: TooltipActiveType,
    data: TooltipData,
    params: TooltipHandlerParams
  ) => TooltipResult | null | undefined;

  /** 隐藏 tooltip */
  hideTooltip: (params: TooltipHandlerParams) => void;

  /** 释放 tooltip */
  release: () => void;
}
```

其中`ITooltipHandler.showTooltip`有三个参数，意义分别为：

- `activeType`: 透出本次触发的 tooltip 类型，值为`'mark'`或`'dimension'`
- `data`: 透出本次触发的 tooltip 原始数据
- `params`: 透出本次触发的 tooltip 的鼠标事件

`data`参数的类型为`TooltipData`，类型定义为：

```ts
type TooltipData = IDimensionInfo[] | IDimensionData[];
```

如果用户触发了 mark tooltip，`TooltipData` 便为 `IDimensionData[]` 类型。`IDimensionData`的类型定义为：

```ts
interface IDimensionData {
  /** 图元上的原始数据（考虑到有多个图元的情况，实际为数组类型） */
  datum: Datum[];
  /** 图元所在的系列实例 */
  series: ISeries;
}
```

而如果用户触发了 dimension tooltip，`TooltipData` 便为 `IDimensionInfo[]` 类型。`IDimensionInfo`承载了鼠标所在整个维度项的信息，类型定义为：

```ts
interface IDimensionInfo {
  /** 维度项索引 */
  index?: number;
  /** 维度项标题 */
  value: string;
  /** 维度项所在轴 */
  axis?: AxisComponent;
  /** 维度项对应数据 */
  data: IDimensionData[];
}
```

用户可以选择使`ITooltipHandler.showTooltip`方法返回一个状态`TooltipResult`，用来表示 tooltip 是否成功显示（如果不返回，则默认当做成功）。这个返回值和缓存策略有关。`TooltipResult`是个枚举类型，定义为：

```ts
enum TooltipResult {
  /** tooltip 显示成功 */
  success = 0,
  /** tooltip 未成功显示 */
  failed = 1
}
```

`ITooltipHandler.showTooltip`方法的最后一个参数为`params`，其类型定义为：

```ts
type TooltipHandlerParams = (BaseEventParams | DimensionEventParams) & {
  changePositionOnly?: boolean;
};
```

其中暴露了一个很有用的参数：`changePositionOnly`，**代表这个 tooltip 是否仅仅是上一个 tooltip 挪用了下位置，而数据相同**。这个参数将帮助用户对 tooltip 渲染进行优化。

示例：在控制台打出用户鼠标 hover 的维度项标题、以及系列图元的填充颜色：

```ts
vchart.setTooltipHandler({
  showTooltip: (activeType, data, params) => {
    if (params.changePositionOnly) {
      return;
    }
    if (activeType === 'dimension' && data?.length) {
      console.log(data[0].value);
    } else if (activeType === 'mark') {
      const { datum, series } = data[0];
      const color = series.getSeriesStyle(datum[0])('fill');
      console.log(color);
    }
  }
});
```

### getTooltipHandler

获取`TooltipHandler`。

```ts
getTooltipHandler: () => ITooltipHandler | undefined;
```

### showTooltip

手动调用展示 tooltip。

```ts
/**
 * 手动调用展示 tooltip
 * @param datum 原始数据
 * @param options
 * @returns
 */
showTooltip: (datum: Datum, options: IShowTooltipOption) => boolean;

interface IRegionQuerier {
  regionId?: StringOrNumber;
  regionIndex?: number;
}

interface IShowTooltipOption extends IRegionQuerier {
  /* tooltip预期显示的x坐标（为空则在图元附近） */
  x?: number;
  /* tooltip预期显示的y坐标（为空则在图元附近） */
  y?: number;
  /* 是否常显（如果为false或空的话，手动触发tooltip之后，tooltip可能被自动触发的别的tooltip替代） */
  alwaysShow?: boolean;
  /* tooltip类型（为空则自动判断） */
  activeType?: TooltipActiveType;
}
```

### hideTooltip

手动调用，关闭 tooltip

```ts
hideTooltip: () => boolean;
```

### getLegendDataById

根据图例组件 id 获取图例数据，该 id 来源于在 spec 的 `legends` 字段中配置的 `id`。如： `legends: { id: 'bottom' }` 或者 `legends: [{ id: 'left' }]`

```ts
  /**
   * 根据图例组件 id 获取图例数据
   * @param id 组件 id
   * @returns
   */
  getLegendDataById: (id: string) => Datum[];
```

图例数据类型：

```ts
type LegendDatum = {
  key: string; // 图例项分组
  shapeType?: string; // 图例 symbol 形状
  style?: (channel: string) => any; // 图例样式函数，接收视觉通道名称并返回视觉通道样式，例如 'fill'
};
```

### getLegendDataByIndex

根据图例组件索引获取图例数据。

```ts
  /**
   * 根据图例组件索引获取图例数据
   * @param index 图例索引，默认为 0
   * @returns
   */
  getLegendDataByIndex: (index?: number) => Datum[];
```

图例数据类型：

```ts
type LegendDatum = {
  key: string; // 图例项分组
  shapeType?: string; // 图例 symbol 形状
  style?: (channel: string) => any; // 图例样式函数，接收视觉通道名称并返回视觉通道样式，例如 'fill'
};
```

### getLegendSelectedDataById

根据图例组件 id 获取当前图例的选中项，该 id 来源于在 spec 的 `legends` 字段中配置的 `id`。如： `legends: { id: 'bottom' }` 或者 `legends: [{ id: 'left' }]`

```ts
  /**
   * 根据图例组件 id 获取当前图例的选中项
   * @param id 组件 id
   * @returns
   */
  getLegendSelectedDataById: (id: string) => StringOrNumber[];
```

### getLegendSelectedDataByIndex

根据图例组件索引获取当前图例的选中项。

```ts
  /**
   * 根据图例组件索引获取当前图例的选中项
   * @param index 图例索引，默认为 0
   * @returns
   */
  getLegendSelectedDataByIndex: (index?: number) => StringOrNumber[];

```

### setLegendSelectedDataById

根据图例组件 id 更新图例选中数据，该 id 来源于在 spec 的 `legends` 字段中配置的 `id`。如： `legends: { id: 'bottom' }` 或者 `legends: [{ id: 'left' }]`

```ts
  /**
   * 根据图例组件 id 更新图例选中数据
   * @param id
   * @returns
   */
  setLegendSelectedDataById: (id: string, selectedData: StringOrNumber[]) => void;
```

### setLegendSelectedDataByIndex

根据图例组件索引更新图例选中数据。

```ts
  /**
   * 根据图例组件索引更新图例选中数据
   * @param index 图例索引，默认为 0
   * @returns
   */
  setLegendSelectedDataByIndex: (index: number, selectedData: StringOrNumber[]) => void;
```

### getDataURL

**异步方法**返回一个包含图片展示的 data URI。

```ts
getDataURL: () => Promise<any>;
```

### exportImg

**异步方法** 导出图表图片，只支持浏览器端，同时参数 `name` 可以为图片进行命名。

```ts
/**
 * **异步方法** 导出图表图片，只支持浏览器端。
 * @param name 保存的图片名称
 * @returns
 */
exportImg: (name?: string) => Promise<void>;
```

### exportCanvas

导出绘制有图表内容的 canvas ，只支持浏览器端。可以使用这个 canvas 进行二次处理，比如添加水印等。

```ts
/**
 * 导出绘制了图表内容的 canvas
 * @returns HTMLCanvasElement
 * @since 1.5.2
 */
exportCanvas: () => HTMLCanvasElement | undefined;
```

### getImageBuffer

目前仅支持 node 环境，用于 node 端的图片导出。

```ts
 getImageBuffer: () => void;
```

### setLayout

设置自定义布局。

```ts
/**
 * 设置自定义布局
 */
setLayout: (layout: LayoutCallBack) => void;

type LayoutCallBack = (
  chart: IChart,
  item: ILayoutItem[],
  chartLayoutRect: IRect,
  chartViewBox: IBoundsLike
) => void;
```

### reLayout

强制重新布局。

```ts
 reLayout: () => void;
```

### getCompiler

获取编译器实例。

```ts
getCompiler: () => Compiler;
```

### getChart

获取 Chart 图表实例。

```ts
getChart: () => IChart;
```

### getStage

获取渲染引擎实例。

```ts
getStage: () => Stage;
```

### getCanvas

获取 canvas dom。

```ts
getCanvas: () => HTMLCanvasElement | undefined;
```

### getContainer

获取图表的 dom 容器。

```ts
getContainer: () => Maybe<HTMLElement>;
```

### getComponents

获取图表所有的组件实例。

```ts
getComponents: () => IComponent[];
```

### getDataSet

获取图表的 DataSet 实例。

```ts
getDataSet: () => DataSet;
```

### getScale

自版本 `1.10.4`开始支持;

获取图表的 Scale 实例。

```ts
getScale: (scaleId: string) => IBaseScale;
```

### setDimensionIndex

手动调用触发 dimension 交互效果。

```ts
/**
 * 手动调用触发 dimension 交互效果。
 * @param datum dimension 值
 * @param options
 * @returns
 */
setDimensionIndex: (value: StringOrNumber, options: DimensionIndexOption = {}) => void;

type DimensionIndexOption = {
  // 当存在多个数轴时，通过 filter 筛选要触发 dimension 效果的轴
  // 目前只有离散数轴可以触发 dimension 效果
  filter?: (cmp: IComponent) => boolean;
  // 是否触发 tooltip , default is true
  tooltip?: boolean;
  // tooltip 触发时的 showTooltipOption 参数，请参考上方 api-showTooltip 中的说明
  showTooltipOption?: IShowTooltipOption;
  // 是否触发 crosshair , default is true
  crosshair?: boolean;
};

```

[相关示例](https://visactor.io/vchart/demo/line-chart/line-default-select)

### convertDatumToPosition

根据数据集中的数据获取对应的图表坐标位置。该数据需要从传入图表的数据集中获取，如果数据不存在数据集中，可以使用 `convertValueToPosition` 方法。

```ts
/**
 * 将图形对应的数据转换为坐标，该数据需要从传入图表的数据集中获取，如果数据不存在数据集中，可以使用 `convertValueToPosition` 方法
 * @param datum 要转化的数据 the datum（from data source）to convert
 * @param dataLinkInfo 数据的绑定信息，the data link info, could be seriesId or seriesIndex, default is { seriesIndex: 0 }
 * @param isRelativeToCanvas 是否相对画布坐标 Whether relative to canvas coordinates
 * @param checkInViewData 是否检查数据对应的图元是否在视图中，如果不在视图中，返回 null
 * @returns
 */
convertDatumToPosition: (
  datum: Datum,
  dataLinkInfo?: DataLinkSeries,
  isRelativeToCanvas?: boolean,
  checkInViewData?: boolean
) => IPoint | null;
```

### convertValueToPosition

将数值转换为对应的 canvas 坐标点。

```ts
/**
 * 将数值转换为对应的 canvas 坐标点。
 * @param value number | [number, number], 需要转换的数值，可以是单个数值，也可以是数组，如果是数组，则会转换为对应的 x y 坐标点
 * @param dataLinkInfo 数据绑定的信息，可以是 `seriesId` `seriesIndex` `axisId` `axisIndex`
 * @param isRelativeToCanvas 是否相对画布坐标，默认为 false Whether relative to canvas coordinates, default is false
 * returns
 */
convertValueToPosition: ((value: StringOrNumber, dataLinkInfo: DataLinkAxis, isRelativeToCanvas?: boolean) =>
  number | null) &
  ((value: [StringOrNumber, StringOrNumber], dataLinkInfo: DataLinkSeries, isRelativeToCanvas?: boolean) =>
    IPoint | null);
```

### updateIndicatorDataById

根据指标卡组件 id 更新指标卡数据。

```ts
  /**
   * 根据 indicator 组件 id 更新 indicator 数据
   * @param id spec 中定义的 indicator id
   * @param datum 具体数据项
   * @since 1.11.7
   */
  updateIndicatorDataById: (id: string, datum?: Datum) => void;
```

### updateIndicatorDataByIndex

根据指标卡组件索引更新指标卡数据。

```ts
  /**
   * 根据 indicator 组件 id 更新 indicator 数据
   * @param index  indicator 索引下标
   * @param datum 具体数据项
   * @since 1.11.7
   */
  updateIndicatorDataByIndex: (index: number = 0, datum?: Datum) => void;
```

### geoZoomByIndex

地图缩放 API，根据索引顺序指定某个 region 区域的地图坐标系进行缩放。

```ts
/**
 * 地图缩放 API
 * @param [regionIndex=0] 根据索引顺序指定某个 region 区域的地图坐标系进行缩放
 * @param zoom 缩放比例
 * @param center 缩放中心
 * @since 1.11.10
 */
geoZoomByIndex: (regionIndex: number, zoom: number, center?: { x: number; y: number }) => void;
```

### geoZoomById

地图缩放 API，根据 region id 指定某个 region 区域的地图坐标系进行缩放。

```ts
/**
 * 地图缩放 API
 * @param 根据 region id 指定某个 region 区域的地图坐标系进行缩放
 * @param zoom 缩放比例
 * @param center 缩放中心
 * @since 1.11.10
 */
geoZoomById: (regionId: string | number, zoom: number, center?: { x: number; y: number }) => void;
```
