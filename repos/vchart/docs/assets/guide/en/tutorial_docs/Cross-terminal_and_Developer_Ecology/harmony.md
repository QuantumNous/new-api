# Harmony VChart

- Repository: [https://github.com/VisActor/VChart/tree/main/packages/harmony-vchart](https://github.com/VisActor/VChart/tree/main/packages/harmony-vchart)

HarmonyOS is an intelligent terminal operating system developed by Huawei, using ArkTS as the main development language. Starting from version 1.11.1, VChart supports HarmonyOS-compatible chart development (supporting HarmonyOS API 9 and above).

OpenHarmony is an open-source project incubated and operated by the OpenAtom Foundation, aiming to build a framework and platform for intelligent terminal device operating systems based on open source methods, to promote the prosperity of the Internet of Everything industry. VChart also supports chart development for OpenHarmony application development (supporting API 10 Release and above).

To facilitate Harmony technology stack students to better use it, we provide the HarmonyOS package `@visactor/harmony-vchart` for VChart (this package is not an NPM package, but an OHPM package). The spec configuration options of this component are consistent with VChart, and its usage in HarmonyOS and OpenHarmony application development environments is consistent.

In this tutorial, we will explain in detail how to use VChart in a Harmony project and create a simple bar chart.

## Demo

<div style="text-align: center;">
  <img style="width: 160px; height: 360px;" crossorigin="anonymous" src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/harmony-vchart-example-dualaxis.png" alt="Harmony VChart Example">
  <img style="width: 160px; height: 360px;" crossorigin="anonymous" src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/harmony-vchart-example-funnel.png" alt="Harmony VChart Example">
  <img style="width: 160px; height: 360px;" crossorigin="anonymous" src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/harmony-vchart-example-scatter.png" alt="Harmony VChart Example">
  <img style="width: 160px; height: 360px;" crossorigin="anonymous" src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/harmony-vchart-example-area.png" alt="Harmony VChart Example">
  <img style="width: 160px; height: 360px;" crossorigin="anonymous" src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/harmony-vchart-example-ring.png" alt="Harmony VChart Example">
  <img style="width: 160px; height: 360px;" crossorigin="anonymous" src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/harmony-vchart-example-rose.png" alt="Harmony VChart Example">
  <img style="width: 160px; height: 360px;" crossorigin="anonymous" src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/harmony-vchart-example-sankey.png" alt="Harmony VChart Example">
  <img style="width: 160px; height: 360px;" crossorigin="anonymous" src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/harmony-vchart-example-wordcloud.png" alt="Harmony VChart Example">
  <img crossorigin="anonymous" src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/harmony-vchart-demo-low-quality.gif" alt="Harmony VChart Example">
</div>

## Quick Start

This article assumes that the user is already familiar with and knows how to use HarmonyOS. For specific knowledge about HarmonyOS, please refer to the [HarmonyOS Developer Platform](https://developer.huawei.com/consumer/cn/).

### Installation

To start using Harmony VChart, you first need to install the `@visactor/harmony-vchart` package in your Harmony project. In the project root directory, use the following command to install the package:

```
ohpm install @visactor/harmony-vchart
```

### Create a Chart

Taking creating a simple bar chart as an example. In your Harmony component, import the `<BarChart>` component from `visactor/harmony-vchart` and use it in the component. Here is an example code for creating a bar chart:

```typescript
import { VChart } from '@visactor/harmony-vchart';

const spec = '{"type":"bar","data":[{"id":"barData","values":[{"month":"Monday","sales":22},{"month":"Tuesday","sales":13},{"month":"Wednesday","sales":25},{"month":"Thursday","sales":29},{"month":"Friday","sales":38}]}],"xField":"month","yField":"sales","crosshair":{"xField":{"visible":true}}}'

@Entry
@Component
struct Index {
  @State message: string = 'Hello World';
  @State spec: Object | null = null;

  onPageShow(): void {
    this.spec = JSON.parse(spec);
  }

  build() {
    Row() {
      Column() {
        Text(this.message)
          .fontSize(50)
          .fontWeight(FontWeight.Bold)
        VChart({
          spec: this.spec, w: 300, h: 300,
          onChartInitCb: () => {},
          onChartReadyCb: () => {}
        })
      }
      .width('100%')
    }
    .height('100%')
  }
}
```

In this example, we created a simple bar chart using some basic components and configurations.

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/350c0511133d336e622523213.png" alt="Bar Chart Example">
</div>

## Unified Chart Tag `<VChart />`

The `<VChart />` tag accepts a complete **spec** as the chart definition, and its **spec** data structure is exactly the same as the definition in VChart. Therefore, developers can input any legal spec for VChart into Harmony-VChart for chart rendering.

### Props

If you already have a spec chart description, using the unified chart tag is a faster way. Simply import the `VChart` component:

```typescript
import { VChart } from '@visactor/harmony-vchart';
```

The `VChart` component is a Harmony component wrapper, and its props are defined as follows:

```typescript
interface VChartProps extends EventsProps {
  /** Chart definition */
  spec: any;
  /** Chart configuration */
  options?: IInitOption;
  /**
   * Chart initialization callback
   * @param vchart
   */
  onChartInitCb?: (vchart: VChartConstructor) => void;
  /**
   * Chart ready callback (first rendering completed)
   * @param vchart
   */
  onChartReadyCb?: (vchart: VChartConstructor) => void;
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
}
```

```typescript
export interface IInitOption {
  /**
   * Callback when the chart starts rendering
   * @param vchart
   */
  beforeRender?: (stage: Object) => void;
  /**
   * Callback after rendering is completed
   * @param vchart
   */
  afterRender?: (stage: Object) => void;
  /**
   * Enabled plugin list
   */
  pluginList?: string[];
  /** Data set */
  dataSet?: Object;
  /**
   * Whether to enable animation
   */
  animation?: boolean;
  /**
   * When text is omitted, whether to show poptip when hovering over the text
   * @default true
   */
  poptip?: boolean;

  /**
   * Error callback function
   * @since 1.2.0
   */
  onError?: () => void;

  /**
   * Default theme (supports complete theme objects or theme names, theme names need to be registered in `ThemeManager` in advance)
   * @since 1.3.0
   */
  theme?: string;
}
```

The definition of `EventsProps` refers to the event interaction section.

`onReady` is a built-in callback event that triggers when the chart is rendered or updated, with parameters representing the chart instance object and whether it is the first rendering.

For example, developers can register the callback events that need to be triggered on the chart instance during the first rendering to implement chart interaction features.

## Load on Demand `<VChartSimple />`

> Note that the current Harmony IDE does not support code tree-shaking, so this import form can currently only be used as an experimental solution.

In general, as a mobile application, package size does not greatly affect the business, but in some scenarios (such as meta-services), there are strict requirements on package size. Therefore, we provide a way to load on demand using the `VChartSimple` tag. Its usage is similar to `VChart`, but requires calling additional registration functions to register the required components.

### Register Components
When using the `VChartSimple` tag, you need to register the required components and charts first (we have built-in basic functions for scatter charts, line charts, and pie charts, other functions need to be registered on demand). The functions that can be called are as follows:
```ts
import {
  // Charts
  registerScatterChart,
  registerRoseChart,
  registerRadarChart,
  registerHistogramChart,
  registerMapChart,
  registerGaugeChart,
  registerWordCloudChart,
  registerFunnelChart,
  registerWaterfallChart,
  registerBoxplotChart,
  registerCircularProgressChart,
  registerLinearProgressChart,
  registerRangeColumnChart,
  registerRangeAreaChart,
  registerSunburstChart,
  registerCirclePackingChart,
  registerTreemapChart,
  registerSankeyChart,
  registerHeatmapChart,
  registerCorrelationChart,
  // Register Components
  registerCartesianTimeAxis,
  registerCartesianLogAxis,
  registerCartesianSymlogAxis,
  registerPolarBandAxis,
  registerPolarLinearAxis,

  registerContinuousLegend,

  registerPolarCrossHair,

  registerDataZoom,
  registerScrollBar,
  registerIndicator,
  registerGeoCoordinate,

  registerMarkLine,
  registerMarkArea,
  registerMarkPoint,
  registerPolarMarkLine,
  registerPolarMarkArea,
  registerPolarMarkPoint,
  registerGeoMarkPoint,

  registerTitle,
  registerPlayer,
  registerTotalLabel,
  registerBrush,
  registerCustomMark,
  registerMapLabel,
  registerPoptip,

// Register Layout
  registerGridLayout,

// vgrammar interactions,
  registerElementHighlight,
  registerElementSelect,
  // Register Animation
  registerAnimate
} from '@visactor/harmony-vchart';
```
### Demo

```ts
import { VChartSimple, registerScatterChart, registerAnimate } from '@visactor/harmony-vchart';
import { router } from '@kit.ArkUI';
import promptAction from '@ohos.promptAction';

interface IRouterParams {
  label: string,
  spec: Object
}

const params: IRouterParams = router.getParams() as IRouterParams;

@Entry
@Component
struct Chart {
  @State spec: Object | null = null;
  private t: number = 0;
  @State delta: number = 0;

  onPageShow(): void {
    registerScatterChart();
    registerAnimate();
    this.spec = params.spec;
  }

  build() {
    Row() {
      Column() {
        Text($r(`app.string.name_${params.label}`))
          .fontSize(50)
          .fontWeight(FontWeight.Bold)
        // Stage({ bg: 'red', h: 500 })
        VChartSimple({
          spec: this.spec, w: 300, h: 300,
          onChartInitCb: () => {},
          onChartReadyCb: () => {},
          initOption: {
            beforeRender: () => {
              this.t = Date.now();
            },
            afterRender: () => {
              this.delta = Date.now() - this.t;
            }
          }
        });
        Text(`Frame Time: ${this.delta}`)
        // VisActor()
      }
      .width('100%')
    }
    .height('100%')
  }
}

```

## Event Interaction

### Basic Events

The unified chart tag (`VChart`) or syntax-based chart tag (`BarChart`, etc.) outermost chart component supports the scene tree events thrown by the underlying rendering layer through the `EventsProps`.

The definition of `EventsProps` is as follows:

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

## Summary

Through this tutorial, you should have learned how to use VChart in a Harmony project to create a simple bar chart. Additionally, you have learned how to configure the chart according to requirements to meet different scenarios in the project. VChart provides rich configuration options and components, and I believe you will better grasp their usage in actual projects and unleash their full potential. I hope you enjoy using the VChart library in your projects!

## 🔗 Related Links

- [Homepage](https://www.visactor.io/vchart)
- [VCharts Gallery](https://www.visactor.io/vchart/example)
- [VChart Tutorials](https://www.visactor.io/vchart/guide/tutorial_docs/VChart_Website_Guide)
- [VChart Options](https://www.visactor.io/vchart/option/)
- [VChart API](https://www.visactor.io/vchart/api/API/vchart)
- [VGrammar](https://www.visactor.io/vgrammar)
- [VRender](https://www.visactor.io/vrender)
- [FAQ](https://www.visactor.io/vchart/guide/tutorial_docs/FAQ)
- [CodeSandbox Template](https://codesandbox.io/s/the-template-of-visactor-vchart-vl84ww?file=/src/index.ts) for bug reports
