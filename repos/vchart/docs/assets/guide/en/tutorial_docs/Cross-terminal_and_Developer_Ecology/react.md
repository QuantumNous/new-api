# React VChart

- Repository Address: [https://github.com/VisActor/VChart/tree/main/packages/react-vchart](https://github.com/VisActor/VChart/tree/main/packages/react-vchart)

To make it easier for React users to use VChart, we provide a React wrapper package for VChart: `@visactor/react-vchart`. This component mainly encapsulates VChart's chart components as React components, and its configuration items are consistent with VChart.

In this tutorial, we will explain in detail how to use VChart in a React project and create a simple bar chart. For more detailed API documentation, please refer to the [`@visactor/react-chart`](https://github.com/VisActor/VChart/blob/main/packages/react-vchart/docs/2.1%20API%E8%AE%BE%E8%AE%A1.md) repository documentation.

## Quick Start

### How to Install

To start using React VChart, you'll first need to install the `@visactor/react-vchart` package in your React project. In the project root directory, use the following command to install the package:

```
npm install @visactor/react-vchart
```

or use yarn to install:

```
yarn add @visactor/react-vchart
```

### Creating a Chart

Let's take creating a simple bar chart as an example. In your React component, import the `<BarChart>` component from `visactor/react-vchart` and use them in the component. Here's an example code to create a bar chart:

```javascript
import React, { useRef } from 'react';
import { BarChart, Bar, Legend, Axis } from '@visactor/react-vchart';

const App = () => {
  const chartRef = useRef(null);
  const handleChartClick = () => {
    console.log('Chart clicked');
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

In this example, we created a simple bar chart with some basic components and configurations.

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/350c0511133d336e622523213.png" alt="Bar chart example">
</div>

## Component Selection

To accommodate different user scenarios and usage habits, VChart offers two label styles:

- `<VChart />`: A large and unified entry label that encapsulates the chart specifications, provides updates and unloads for the specifications. Suitable for toB pages, product pages with page-building elements, and business users who encapsulate VChart themselves.
- `<BarChart />`, `<LineChart />`, `<CommonChart />`, and other syntax labels: Suitable for simple pages, written by developers. Convenient for implementing on-demand loading of packages.

The above bar chart example uses the syntax label `<BarChart />`, and you can choose the appropriate label style according to your needs. Next, we'll introduce how to adjust the chart according to your requirements.

## Chart Configuration and Optimization

After creating a simple bar chart, you may need to make some adjustments based on the requirements of the project. VChart provides a wealth of configuration options to meet different scenarios.

- Chart style: You can set the style of the bar chart by configuring the `style` in the `bar` attribute. For example, changing the color, stroke, width, etc., of the bar.
- Custom legend: By setting the `visible`, `position`, `orient`, and other attributes of the `<Legend>` component, you can customize the display and position of the legend.
- Adjust the axis: In the `<Axis>` component, you can set properties such as `orient`, `type` to adjust the display of the axis, or modify the `label` attribute to adjust the display of labels on the axis.

Here is a modified bar chart according to the requirements:

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

By adjusting the configuration, we have created a bar chart that is more suitable for use in actual projects.

## Unified Chart Component `<VChart />`

`<VChart />` receives a complete **spec** as the chart definition. The data structure of its **spec** is exactly the same as the definition in VChart, so developers can input any valid VChart spec into React-VChart for chart rendering.

### Props

If you already have chart spec information, using the unified chart component is a quick way. Simply import the `VChart` component:

```typescript
import { VChart } from '@visactor/react-vchart';
```

The `VChart` component is a encapsulated React component, and its props are defined as follows:

```typescript
interface VChartProps extends EventsProps {
  /** Chart definition */
  spec: any;
  /** Chart configuration */
  options?: ChartOptions;
  /** Chart rendering completion event */
  onReady?: (instance: VChart, isInitial: boolean) => void;
  /** throw error when chart run into an error */
  onError?: (err: Error) => void;
  /**
   * Switch to synchronous rendering
   *
   * @since 1.8.3
   **/
  useSyncRender?: boolean;
  /**
   * When props are updated, skip all function checks, i.e., all functions are considered not updated
   *
   * @since 1.6.5
   **/
  skipFunctionDiff?: boolean;
  /**
   * The animation configuration for chart updates, with morph animations disabled by default. The default values are:
   * {
   *   morph: false,
   *   enableExitAnimation: false
   * }
   * @since 1.12.7
   */

  morphConfig?: IVChartRenderOption['morphConfig'];
}
```

The definition of `EventsProps` refers to the event interaction section.

`onReady` is a built-in callback event that is triggered when the chart is rendered or updated. Its parameters represent the chart instance object and whether it is the initial rendering.

For example, developers can register the required callback events on the chart instance during the initial rendering to implement chart interaction functionality.

## Syntactic Tags

Syntactic tags refer to React-VChart encapsulating the chart container and various components as React components exported to developers. Developers can define charts in a more semantic and native React-like way. It should be noted that the definition content of syntactic tags can be mutually converted with chart spec in most scenarios. The main content of this article also explains the relationship between syntactic tags and spec.

### Tag Classification

Currently, React-VChart exports three types of component tags: chart tags, component tags, and series tags.

#### Chart Tags

Tags for chart types, including the following:

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
} from '@visactor/react-vchart';
```

In general, using these tags directly determines the type of chart. Among them, CommonChart is a special type of chart tag, which can be used to implement combined charts, dual-axis charts, and other types of charts. For more information on combined charts, please refer to: [Combination Chart](../Chart_Types/Combination.md)

The Props definition of these chart tags is as follows:

```typescript
interface ChartComponent extends EventsProps {
  /** Data */
  data?: IData;
  /** Canvas width */
  width?: number;
  /** Canvas height */
  height?: number;
  /** Chart configuration */
  options?: ChartOptions;
  /** Chart rendering completion event */
  onReady?: (instance: VChart, isInitial: boolean) => void;
}
```

Refer to the event interaction section for the definition of `EventsProps`

`onReady` is a built-in callback event that is triggered when the chart is rendered or updated. Its parameters represent the chart instance object and whether it is the initial rendering.

#### Component Tags

Component tags refer to the visual components inside the VChart, including the following:

```typescript
import {
  Axis,
  Legend,
  Brush,
  Crosshair,
  DataZoom,
  Indicator,
  MarkArea,
  MarkLine,
  MarkPoint,
  Player,
  ScrollBar,
  Title,
  Tooltip,
  Mark,
  Region
} from '@visactor/react-vchart';
```

These components do not actually exist in the DOM structure. This notation is just to clearly show the structure of the chart. The configuration of these components completely aligns with the definition of the corresponding components in VChart. The difference is that the original data structure definition can now be used as props parameters for configuration.

#### Series Components

Series components refer to the components defined for the element series corresponding to the chart type. If the type of the chart component is specified, the series components corresponding to it should be used for defining the elements. The series components include the following:

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
} from '@visactor/react-vchart';
```

### Usage of Syntactic Tags

First, it is important to clarify the basic principles of syntactic tag prop definitions: the props of syntactic tags are essentially equivalent to the API definitions of corresponding components in the spec. In addition, more callback entry points have been added to syntactic tags to facilitate event mounting.

For example, consider the following spec definition for a line chart:

```javascript
{
  type: 'line',
  data: [
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
  ],
  xField: 'State',
  yField: '人口数量',
  seriesField: '年龄段',
  legends: {
    visible: true,
    orient: 'top'
  },
  axes: [
    {
      type: 'band',
      orient: 'bottom',
    },
    {
      type: 'linear',
      orient: 'left',
      label: {
        style: {
          fill: '#aaa',
          fontSize: 14
        }
      }
    }
  ]
}
```

The corresponding syntactic tag definition is as follows:

```typescript
import React from 'react';
import { LineChart, Line, Axis, Legend } from '@visactor/react-vchart';

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

### Components not covered by syntactic tags

If there are components not covered by syntactic tags when using React-VChart, you can use the unified chart component as a fallback solution.

## On-demand loading

React-VChart inherently supports on-demand loading. There are two ways to achieve on-demand loading with VChart:

- Use the `<VChartSimple />` tag to implement custom on-demand loading.

The `<VChartSimple />` component and the `<VChart />` component are almost identical in usage. The only difference is that users need to import the `VChart` constructor class from `@viasctor/vchart` and pass it to `<VChartSimple />`.

```typescript
interface VChartSimpleProps extends EventsProps {
  /** the spec of chart */
  spec: any;
  /** the options of chart */
  options?: ChartOptions;
  /** call when the chart is rendered */
  onReady?: (instance: VChart, isInitial: boolean) => void;
  /** throw error when chart run into an error */
  onError?: (err: Error) => void;
  /**
   * use renderSync
   *
   * @since 1.8.3
   **/
  useSyncRender?: boolean;
  /**
   * skip the difference of all functions
   *
   * @since 1.6.5
   **/
  skipFunctionDiff?: boolean;
  /**
   * the constrouctor class of vchart
   *
   * @since 1.8.3
   **/
  vchartConstructor: IVChartConstructor;
}
```

- Use semantic tags, from version **1.11.0**, all semantic tags support on-demand loading by default, with the default registered components for each type of chart as follows:

| Chart                      | Category         | Additional Registered Components      |
| -------------------------- | ---------------- | ------------------------------------- |
| `<LineChart/>`             | Cartesian Charts | `registerLabel`                       |
| `<AreaChart/>`             | Cartesian Charts | `registerLabel`, `registerTotalLabel` |
| `<BarChart/>`              | Cartesian Charts | `registerLabel`, `registerTotalLabel` |
| `<Bar3dChart/>`            | Cartesian Charts | `registerLabel`, `registerTotalLabel` |
| `<BoxPlotChart/>`          | Cartesian Charts | `registerLabel`,                      |
| `<HeatmapChart/>`          | Cartesian Charts | `registerLabel`                       |
| `<Histogram3dChart/>`      | Cartesian Charts | `registerLabel`                       |
| `<HistogramChart/>`        | Cartesian Charts | `registerLabel`                       |
| `<LinearProgressChart/>`   | Cartesian Charts | `registerLabel`                       |
| `<RangeColumnChart/>`      | Cartesian Charts | `registerLabel`                       |
| `<RangeColumn3dChart/>`    | Cartesian Charts | `registerLabel`                       |
| `<ScatterChart/>`          | Cartesian Charts | `registerLabel`                       |
| `<SequenceChart/>`         | Cartesian Charts | `registerLabel`                       |
| `<WaterfallChart/>`        | Cartesian Charts | `registerLabel`, `registerTotalLabel` |
| `<RadarChart/>`            | Polar Charts     | `registerLabel`                       |
| `<RoseChart/>`             | Polar Charts     | `registerLabel`                       |
| `<CircularProgressChart/>` | Polar Charts     | `registerLabel`, `registerIndicator`  |
| `<Pie3dChart/>`            | General Charts   | `registerLabel`, `registerIndicator`  |
| `<PieChart/>`              | General Charts   | `registerLabel`, `registerIndicator`  |
| `<CirclePackingChart/>`    | General Charts   | None                                  |
| `<FunnelChart/>`           | General Charts   | `registerLabel`                       |
| `<Funnel3dChart/>`         | General Charts   | `registerLabel`                       |
| `<GaugeChart/>`            | General Charts   | None                                  |
| `<MapChart/>`              | General Charts   | `registerLabel`                       |
| `<SankeyChart/>`           | General Charts   | None                                  |
| `<SunburstChart/>`         | General Charts   | None                                  |
| `<TreemapChart/>`          | General Charts   | None                                  |
| `<VennChart/>`             | General Charts   | None                                  |
| `<WordCloud3dChart/>`      | General Charts   | None                                  |
| `<WordCloudChart/>`        | General Charts   | None                                  |
| `<LiquidChart/>`           | General Charts   | `registerIndicator`                   |

For Cartesian charts, the default registered components are as follows:

- `registerCartesianLinearAxis`
- `registerCartesianBandAxis`
- `registerCartesianTimeAxis`
- `registerCartesianLogAxis`
- `registerCartesianCrossHair`
- `registerBrush`
- `registerContinuousLegend`
- `registerDataZoom`
- `registerDiscreteLegend`
- `registerCustomMark`
- `registerAllMarks`
- `registerMarkArea`
- `registerMarkLine`
- `registerMarkPoint`
- `registerScrollBar`
- `registerTitle`
- `registerTooltip`
- `registerDomTooltipHandler`

For Polar charts, the default registered components are as follows:

- `registerPolarLinearAxis`
- `registerPolarBandAxis`
- `registerPolarCrossHair`
- `registerBrush`
- `registerContinuousLegend`
- `registerDataZoom`
- `registerDiscreteLegend`
- `registerCustomMark`
- `registerAllMarks`
- `registerScrollBar`
- `registerTitle`
- `registerTooltip`
- `registerDomTooltipHandler`

For General charts, the default registered components are as follows:

- `registerDiscreteLegend`
- `registerContinuousLegend`
- `registerCustomMark`
- `registerAllMarks`
- `registerTitle`
- `registerTooltip`
- `registerDomTooltipHandler`

When using semantic tags, if you need components that are not loaded by default, you only need to register the missing components.

For reference on on-demand loading of VChart, see [related documentation](/vchart/guide/tutorial_docs/Load_on_Demand).

## Event Interaction

### Basic Events

Both the unified chart tag (VChart) and the syntactic chart tags (BarChart, etc.) support the scene tree events thrown by the underlying rendering layer on their Props.

The definition of `EventsProps` is as follows:

```typescript
export interface EventsProps {
  onPointerDown?: EventCallback<EventParamsDefinition['pointerdown']>;
  onPointerUp?: EventCallback<EventParamsDefinition['pointerup']>;
  onPointerUpOutside?: EventCallback<EventParamsDefinition['pointerupoutside']>;
  onPointerTap?: EventCallback<EventParamsDefinition['pointertap']>;
  onPointerOver?: EventCallback<EventParamsDefinition['pointerover']>;
  onPointerMove?: EventCallback<EventParamsDefinition['pointermove']>;
  onPointerEnter?: EventCallback<EventParamsDefinition['pointerenter']>;
  onPointerLeave?: EventCallback<EventParamsDefinition['pointerleave']>;
  onPointerOut?: EventCallback<EventParamsDefinition['pointerout']>;
  onMouseDown?: EventCallback<EventParamsDefinition['mousedown']>;
  onMouseUp?: EventCallback<EventParamsDefinition['mouseup']>;
  onMouseUpOutside?: EventCallback<EventParamsDefinition['mouseupoutside']>;
  onMouseMove?: EventCallback<EventParamsDefinition['mousemove']>;
  onMouseOver?: EventCallback<EventParamsDefinition['mouseover']>;
  onMouseOut?: EventCallback<EventParamsDefinition['mouseout']>;
  onMouseEnter?: EventCallback<EventParamsDefinition['mouseenter']>;
  onMouseLeave?: EventCallback<EventParamsDefinition['mouseleave']>;
  onPinch?: EventCallback<EventParamsDefinition['pinch']>;
  onPinchStart?: EventCallback<EventParamsDefinition['pinchstart']>;
  onPinchEnd?: EventCallback<EventParamsDefinition['pinchend']>;
  onPan?: EventCallback<EventParamsDefinition['pan']>;
  onPanStart?: EventCallback<EventParamsDefinition['panstart']>;
  onPanEnd?: EventCallback<EventParamsDefinition['panend']>;
  onDrag?: EventCallback<EventParamsDefinition['drag']>;
  onDragStart?: EventCallback<EventParamsDefinition['dragstart']>;
  onDragEnter?: EventCallback<EventParamsDefinition['dragenter']>;
  onDragLeave?: EventCallback<EventParamsDefinition['dragleave']>;
  onDragOver?: EventCallback<EventParamsDefinition['dragover']>;
  onDragEnd?: EventCallback<EventParamsDefinition['dragend']>;
  onRightDown?: EventCallback<EventParamsDefinition['rightdown']>;
  onRightUp?: EventCallback<EventParamsDefinition['rightup']>;
  onRightUpOutside?: EventCallback<EventParamsDefinition['rightupoutside']>;
  onTouchStart?: EventCallback<EventParamsDefinition['touchstart']>;
  onTouchEnd?: EventCallback<EventParamsDefinition['touchend']>;
  onTouchEndOutside?: EventCallback<EventParamsDefinition['touchendoutside']>;
  onTouchMove?: EventCallback<EventParamsDefinition['touchmove']>;
  onTouchCancel?: EventCallback<EventParamsDefinition['touchcancel']>;
  onPress?: EventCallback<EventParamsDefinition['press']>;
  onPressUp?: EventCallback<EventParamsDefinition['pressup']>;
  onPressEnd?: EventCallback<EventParamsDefinition['pressend']>;
  onSwipe?: EventCallback<EventParamsDefinition['swipe']>;
  onDrop?: EventCallback<EventParamsDefinition['drop']>;
  onWeel?: EventCallback<EventParamsDefinition['weel']>;
  onClick?: EventCallback<EventParamsDefinition['click']>;
  onDblClick?: EventCallback<EventParamsDefinition['dblclick']>;
}
```

All basic events support event filters. For example, to add an event filter to `onClick`, you can pass the `props` as follows:

```typescript
<BarChart onClick={handleChartClick} onClickFilter={{ type: 'axis', level: 'model' }} />
```

The filters for other events are configured similarly. For more information about event filters, please refer to the [event documentation](/vchart/api/API/event).

### Component Tag Events

In addition to the scene tree events, the chart components also support custom events. Custom events can be listened to on semantic component tags, as well as on the outermost Chart component.

- `<Legend />` Custom Events

```typescript
interface LegendEventsProps {
  /** the hover event of legend item */
  onLegendItemHover?: (e: any) => void | boolean;
  /** the unhover event of legend item */
  onLegendItemUnHover?: (e: any) => void | boolean;
  /** the click event of legend item */
  onLegendItemClick?: (e: any) => void | boolean;
  onLegendFilter?: (e: any) => void | boolean;
  onLegendSelectedDataChange?: (e: any) => void | boolean;
}
```

- `<Brush />` Custom Events

```typescript
interface BrushEventsProps {
  /** call when a brush start */
  onBrushStart?: (e: any) => void | boolean;
  /** call when a brush change */
  onBrushChange?: (e: any) => void | boolean;
  /** call when a brush end */
  onBrushEnd?: (e: any) => void | boolean;
  /** call when a brush cleared */
  onBrushClear?: (e: any) => void | boolean;
}
```

- `<DataZoom />` Custom Events

```typescript
interface DataZoomEventsProps {
  /** DataZoom 更新事件 */
  onDataZoomChange?: (e: any) => void | boolean;
}
```

- `<Player />` Custom Events

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

- `<ScrollBar />` Custom Events

```typescript
interface ScrollBarEventsProps {
  onScrollBarChange?: (e: any) => void | boolean;
}
```

### Series Component Events

Series components (such as `Bar`, `Line`, etc.) also inherit the `EventsProps` events, for details please refer to the previous section.

### Other Events

In addition to the above events, the following events can also be listened to in the Chart

- Custom Dimension Events

```typescript
interface DimensionEventsProps {
  onDimensionHover?: (e: any) => void | boolean;
  onDimensionClick?: (e: any) => void | boolean;
}
```

- Hierarchy Chart Events

```typescript
interface HierarchyEventsProps {
  onDrill?: (e: any) => void | boolean;
}
```

- Lifecycle-related events

```typescript
interface LifeCycleEventsProps {
  onInitialized?: (e: any) => void | boolean;
  onRendered?: (e: any) => void | boolean;
  onRenderFinished?: (e: any) => void | boolean;
  onAnimationFinished?: (e: any) => void | boolean;
  onLayoutStart?: (e: any) => void | boolean;
  onLayoutEnd?: (e: any) => void | boolean;
}
```

### Event Usage Example - Chart Events & Component Events

```javascript livedemo template=react-vchart
const root = document.getElementById(CONTAINER_ID);
const { BarChart, Bar, Axis, Legend } = ReactVChart;
const { useState, useRef, useEffect, useCallback } = React;
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

const Card = () => {
  const handleChartClick = useCallback(ev => {
    console.log('图表被点击', ev);
  }, []);

  return (
    <div className="chart-containers">
      <BarChart data={barData} onClick={handleChartClick}>
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
    </div>
  );
};

ReactDom.createRoot(root).render(<Card />);

// release react instance, do not copy
window.customRelease = () => {
  ReactDom.unmountComponentAtNode(root);
};
```

### Event Usage Example - Chart Event Filtering

```javascript livedemo template=react-vchart
const root = document.getElementById(CONTAINER_ID);
const { BarChart, Bar, Axis, Legend } = ReactVChart;
const { useState, useRef, useEffect, useCallback } = React;
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

const Card = () => {
  const handleAxisClick = useCallback(ev => {
    console.log('坐标轴被点击', ev);
  }, []);

  return (
    <div className="chart-containers">
      <BarChart data={barData} onClick={handleAxisClick} onClickFilter={{ type: 'axis', level: 'model' }}>
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
    </div>
  );
};

ReactDom.createRoot(root).render(<Card />);

// release react instance, do not copy
window.customRelease = () => {
  ReactDom.unmountComponentAtNode(root);
};
```

## Theme Styles

If you want to use custom themes in VChart, there are two ways to achieve this: defining themes in the spec and registering themes through `ThemeManager`. Since you don't need to import the VChart npm package in React-VChart, the VChart base class is exposed as `VChartCore` in React-VChart, making it convenient for developers to register custom themes using static methods on the VChart base class.

Please refer to [VChart Theme](https://visactor.io/vchart/guide/tutorial_docs/Theme/Theme) for VChart theme configuration.

Note that for on-demand use of VChart, it is recommended to directly call the VChart API to use themes.

## Example

```tsx
import React from 'react';
import { VChartCore, BarChart, Bar, Axis, Legend } from '@visactor/react-vchart';

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

## typical scenarios

### customized legend component

When the built-in legend component of VChart cannot meet the business requirements, it is common in React projects to use custom legend components implemented with React components. In such cases, the updateState API can be used to establish event associations between React components and charts. You can refer to [the specific implementation example here](https://codesandbox.io/s/visactor-vchart-legend-demo-tdqmq3?file=/src/PieChart.tsx).

The core code is as follows:

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

The key point is to obtain the VChart instance through the `ref` and use the [`updateState` API](../../../api/API/vchart) to update the filter corresponding to the custom state.

## API

| Parameter                  | Description                                                                              | Type                                             | Default | Version |
| -------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------ | ------- | ------- |
| type                       | Chart type, only applicable to `<VChart />` and `<VChartSimple />`                       | `string`                                         | None    |         |
| spec                       | Chart spec configuration, same as [vchart options](/vchart/option/)                      | `ISpec`                                          | None    |         |
| data                       | Chart data                                                                               | `IData` \| `IHierarchyData`                      | None    |         |
| width                      | Canvas width                                                                             | `number`                                         | None    |         |
| height                     | Canvas height                                                                            | `number`                                         | None    |         |
| options                    | Chart options, refer to [vchart API documentation](/vchart/api/API/vchart)               | `Omit<IInitOption, 'dom'>`                       | None    |         |
| skipFunctionDiff           | Skip all function checks when props update, i.e., all functions are considered unchanged | `boolean`                                        | false   | 1.6.5   |
| morphConfig                | Morph configuration                                                                      | `IMorphConfig`                                   | None    | 1.12.7  |
| onReady                    | Chart rendering completion event                                                         | `(instance: VChart, isInitial: boolean) => void` | None    |         |
| onError                    | Error callback when the chart encounters an error                                        | `(err: Error) => void`                           | None    |         |
| onLegendItemHover          | Legend item hover event                                                                  | `(e: any) => void`                               | None    |         |
| onLegendItemUnHover        | Legend item unhover event                                                                | `(e: any) => void`                               | None    |         |
| onLegendItemClick          | Legend item click event                                                                  | `(e: any) => void`                               | None    |         |
| onLegendFilter             | Legend item filter event                                                                 | `(e: any) => void`                               | None    |         |
| onLegendSelectedDataChange | Legend selected data change event                                                        | `(e: any) => void`                               | None    |         |
| onBrushStart               | Brush start event                                                                        | `(e: any) => void`                               | None    |         |
| onBrushChange              | Brush update event                                                                       | `(e: any) => void`                               | None    |         |
| onBrushEnd                 | Brush end event                                                                          | `(e: any) => void`                               | None    |         |
| onDataZoomChange           | DataZoom update event                                                                    | `(e: any) => void`                               | None    |         |
| onPlayerPlay               | Player play event                                                                        | `(e: any) => void`                               | None    |         |
| onPlayerPause              | Player pause event                                                                       | `(e: any) => void`                               | None    |         |
| onPlayerEnd                | Player end event                                                                         | `(e: any) => void`                               | None    |         |
| onPlayerChange             | Player change event                                                                      | `(e: any) => void`                               | None    |         |
| onPlayerForward            | Player forward event                                                                     | `(e: any) => void`                               | None    |         |
| onPlayerBackward           | Player backward event                                                                    | `(e: any) => void`                               | None    |         |
| onScrollBarChange          | ScrollBar update event                                                                   | `(e: any) => void`                               | None    |         |
| onDimensionHover           | Dimension hover event                                                                    | `(e: any) => void`                               | None    |         |
| onDimensionClick           | Dimension click event                                                                    | `(e: any) => void`                               | None    |         |
| onDrill                    | Hierarchical chart event                                                                 | `(e: any) => void`                               | None    | 1.12.7  |
| onInitialized              | Initialization completion event                                                          | `(e: any) => void`                               | None    |         |
| onRendered                 | Rendering completion event                                                               | `(e: any) => void`                               | None    |         |
| onRenderFinished           | Render finished event                                                                    | `(e: any) => void`                               | None    |         |
| onAnimationFinished        | Animation finished event                                                                 | `(e: any) => void`                               | None    |         |
| onLayoutStart              | Layout start event                                                                       | `(e: any) => void`                               | None    |         |
| onLayoutEnd                | Layout end event                                                                         | `(e: any) => void`                               | None    |         |
| onPointerDown              | PointerDown event                                                                        | `(e: any) => boolean \| void;`                   | None    |         |
| onPointerUp                | PointerUp event                                                                          | `(e: any) => boolean \| void;`                   | None    |         |
| onPointerUpOutside         | PointerUpOutside event                                                                   | `(e: any) => boolean \| void;`                   | None    |         |
| onPointerTap               | PointerTap event                                                                         | `(e: any) => boolean \| void;`                   | None    |         |
| onPointerOver              | PointerOver event                                                                        | `(e: any) => boolean \| void;`                   | None    |         |
| onPointerMove              | PointerMove event                                                                        | `(e: any) => boolean \| void;`                   | None    |         |
| onPointerEnter             | PointerEnter event                                                                       | `(e: any) => boolean \| void;`                   | None    |         |
| onPointerLeave             | PointerLeave event                                                                       | `(e: any) => boolean \| void;`                   | None    |         |
| onPointerOut               | PointerOut event                                                                         | `(e: any) => boolean \| void;`                   | None    |         |
| onMouseDown                | MouseDown event                                                                          | `(e: any) => boolean \| void;`                   | None    |         |
| onMouseUp                  | MouseUp event                                                                            | `(e: any) => boolean \| void;`                   | None    |         |
| onMouseUpOutside           | MouseUpOutside event                                                                     | `(e: any) => boolean \| void;`                   | None    |         |
| onMouseMove                | MouseMove event                                                                          | `(e: any) => boolean \| void;`                   | None    |         |
| onMouseOver                | MouseOver event                                                                          | `(e: any) => boolean \| void;`                   | None    |         |
| onMouseOut                 | MouseOut event                                                                           | `(e: any) => boolean \| void;`                   | None    |         |
| onMouseEnter               | MouseEnter event                                                                         | `(e: any) => boolean \| void;`                   | None    |         |
| onMouseLeave               | MouseLeave event                                                                         | `(e: any) => boolean \| void;`                   | None    |         |
| onPinch                    | Pinch event                                                                              | `(e: any) => boolean \| void;`                   | None    |         |
| onPinchStart               | PinchStart event                                                                         | `(e: any) => boolean \| void;`                   | None    |         |
| onPinchEnd                 | PinchEnd event                                                                           | `(e: any) => boolean \| void;`                   | None    |         |
| onPan                      | Pan event                                                                                | `(e: any) => boolean \| void;`                   | None    |         |
| onPanStart                 | PanStart event                                                                           | `(e: any) => boolean \| void;`                   | None    |         |
| onPanEnd                   | PanEnd event                                                                             | `(e: any) => boolean \| void;`                   | None    |         |
| onDrag                     | Drag event                                                                               | `(e: any) => boolean \| void;`                   | None    |         |
| onDragStart                | DragStart event                                                                          | `(e: any) => boolean \| void;`                   | None    |         |
| onDragEnter                | DragEnter event                                                                          | `(e: any) => boolean \| void;`                   | None    |         |
| onDragLeave                | DragLeave event                                                                          | `(e: any) => boolean \| void;`                   | None    |         |
| onDragOver                 | DragOver event                                                                           | `(e: any) => boolean \| void;`                   | None    |         |
| onDragEnd                  | DragEnd event                                                                            | `(e: any) => boolean \| void;`                   | None    |         |
| onRightDown                | RightDown event                                                                          | `(e: any) => boolean \| void;`                   | None    |         |
| onRightUp                  | RightUp event                                                                            | `(e: any) => boolean \| void;`                   | None    |         |
| onRightUpOutside           | RightUpOutside event                                                                     | `(e: any) => boolean \| void;`                   | None    |         |
| onTouchStart               | TouchStart event                                                                         | `(e: any) => boolean \| void;`                   | None    |         |
| onTouchEnd                 | TouchEnd event                                                                           | `(e: any) => boolean \| void;`                   | None    |         |
| onTouchEndOutside          | TouchEndOutside event                                                                    | `(e: any) => boolean \| void;`                   | None    |         |
| onTouchMove                | TouchMove event                                                                          | `(e: any) => boolean \| void;`                   | None    |         |
| onTouchCancel              | TouchCancel event                                                                        | `(e: any) => boolean \| void;`                   | None    |         |
| onPress                    | Press event                                                                              | `(e: any) => boolean \| void;`                   | None    |         |
| onPressUp                  | PressUp event                                                                            | `(e: any) => boolean \| void;`                   | None    |         |
| onPressEnd                 | PressEnd event                                                                           | `(e: any) => boolean \| void;`                   | None    |         |
| onSwipe                    | Swipe event                                                                              | `(e: any) => boolean \| void;`                   | None    |         |
| onDrop                     | Drop event                                                                               | `(e: any) => boolean \| void;`                   | None    |         |
| onWeel                     | Weel event                                                                               | `(e: any) => boolean \| void;`                   | None    |         |
| onClick                    | Click event                                                                              | `(e: any) => boolean \| void;`                   | None    |         |
| onDblClick                 | DblClick event                                                                           | `(e: any) => boolean \| void;`                   | None    |         |
| onPointerDownFilter        | PointerDown event filter, refer to [Event API documentation](/vchart/api/API/event)      | `EventFilter`                                    | None    |         |
| onPointerUpFilter          | PointerUp event filter, refer to [Event API documentation](/vchart/api/API/event)        | `EventFilter`                                    | None    |         |
| onPointerUpOutsideFilter   | PointerUpOutside event filter, refer to [Event API documentation](/vchart/api/API/event) | `EventFilter`                                    | None    |         |
| onPointerTapFilter         | PointerTap event filter, refer to [Event API documentation](/vchart/api/API/event)       | `EventFilter`                                    | None    |         |
| onPointerOverFilter        | PointerOver event filter, refer to [Event API documentation](/vchart/api/API/event)      | `EventFilter`                                    | None    |         |
| onPointerMoveFilter        | PointerMove event filter, refer to [Event API documentation](/vchart/api/API/event)      | `EventFilter`                                    | None    |         |
| onPointerEnterFilter       | PointerEnter event filter, refer to [Event API documentation](/vchart/api/API/event)     | `EventFilter`                                    | None    |         |
| onPointerLeaveFilter       | PointerLeave event filter, refer to [Event API documentation](/vchart/api/API/event)     | `EventFilter`                                    | None    |         |
| onPointerOutFilter         | PointerOut event filter, refer to [Event API documentation](/vchart/api/API/event)       | `EventFilter`                                    | None    |         |
| onMouseDownFilter          | MouseDown event filter, refer to [Event API documentation](/vchart/api/API/event)        | `EventFilter`                                    | None    |         |
| onMouseUpFilter            | MouseUp event filter, refer to [Event API documentation](/vchart/api/API/event)          | `EventFilter`                                    | None    |         |
| onMouseUpOutsideFilter     | MouseUpOutside event filter, refer to [Event API documentation](/vchart/api/API/event)   | `EventFilter`                                    | None    |         |
| onMouseMoveFilter          | MouseMove event filter, refer to [Event API documentation](/vchart/api/API/event)        | `EventFilter`                                    | None    |         |
| onMouseOverFilter          | MouseOver event filter, refer to [Event API documentation](/vchart/api/API/event)        | `EventFilter`                                    | None    |         |
| onMouseOutFilter           | MouseOut event filter, refer to [Event API documentation](/vchart/api/API/event)         | `EventFilter`                                    | None    |         |
| onMouseEnterFilter         | MouseEnter event filter, refer to [Event API documentation](/vchart/api/API/event)       | `EventFilter`                                    | None    |         |
| onMouseLeaveFilter         | MouseLeave event filter, refer to [Event API documentation](/vchart/api/API/event)       | `EventFilter`                                    | None    |         |
| onPinchFilter              | Pinch event filter, refer to [Event API documentation](/vchart/api/API/event)            | `EventFilter`                                    | None    |         |
| onPinchStartFilter         | PinchStart event filter, refer to [Event API documentation](/vchart/api/API/event)       | `EventFilter`                                    | None    |         |
| onPinchEndFilter           | PinchEnd event filter, refer to [Event API documentation](/vchart/api/API/event)         | `EventFilter`                                    | None    |         |
| onPanFilter                | Pan event filter, refer to [Event API documentation](/vchart/api/API/event)              | `EventFilter`                                    | None    |         |
| onPanStartFilter           | PanStart event filter, refer to [Event API documentation](/vchart/api/API/event)         | `EventFilter`                                    | None    |         |
| onPanEndFilter             | PanEnd event filter, refer to [Event API documentation](/vchart/api/API/event)           | `EventFilter`                                    | None    |         |
| onDragFilter               | Drag event filter, refer to [Event API documentation](/vchart/api/API/event)             | `EventFilter`                                    | None    |         |
| onDragStartFilter          | DragStart event filter, refer to [Event API documentation](/vchart/api/API/event)        | `EventFilter`                                    | None    |         |
| onDragEnterFilter          | DragEnter event filter, refer to [Event API documentation](/vchart/api/API/event)        | `EventFilter`                                    | None    |         |
| onDragLeaveFilter          | DragLeave event filter, refer to [Event API documentation](/vchart/api/API/event)        | `EventFilter`                                    | None    |         |
| onDragOverFilter           | DragOver event filter, refer to [Event API documentation](/vchart/api/API/event)         | `EventFilter`                                    | None    |         |
| onDragEndFilter            | DragEnd event filter, refer to [Event API documentation](/vchart/api/API/event)          | `EventFilter`                                    | None    |         |
| onRightDownFilter          | RightDown event filter, refer to [Event API documentation](/vchart/api/API/event)        | `EventFilter`                                    | None    |         |
| onRightUpFilter            | RightUp event filter, refer to [Event API documentation](/vchart/api/API/event)          | `EventFilter`                                    | None    |         |
| onRightUpOutsideFilter     | RightUpOutside event filter, refer to [Event API documentation](/vchart/api/API/event)   | `EventFilter`                                    | None    |         |
| onTouchStartFilter         | TouchStart event filter, refer to [Event API documentation](/vchart/api/API/event)       | `EventFilter`                                    | None    |         |
| onTouchEndFilter           | TouchEnd event filter, refer to [Event API documentation](/vchart/api/API/event)         | `EventFilter`                                    | None    |         |
| onTouchEndOutsideFilter    | TouchEndOutside event filter, refer to [Event API documentation](/vchart/api/API/event)  | `EventFilter`                                    | None    |         |
| onTouchMoveFilter          | TouchMove event filter, refer to [Event API documentation](/vchart/api/API/event)        | `EventFilter`                                    | None    |         |
| onTouchCancelFilter        | TouchCancel event filter, refer to [Event API documentation](/vchart/api/API/event)      | `EventFilter`                                    | None    |         |
| onPressFilter              | Press event filter, refer to [Event API documentation](/vchart/api/API/event)            | `EventFilter`                                    | None    |         |
| onPressUpFilter            | PressUp event filter, refer to [Event API documentation](/vchart/api/API/event)          | `EventFilter`                                    | None    |         |
| onPressEndFilter           | PressEnd event filter, refer to [Event API documentation](/vchart/api/API/event)         | `EventFilter`                                    | None    |         |
| onSwipeFilter              | Swipe event filter, refer to [Event API documentation](/vchart/api/API/event)            | `EventFilter`                                    | None    |         |
| onDropFilter               | Drop event filter, refer to [Event API documentation](/vchart/api/API/event)             | `EventFilter`                                    | None    |         |
| onWeelFilter               | Weel event filter, refer to [Event API documentation](/vchart/api/API/event)             | `EventFilter`                                    | None    |         |
| onClickFilter              | Click event filter, refer to [Event API documentation](/vchart/api/API/event)            | `EventFilter`                                    | None    |         |
| onDblClickFilter           | DblClick event filter, refer to [Event API documentation](/vchart/api/API/event)         | `EventFilter`                                    | None    |         |

## Conclusion

Through this tutorial, you should have learned how to use VChart to create a simple bar chart in a React project. At the same time, you have learned how to configure the chart according to requirements to meet different scenarios in the project. VChart provides a wealth of options and components, which will undoubtedly play a more significant role in your actual projects. We hope you enjoy using the VChart chart library in your projects!
