# Openinula VChart

- 仓库地址：[https://github.com/VisActor/VChart/tree/main/packages/openinula-vchart](https://github.com/VisActor/VChart/tree/main/packages/openinula-vchart)

为了方便 Openinula 技术栈的同学更好得使用 VChart，我们提供了 VChart 的 Openinula 封装包：`@visactor/openinula-vchart`。该组件主要对 VChart 的图表部件做 Openinula 组件化的封装，相关的配置项均与 VChart 一致。

我们将在本教程中详细讲解如在 Openinula 项目中使用 VChart，并创建一个简单的柱状图。更多详细 api 文档，请查看 [`@visactor/openinula-vchart`](https://github.com/VisActor/VChart/blob/main/packages/openinula-vchart/docs/2.1%20API%E8%AE%BE%E8%AE%A1.md) 仓库的文档。

## 快速上手

### 如何安装

要开始使用 Openinula VChart，首先需要在你的 Openinula 项目中安装 `@visactor/openinula-vchart` 包。在项目根目录下，使用以下命令安装该包：

```
npm install @visactor/openinula-vchart
```

或者使用 yarn 进行安装：

```
yarn add @visactor/openinula-vchart
```

### 创建图表

以创建一个简单的状图为例。在你的 Openinula 组件中，引入 `visactor/openinula-vchart` 的 `<BarChart>` 组件，并在组件中使用它们。下面是一个创建柱状图的示例代码：

```javascript
import React, { useRef } from 'openinula';
import { BarChart, Bar, Legend, Axis } from '@visactor/openinula-vchart';

const App = () => {
  const chartRef = useRef(null);
  const handleChartClick = () => {
    console.log('图表被点击了');
  };

  const barData = [
    { type: 'Autocracies', year: '1930', value: 129 },
    { type: 'Autocracies', year: '1940', value: 133 },
    { type: 'Autocracies', year: '1950', value: 130 },
    { type: 'Autocracies', year: '1960', value: 126 },
    { type: 'Autocracies', year: '1970', value: 117 },
    { type: 'Autocracies', year: '1980', value: 114 },
    { type: 'Autocracies', year: '1990', value: 111 },
    { type: 'Autocracies', year: '2000', value: 89 },
    { type: 'Autocracies', year: '2010', value: 80 },
    { type: 'Autocracies', year: '2018', value: 80 },
    { type: 'Democracies', year: '1930', value: 22 },
    { type: 'Democracies', year: '1940', value: 13 },
    { type: 'Democracies', year: '1950', value: 25 },
    { type: 'Democracies', year: '1960', value: 29 },
    { type: 'Democracies', year: '1970', value: 38 },
    { type: 'Democracies', year: '1980', value: 41 },
    { type: 'Democracies', year: '1990', value: 57 },
    { type: 'Democracies', year: '2000', value: 87 },
    { type: 'Democracies', year: '2010', value: 98 },
    { type: 'Democracies', year: '2018', value: 99 }
  ];

  return (
    <div>
      <BarChart ref={chartRef} data={[{ id: 'id0', values: barData }]} onClick={handleChartClick}>
        <Bar
          seriesField="type"
          xField={['year', 'type']}
          yField="value"
          bar={{
            style: {
              stroke: '#000',
              strokeWidth: 1
            },
            state: {
              hover: {
                stroke: 'black'
              }
            }
          }}
        />
        <Axis orient="bottom" type="band" />
        <Axis orient="left" max={200} type="linear" />
        <Legend visible={true} position="start" orient="top" padding={{ bottom: 12 }} />
      </BarChart>
    </div>
  );
};

export default App;
```

在这个示例中，我们创建了一个简单的柱状图，使用了一些基本的组件和配置。

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/350c0511133d336e622523213.png" alt="柱状图示例">
</div>

## 组件选择

为了适应不同用户场景和使用习惯，VChart 提供了两种标签风格：

- `<VChart />`：一个大而全的统一入口标签，封装了图表的规范、提供规范的更新、卸载逻辑。适用于 toB 页面，存在页面搭建类的产品页面，以及自行封装 VChart 的业务方迁移。
- `<BarChart />`、`<LineChart />`、`<CommonChart />`等语法化标签：适用于简单页面，开发人员手写代码。方便实现拆包按需加载。

上面的柱状图示例使用了语法化标签 `<BarChart />`，你可以根据需要选择适合的标签风格。接下来，我们将介绍如何根据你的需求调整图表。

## 图表配置及优化

在创建了一个简单的柱状图之后，你可能会需要根据项目的需求进行一些调整。VChart 提供了丰富的配置选项，以满足不同的场景。

- 图表样式：你可以通过配置 `bar` 属性中的 `style` 来设置柱状图的样式。例如，修改柱的颜色、描边、宽度等。
- 自定义图例：通过设置 `<Legend>` 组件的 `visible`、`position`、`orient` 等属性，你可以自定义图例的显示和位置。
- 调整坐标轴：在 `<Axis>` 组件中，你可以设置 `orient`、`type` 等属性来调整坐标轴的显示，或通过修改 `label` 属性来调整轴上的标签显示。

以下是一个根据需求调整后的柱状图：

```javascript
<BarChart ref={chartRef} data={[{ id: 'id0', values: barData }]} onClick={handleChartClick}>
  <Bar
    seriesField="type"
    xField={['year', 'type']}
    yField="value"
    bar={{
      style: {
        fill: 'blue',
        stroke: 'black',
        strokeWidth: 1
      },
      state: {
        hover: {
          fill: 'orange'
        }
      }
    }}
  />
  <Axis orient="bottom" type="band" />
  <Axis orient="left" max={200} type="linear" label={{ visible: true }} />
  <Legend visible={true} position="start" orient="top" padding={{ bottom: 12 }} />
</BarChart>
```

通过调整配置，我们得到了一个更符合在实际项目中的柱状图。

## 统一图表标签 `<VChart />`

`<VChart />` 接收的一个完整的**spec**作为图表定义，其**spec**的数据结构完全等同于 VChart 中的定义，因此开发者可以将任何对于 VChart 合法的 spec 送入 Openinula-VChart 中进行图表渲染。

### Props

如果你已经有了 spec 图表描述信息，使用统一图表标签是比较快捷的方式，只需要引入`VChart`组件即可：

```typescript
import { VChart } from '@visactor/openinula-vchart';
```

`VChart`组件即封装的 Openinula 组件，其 props 定义如下：

```typescript
interface VChartProps extends EventsProps {
  /** 图表定义 */
  spec: any;
  /** 图表配置 */
  options?: ChartOptions;
  /** 图表渲染完成事件 */
  onReady?: (instance: VChart, isInitial: boolean) => void;
  /** throw error when chart run into an error */
  onError?: (err: Error) => void;
  /**
   * 切换到同步渲染
   *
   * @since 1.8.3
   **/
  useSyncRender?: boolean;
  /**
   * props更新的时候，跳过所有函数的检查，即所有的函数都认为没有更新
   *
   * @since 1.6.5
   **/
  skipFunctionDiff?: boolean;
}
```

`EventsProps` 的定义参考事件交互章节

`onReady`是一个内置的回调事件，会在图表渲染或更新时触发，其入参分别代表图表实例对象，以及是否初次渲染。

举例来说，开发者可以在初次渲染时，将需要触发的回调事件注册在图表实例上以实现图表交互功能。

## 语法化标签

语法化标签是指 Openinula-VChart 将图表的图表容器以及各个组件都封装为 Openinula 组件导出给开发者，开发者可以通过更加语义化、更接近原生 Openinula 声明的方式来定义图表。需要说明的是语法化标签的定义内容，在多数场景下都是可以和图表描述 spec 进行相互转化的，本文主要的内容也是解释语法化标签与 spec 的关系。

### 标签的分类

目前 Openinula-VChart 共导出了三种类型的组件标签，分别是图表标签、组件标签、系列标签

#### 图表标签

图表类型的标签，包括以下这些：

```typescript
import {
  AreaChart,
  BarChart,
  LineChart,
  ScatterChart,
  PieChart,
  RoseChart,
  RadarChart,
  MapChart,
  HistogramChart,
  WordCloudChart,
  FunnelChart,
  BoxPlotChart,
  CircularProgressChart,
  LinearProgressChart,
  RangeColumnChart,
  CommonChart
} from '@visactor/openinula-vchart';
```

一般情况下使用这些标签直接决定了图表类型。而其中比较特殊的是 CommonChart，这是一个通用图表类型标签，可以用来实现组合图、双轴图等图表类型。更多组合图说明可参考：[组合图]()

这些图表标签的 Props 定义为：

```typescript
interface ChartComponent extends EventsProps {
  /** 数据 */
  data?: IData;
  /** 画布宽度 */
  width?: number;
  /** 画布高度 */
  height?: number;
  /** 图表配置 */
  options?: ChartOptions;
  /** 图表渲染完成事件 */
  onReady?: (instance: VChart, isInitial: boolean) => void;
}
```

`EventsProps`的定义参考事件交互章节

`onReady`是一个内置的回调事件，会在图表渲染或更新时触发，其入参分别代表图表实例对象，以及是否初次渲染。

#### 组件标签

组件标签是指 VChart 图表内部的可视化组件，包括以下这些：

```typescript
import {
  // 坐标轴组件
  Axis,
  // 图例组件
  Legend,
  // Brush组件
  Brush,
  // Crosshair组件
  Crosshair,
  // DataZoom 组件
  DataZoom,
  // Indicator 组件
  Indicator,
  MarkArea,
  MarkLine,
  MarkPoint,
  Player,
  ScrollBar,
  Title,
  Tooltip,
  // 自定义图元系列
  Mark,
  //
  Region
} from '@visactor/openinula-vchart';
```

这些组件并不会真实的存在于 DOM 结构中，这样的写法只是为了更清晰的展示图表的结构组成。其中这些组件的配置项完全对齐 VChart 中对应组件的定义，区别在于原本的数据结构定义在此时可以作为 props 参数进行配置。

#### 系列组件

系列组件是指和图表类型对应的图元系列所定义的组件。若指定了图表组件的类型，则应该使用与之对应的系列组件进行图元的定义，系列组件包含以下这些：

```typescript
import {
  Area,
  Bar,
  Line,
  Scatter,
  Map,
  Pie,
  Rose,
  Radar,
  Dot,
  Link,
  CircularProgress,
  WordCloud,
  Funnel,
  LinearProgress,
  RangeColumn,
  BoxPlot
} from '@visactor/openinula-vchart';
```

### 语法化标签的使用

首先明确语法化标签 props 定义的基本原则：语法标签的 props 与 spec 里对应组件的 api 定义是基本对等的，此外语法标签上新增了更多回调入口用于方便的进行事件挂载。

举例说明，现有折线图 spec 定义如下：

```json
{
  "type": "line",
  "data": [
    {
      "id": "lineData",
      "values": [
        { "State": "WY", "年龄段": "小于5岁", "人口数量": 25635 },
        { "State": "WY", "年龄段": "5至13岁", "人口数量": 1890 },
        { "State": "WY", "年龄段": "14至17岁", "人口数量": 9314 },
        { "State": "DC", "年龄段": "小于5岁", "人口数量": 30352 },
        { "State": "DC", "年龄段": "5至13岁", "人口数量": 20439 },
        { "State": "DC", "年龄段": "14至17岁", "人口数量": 10225 },
        { "State": "VT", "年龄段": "小于5岁", "人口数量": 38253 },
        { "State": "VT", "年龄段": "5至13岁", "人口数量": 42538 },
        { "State": "VT", "年龄段": "14至17岁", "人口数量": 15757 },
        { "State": "ND", "年龄段": "小于5岁", "人口数量": 51896 },
        { "State": "ND", "年龄段": "5至13岁", "人口数量": 67358 },
        { "State": "ND", "年龄段": "14至17岁", "人口数量": 18794 },
        { "State": "AK", "年龄段": "小于5岁", "人口数量": 72083 },
        { "State": "AK", "年龄段": "5至13岁", "人口数量": 85640 },
        { "State": "AK", "年龄段": "14至17岁", "人口数量": 22153 }
      ]
    }
  ],
  "xField": "State",
  "yField": "人口数量",
  "seriesField": "年龄段",
  "legends": {
    "visible": true,
    "orient": "top"
  },
  "axes": [
    {
      "type": "band",
      "orient": "bottom"
    },
    {
      "type": "linear",
      "orient": "left",
      "label": {
        "style": {
          "fill": "#aaa",
          "fontSize": 14
        }
      }
    }
  ]
}
```

与之对应的语法化标签定义如下：

```typescript
import React from 'openinula';
import { LineChart, Line, Axis, Legend } from '@visactor/openinula-vchart';

function MyChart(props) {
  const lineData = [
    {
      id: 'lineData',
      values: [
        { State: 'WY', 年龄段: '小于5岁', 人口数量: 25635 },
        { State: 'WY', 年龄段: '5至13岁', 人口数量: 1890 },
        { State: 'WY', 年龄段: '14至17岁', 人口数量: 9314 },
        { State: 'DC', 年龄段: '小于5岁', 人口数量: 30352 },
        { State: 'DC', 年龄段: '5至13岁', 人口数量: 20439 },
        { State: 'DC', 年龄段: '14至17岁', 人口数量: 10225 },
        { State: 'VT', 年龄段: '小于5岁', 人口数量: 38253 },
        { State: 'VT', 年龄段: '5至13岁', 人口数量: 42538 },
        { State: 'VT', 年龄段: '14至17岁', 人口数量: 15757 },
        { State: 'ND', 年龄段: '小于5岁', 人口数量: 51896 },
        { State: 'ND', 年龄段: '5至13岁', 人口数量: 67358 },
        { State: 'ND', 年龄段: '14至17岁', 人口数量: 18794 },
        { State: 'AK', 年龄段: '小于5岁', 人口数量: 72083 },
        { State: 'AK', 年龄段: '5至13岁', 人口数量: 85640 },
        { State: 'AK', 年龄段: '14至17岁', 人口数量: 22153 }
      ]
    }
  ];

  return (
    <BarChart
      data={barData}
      onClick={ev => {
        console.log('chart click', ev);
      }}
    >
      <Bar xField="State" yField="人口数量" />
      <Axis orient="bottom" type="band" />
      <Axis orient="left" type="linear" />
      <Legend
        visible={true}
        onLegendItemClick={ev => {
          console.log('legend click', ev);
        }}
      />
    </BarChart>
  );
}

export default MyChart;
```

### 语法化标签未覆盖的组件

如果在使用 Openinula-VChart 时涉及到语法化标签未覆盖的组件，可以使用统一图表标签作为兜底方案。

## 按需加载

Openinula-VChart 本身代码都支持按需加载，当需要 VChart 按需加载的时候，建议使用 `<VChartSimple />` 标签，

`<VChartSimple />`组件和`<VChart />`组件使用方法基本完全相同，唯一差异点为，需要用户从 `@viasctor/vchart/esm/core` 引用 `VChart` 构造类，并传入给 `<VChartSimple />`;
VChart 按需引用参考[相关文档](/vchart/guide/tutorial_docs/Load_on_Demand)

```typescript
interface VChartSimpleProps extends EventsProps {
  /** 图表定义 */
  spec: any;
  /** 图表配置 */
  options?: ChartOptions;
  /** 图表渲染完成事件 */
  onReady?: (instance: VChart, isInitial: boolean) => void;
  /** throw error when chart run into an error */
  onError?: (err: Error) => void;
  /**
   * 切换到同步渲染
   *
   * @since 1.8.3
   **/
  useSyncRender?: boolean;
  /**
   * props更新的时候，跳过所有函数的检查，即所有的函数都认为没有更新
   *
   * @since 1.6.5
   **/
  skipFunctionDiff?: boolean;
  /**
   * VChart构造类
   *
   * @since 1.8.3
   **/
  vchartConstructor: IVChartConstructor;
}
```

## 事件交互

### 基础事件

统一图表标签（VChart）或是语法化图表标签（BarChart 等）最外层图表组件，其 Props 上都支持底层渲染层抛出的场景树事件`EventsProps`。

`EventsProps`的定义如下：

```typescript
interface EventsProps {
  onPointerDown?: (e: any) => void | boolean;
  onPointerUp?: (e: any) => void | boolean;
  onPointerUpOutside?: (e: any) => void | boolean;
  onPointerTap?: (e: any) => void | boolean;
  onPointerOver?: (e: any) => void | boolean;
  onPointerMove?: (e: any) => void | boolean;
  onPointerEnter?: (e: any) => void | boolean;
  onPointerLeave?: (e: any) => void | boolean;
  onPointerOut?: (e: any) => void | boolean;
  onMouseDown?: (e: any) => void | boolean;
  onMouseUp?: (e: any) => void | boolean;
  onMouseUpOutside?: (e: any) => void | boolean;
  onMouseMove?: (e: any) => void | boolean;
  onMouseOver?: (e: any) => void | boolean;
  onMouseOut?: (e: any) => void | boolean;
  onMouseEnter?: (e: any) => void | boolean;
  onMouseLeave?: (e: any) => void | boolean;
  onPinch?: (e: any) => void | boolean;
  onPinchStart?: (e: any) => void | boolean;
  onPinchEnd?: (e: any) => void | boolean;
  onPan?: (e: any) => void | boolean;
  onPanStart?: (e: any) => void | boolean;
  onPanEnd?: (e: any) => void | boolean;
  onDrag?: (e: any) => void | boolean;
  onDragStart?: (e: any) => void | boolean;
  onDragEnter?: (e: any) => void | boolean;
  onDragLeave?: (e: any) => void | boolean;
  onDragOver?: (e: any) => void | boolean;
  onDragEnd?: (e: any) => void | boolean;
  onRightDown?: (e: any) => void | boolean;
  onRightUp?: (e: any) => void | boolean;
  onRightUpOutside?: (e: any) => void | boolean;
  onTouchStart?: (e: any) => void | boolean;
  onTouchEnd?: (e: any) => void | boolean;
  onTouchEndOutside?: (e: any) => void | boolean;
  onTouchMove?: (e: any) => void | boolean;
  onTouchCancel?: (e: any) => void | boolean;
  onPress?: (e: any) => void | boolean;
  onPressUp?: (e: any) => void | boolean;
  onPressEnd?: (e: any) => void | boolean;
  onSwipe?: (e: any) => void | boolean;
  onDrop?: (e: any) => void | boolean;
  onWeel?: (e: any) => void | boolean;
  onClick?: (e: any) => void | boolean;
  onDblClick?: (e: any) => void | boolean;
}
```

### 组件标签的事件

除了场景树事件，图表组件还支持了自定义事件，自定义事件可以在语义化的组件标签上进行监听，也可以在最外层的 Chart 上进行监听

- `<Legend />`自定义事件

```typescript
interface LegendEventsProps {
  /** 图例项hover事件 */
  onLegendItemHover?: (e: any) => void | boolean;
  /** 图例项hover事件 */
  onLegendItemUnHover?: (e: any) => void | boolean;
  /** 图例项点击事件 */
  onLegendItemClick?: (e: any) => void | boolean;
  onLegendFilter?: (e: any) => void | boolean;
  onLegendSelectedDataChange?: (e: any) => void | boolean;
}
```

- `<Brush />` 自定义事件

```typescript
interface BrushEventsProps {
  /** Brush开始事件 */
  onBrushStart?: (e: any) => void | boolean;
  /** Brush更新事件 */
  onBrushChange?: (e: any) => void | boolean;
  /** Brush结束事件 */
  onBrushEnd?: (e: any) => void | boolean;
  /** Brush清除事件 */
  onBrushClear?: (e: any) => void | boolean;
}
```

- `<DataZoom />` 自定义事件

```typescript
interface DataZoomEventsProps {
  /** DataZoom 更新事件 */
  onDataZoomChange?: (e: any) => void | boolean;
}
```

- `<Player />` 自定义事件

```typescript
interface PlayerEventsProps {
  onPlayerPlay?: (e: any) => void | boolean;
  onPlayerPause?: (e: any) => void | boolean;
  onPlayerEnd?: (e: any) => void | boolean;
  onPlayerChange?: (e: any) => void | boolean;
  onPlayerForward?: (e: any) => void | boolean;
  onPlayerBackward?: (e: any) => void | boolean;
}
```

- `<ScrollBar />` 自定义事件

```typescript
interface ScrollBarEventsProps {
  onScrollBarChange?: (e: any) => void | boolean;
}
```

### 系列组件的事件

系列组件（例如`Bar`、`Line`等组件）同样继承了`EventsProps`事件，详情可参考上文。

### 其他事件

除了上述事件，下列事件都可以在 Chart 进行监听

- 自定义维度事件

```typescript
interface DimensionEventsProps {
  onDimensionHover?: (e: any) => void | boolean;
  onDimensionClick?: (e: any) => void | boolean;
}
```

- 层次数据图表事件

```typescript
interface HierarchyEventsProps {
  onDrill?: (e: any) => void | boolean;
}
```

- 生命周期相关事件

```typescript
interface ScrollBarEventsProps {
  onInitialized?: (e: any) => void | boolean;
  onRendered?: (e: any) => void | boolean;
  onRenderFinished?: (e: any) => void | boolean;
  onAnimationFinished?: (e: any) => void | boolean;
  onLayoutStart?: (e: any) => void | boolean;
  onLayoutEnd?: (e: any) => void | boolean;
}
```

### 事件使用示例

```tsx
import React from 'openinula';
import { BarChart, Bar, Axis, Legend } from '@visactor/openinula-vchart';

function MyChart(props) {
  const barData = [
    {
      id: 'barData',
      values: [
        { month: 'Monday', sales: 22 },
        { month: 'Tuesday', sales: 13 },
        { month: 'Wednesday', sales: 25 },
        { month: 'Thursday', sales: 29 },
        { month: 'Friday', sales: 38 }
      ]
    }
  ];

  return (
    <BarChart
      data={barData}
      onClick={ev => {
        console.log('图表被点击', ev);
      }}
    >
      <Bar
        xField="month"
        yField="sales"
        onClick={ev => {
          console.log('柱形被点击', ev);
        }}
      />
      <Axis orient="bottom" type="band" />
      <Axis orient="left" type="linear" />
      <Legend
        visible={true}
        onLegendItemClick={ev => {
          console.log('图例项被点击', ev);
        }}
      />
    </BarChart>
  );
}

export default MyChart;
```

## 主题样式

如果在 VChart 中使用自定义主题，可以通过两种方式实现，分别是在 spec 中定义 theme，以及通过`ThemeManager`注册主题。因为在 Openinula-VChart 中，并不需要引用 VChart 的 npm 包。因此 Openinula-VChart 中透出了 VChart 基类，命名为`VChartCore`，方便开发者在 VChart 的基类上通过静态方法注册自定义主题。

VChart 的主题配置请参考[VChart 主题](https://visactor.io/vchart/guide/tutorial_docs/Theme/Theme)。

注意，对于按需使用 VChart 的情况，建议直接调用 VChart API 使用主题

## 示例

```tsx
import React from 'openinula';
import { VChartCore, BarChart, Bar, Axis, Legend } from '@visactor/openinula-vchart';

const theme = {
  colorScheme: {
    default: [
      '#5383F4',
      '#7BCF8E',
      '#FF9D2C',
      '#FFDB26',
      '#7568D9',
      '#80D8FB',
      '#1857A3',
      '#CAB0E8',
      '#FF8867',
      '#B9E493',
      '#2CB4A8',
      '#B9E4E3'
    ]
  },
  series: {
    bar: {
      barMaxWidth: 15,
      label: {
        visible: true,
        position: 'top',
        formatMethod: text => text + '%'
      }
    }
  },
  component: {
    axis: {
      label: {
        style: { fontFamily: 'Times New Roman' }
      }
    }
  },
  markByName: {
    bar: {
      style: {
        cornerRadius: 15
      }
    }
  }
};

// 注册主题
VChartCore.ThemeManager.registerTheme('userTheme', theme);
// 应用主题
VChartCore.ThemeManager.setCurrentTheme('userTheme');

function MyChart(props) {
  const data = [
    { type: 'oxygen', value: '46.60' },
    { type: 'silicon', value: '27.72' },
    { type: 'aluminum', value: '8.13' },
    { type: 'iron', value: '5' },
    { type: 'calcium', value: '3.63' },
    { type: 'sodium', value: '2.83' },
    { type: 'potassium', value: '2.59' },
    { type: 'others', value: '3.5' }
  ];

  return (
    <BarChart data={[{ id: 'id0', values: data }]}>
      <Bar xField="type" yField="value" seriesField="type" />
    </BarChart>
  );
}

export default MyChart;
```

## 典型场景

### 自定义图例组件

当 VChart 内置的图例组件不能满足业务需求的时候，在 Openinula 项目中经常存在使用 Openinula 组件实现业务中自定义的图例组件的场景，这种情况下可以通过`updateState`API 实现 Openinula 组件和图表的事件关联；具体实现案例可以[参考](https://codesandbox.io/s/visactor-vchart-legend-demo-tdqmq3?file=/src/PieChart.tsx)

其中核心代码如下：

```javascript
export function PieChart() {
  const chartInstance = useRef(null);
  const legendData = useMemo(() => {
    return (spec as any).data[0].values.map((entry: any) => {
      return {
        key: entry.type,
        value: entry.value,
        text: entry.type
      };
    });
  }, []);

  const handleLegendHover = useCallback(
    (activeDatum: CustomizedLegendDatum, active: boolean) => {
      if (chartInstance.current) {
        if (active) {
          (chartInstance.current as any).updateState({
            cutomizedLegendHover: {
              filter: (datum: any) => datum.type === activeDatum.key
            }
          });
        } else {
          (chartInstance.current as any).updateState({
            cutomizedLegendHover: {
              filter: (datum: any) => false
            }
          });
        }
      }
    },
    []
  );

  return (
    <div className="cusomized-pie-chart">
      <CustomizedLegend data={legendData} onHoverItem={handleLegendHover} />
      <VChart ref={chartInstance} spec={spec} />
    </div>
  );
}
```

关键点在于通过`ref`获取到 vchart 实例，调用[`updateState`API](../../../api/API/vchart) 更新自定义状态对应的的 filter；

## 总结

通过本教程，你应该已经学会了如何在 Openinula 项目中使用 VChart 图表创建一个简单的柱状图。同时，你还了解了如何根据需求配置图表，以满足项目中不同的场景。VChart 提供了丰富的配置选项和组件，相信你在实际项目中会更好地掌握它们的使用，并发挥出更大的作用。希望你能在项目中愉快地使用 VChart 表库！
