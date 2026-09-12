# 媒体查询器

The English version is working in progress.

在图表的实际应用中，有时会需要 VChart 内部的图表元素有随着容器尺寸变化而变化的能力，比如一个图表需要同时在 PC、移动端上展现的场景。为了解决这个问题，VChart 实现了类似 CSS Media Query 的自适应能力。

本教程将深入剖析 VChart 媒体查询器的设计和应用，通过实例落地，帮助用户熟练使用 VChart 的自适应功能。

## VChart 的媒体查询设计

VChart 的媒体查询可以总结为 query-action 结构。其中：

- `query`：媒体查询条件
- `action`：命中媒体查询条件之后执行的动作

在实际应用中，`query` 可以是一个确定的 `maxWidth` 和/或 `maxHeight`，用于指定该查询对应的媒体条件。如果图表的尺寸达到了这个条件，就会执行对应的动作。

在这里，我们将动作限定为图表 spec 更改。而为了描述动作，可以将 `action` 继续拆分为以下部分：

- `actionType`：指定动作类型
- `filter`：元素过滤器，决定动作应用于哪些元素
- `spec`：描述这些元素的 spec 更改

在 VChart 中，每个查询对应于一个 `query` 和若干个 `action`，每个 `action` 对应于一个 `filter` 和 `spec`。其结构如下图所示：

![img](/vchart/guide/media-query/0.png)

接下来将详述上图中的每个部分。

### 动作类型 actionType

在命中 `query` 之后，有两类动作相对比较高频：

- 更新特定图表元素的 spec。例如：在图表尺寸极小时隐藏图例、隐藏图表标题、缩小 padding
- 新增图表元素。例如：检测到环境为移动端时，添加移动端专属的组件，如将 scrollBar 改为 dataZoom

动作类型 `actionType` 用于指定执行哪一类动作。目前有 2 个选项：

- `update`：使用元素过滤器 `filter` 来过滤需要更改的图表元素，并将新 spec 依次合并到这些元素。
- `updateOrAdd`：使用元素过滤器 `filter` 来过滤需要更改的图表元素，如果过滤到了某些图表元素，则将新 spec 依次合并到这些元素；否则将新 spec 作为新的图表元素添加到图表。

### 元素过滤器 filter

如果动作类型为 `update`，元素过滤器 `filter` 用于指定在命中了 `query` 以后，哪些图表元素需要更新 spec。在 `filter` 匹配到了某些图表元素后，新的 spec 将依次合并到这些图表元素的 spec 中。

目前将以下四种元素看作是元素过滤器可以匹配的对象，用 `filterType` 表示：

- region
- series
- component
- chart

为了平衡灵活性和配置的简便性，最大化复用现有的 spec 声明，`filter` 计划支持的匹配方法有两种：

- 直接将元素 spec 的一部分设置为 `filter`，在过滤图表元素时，基于此 spec 进行模糊匹配。

  比如：要匹配出位于右上角的图例，只需将 `filterType` 配置为图例，再将以下 spec 片段作为 `filter`：

  ```ts
    {
      orient: 'right',
      position: 'start',
    }
  ```

  如果用户的图表中含有包含这个 spec 片段的图例，这个图例将会被 `filter` 匹配到。

- 配置为函数回调，依次用回调决定当前元素类型下的每个元素实例是否被匹配。

### 新 spec

在 `action` 中，用户需要指定预期生效的新 spec：

- 如果 `actionType` 为 `update`，新 spec 将合并到 `filter` 过滤出来的图表元素 spec 中
- 如果 `actionType` 为 `updateOrAdd`，如果 `filter` 没有过滤到任何已有元素，新 spec 将作为新的图表元素 spec 添加到图表

新 spec 预期的配置方式也有两种：

- 直接指定新 spec
- 使用回调的方式返回新 spec

## 接口设计

### 基本配置

首先定义媒体查询器 spec 的基本配置：

```ts
/**
 * 媒体查询配置（包含多项查询）
 * @since 1.8.0
 */
export type IMediaQuerySpec = IMediaQueryItem[];

/** 媒体查询配置（表示一项查询）*/
export interface IMediaQueryItem {
  /** 媒体查询条件 */
  query: IMediaQueryCondition;
  /** 命中媒体查询条件之后的动作 */
  action: IMediaQueryAction | IMediaQueryAction[];
}

/** 将媒体查询加入图表 spec */
interface IXXXChartSpec {
  ...
  media?: IMediaQuerySpec;
}
```

在图表 spec 顶层添加 `media` 属性，存放 0 个到多个媒体查询项的数组。

每个媒体查询项，包含 `query` 和 `action` 两个配置项。`action` 可以配置为多个，在命中 `query` 后将依次执行。

### query

`query` 的类型定义如下所示：

```ts
/** 媒体查询条件，多个属性之间为“且”关系 */
export interface IMediaQueryCondition {
  /** 最小图表宽度 */
  minWidth?: number;
  /** 最大图表宽度 */
  maxWidth?: number;
  /** 最小图表高度 */
  minHeight?: number;
  /** 最大图表高度 */
  maxHeight?: number;
  /** 当图表宽度或高度发生变化时触发的回调，由回调指定是否命中查询条件 */
  onResize?: (info: IMediaInfo, vchart: IVChart) => boolean;
}
```

其中既包含静态配置项，也包含回调。回调在某些特定的时机触发（类似于事件），如果返回 `true`，则当作 `query` 被命中，立即执行 `action`。

### action

一个 `query` 可以对应若干个 `action`。 单个 `action` 可以配置为实现 `IMediaQueryAction` 接口的对象：

```ts
/** 命中媒体查询条件之后的动作 */
export interface IMediaQueryAction<T extends Record<string, unknown> = any> {
  /**
   * 需要应用的新 spec
   * - 如果元素过滤器匹配到了某些图表元素，新 spec 将依次合并到这些元素
   * - 如果元素过滤器没有匹配到任何图表元素，新 spec 可能会作为新的图表元素添加到图表（forceAppend 为 true 的情况）。
   *
   * 有两种配置类型：
   * - 直接指定新 spec
   * - 使用回调的方式返回新 spec
   */
  spec:
    | Partial<T>
    | ((
        /** filter 匹配到的图表元素信息 */
        filteredModelInfo: IFilteredModelInfo<T>[],
        /** 当前 action 对象 */
        action: IMediaQueryAction<T>,
        /** 当前媒体查询条件 */
        query: IMediaQueryCondition
      ) => Partial<T>);
  /**
   * 元素过滤器类型
   * （规定 filter 需要过滤的元素类型，以及新 spec 对应的元素类型）
   * @default 'chart'
   */
  filterType?: MediaQueryActionFilterType;
  /**
   * 元素过滤器
   * （如果不配置，则匹配 filterType 对应的所有元素）
   *
   * 有两种配置类型：
   * - 配置为元素 spec 的一部分，在过滤图表元素时基于此 spec 进行模糊匹配
   * - 配置为函数回调，依次决定当前 filterType 类型下的每个元素实例是否被匹配
   */
  filter?: MediaQueryActionFilter<T> | Array<MediaQueryActionFilter<T>>;
  /**
   * 元素过滤器匹配不到图表元素时，是否将新 spec 作为新的图表元素添加到图表
   * （filterType 为 'chart' 时该配置失效）
   * @default false
   */
  forceAppend?: boolean;
}
```

其中范型 `T` 表示目标元素具体的 spec 类型。

其中 `filterType` 的类型定义为：

```ts
/**
 * 元素过滤器类型
 */
export type MediaQueryActionFilterType =
  | 'region'
  | 'series'
  | 'chart'
  | `${SeriesTypeEnum}` // 具体 series 类型，如 'bar'、'line'
  | `${ComponentTypeEnum}` // 具体 component 类型，如 'cartesianAxis-band'
  | keyof IChartSpec; // 组件 spec key，可视为简化版 component 类型，如 'axes'、'legends'、'crosshair'
```

元素过滤器 `filter` 的类型定义为：

```ts
/**
 * 元素过滤器
 *
 * 有两种配置类型：
 * - 配置为元素 spec 的一部分，在过滤图表元素时基于此 spec 进行模糊匹配
 * - 配置为函数回调，依次决定当前 filterType 类型下的每个元素实例是否被匹配
 */
export type MediaQueryActionFilter<T extends Record<string, unknown> = any> =
  | Partial<T>
  | ((
      /** 当前图表元素信息 */
      modelInfo: IFilteredModelInfo<T>,
      /** 当前 action 对象 */
      action: IMediaQueryAction<T>,
      /** 当前媒体查询条件 */
      query: IMediaQueryCondition
    ) => boolean);
```

## 可插拔设计

媒体查询属于可选功能。如果一个页面只面向移动端环境，那么可能并不需要用到图表媒体查询。同时，在小程序等环境里往往对包体积有严格要求，因此媒体查询默认不在 VChart 上内置，而是采用图表插件的形式提供。

在使用前，需要在全局注册媒体查询插件。VChart 默认提供了注册函数，全局执行一次以下函数即可使用：

```ts
import { default as VChart, registerMediaQuery } from '@visactor/vchart';

// 注册插件
registerMediaQuery();

const vchart = new VChart(...);
```

## 使用示例

声明媒体查询逻辑，在图表高度小于 200px 时：

- 将显示在顶部、底部的图例显示在左侧，padding 设为 0
- 隐藏标题
- 将图表 padding 设为 10

```javascript livedemo
VCHART_MODULE.registerMediaQuery();

const getSpec = () => ({
  type: 'pie',
  data: [
    {
      id: 'id0',
      values: [
        { type: 'oxygen', value: '46.60' },
        { type: 'silicon', value: '27.72' },
        { type: 'aluminum', value: '8.13' },
        { type: 'iron', value: '5' },
        { type: 'calcium', value: '3.63' },
        { type: 'sodium', value: '2.83' },
        { type: 'potassium', value: '2.59' },
        { type: 'others', value: '3.5' }
      ]
    }
  ],
  outerRadius: 0.8,
  innerRadius: 0.5,
  padAngle: 0.6,
  valueField: 'value',
  categoryField: 'type',
  title: {
    visible: true,
    text: 'Statistics of Surface Element Content'
  },
  legends: {
    visible: true
  },
  tooltip: {
    mark: {
      content: [
        {
          key: datum => datum['type'],
          value: datum => datum['value'] + '%'
        }
      ]
    }
  },
  media: [
    {
      query: {
        maxHeight: 200
      },
      action: [
        {
          filterType: 'legends',
          filter: [{ orient: 'top' }, { orient: 'bottom' }],
          spec: { orient: 'left', padding: 0 }
        },
        {
          filterType: 'title',
          spec: { visible: false }
        },
        {
          filterType: 'chart',
          spec: { padding: 10 }
        }
      ]
    }
  ]
});

const vchart = new VChart(getSpec(), { dom: CONTAINER_ID });
vchart.renderSync();

vchart.getCanvas().style.outline = '1px solid orange';

setTimeout(() => {
  vchart.updateSpec(
    {
      width: 300,
      height: 199
    },
    true
  );
}, 2000);
```
