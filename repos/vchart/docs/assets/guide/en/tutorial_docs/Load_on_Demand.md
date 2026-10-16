# VChart Load-on-Demand Tutorial

## Quick Start

`@visactor/vchart` provides all the charts and components of VChart by default. If you don't want to import all components, you can also import the relevant components as needed. Here is an example of how to use it:

```ts
// import VChart core module
import { VChart } from '@visactor/vchart';
// import bar chart
import { registerBarChart } from '@visactor/vchart';
// import tooltip, crosshair components
import { registerTooltip, registerDomTooltipHandler, registerCartesianCrossHair } from '@visactor/vchart';

// register chart and components
VChart.useRegisters([registerBarChart, registerTooltip, registerDomTooltipHandler, registerCartesianCrossHair]);
```

If the tree-shaking optimization of your bundle tool is turned off, you need to manually import the internal files from `@visactor/vchart/esm/xxx`, such as `@visactor/vchart/esm/core` or `@visactor/vchart/esm/component`, etc. The usage is as follows:

```ts
// Import the VChart core module
import { VChart } from '@visactor/vchart/esm/core';
// Import bar chart register
import { registerBarChart } from '@visactor/vchart/esm/chart';
// Import Tooltip, CrossHair components
import { registerTooltip, registerCartesianCrossHair } from '@visactor/vchart/esm/component';
// Import dom tooltip plugin
import { registerDomTooltipHandler } from '@visactor/vchart/esm/plugin';
// Import WeChat environment code
import { registerWXEnv } from '@visactor/vchart/esm/env';

// Register
VChart.useRegisters([
  registerBarChart,
  registerTooltip,
  registerCartesianCrossHair,
  registerDomTooltipHandler,
  registerWXEnv
]);
```

## How to Use

When you import VChart in the following way, you get an constructor that only contains the core logic.Which **does not include any charts, components, plugins, or environment compatibility**. Users need to manually import the relevant charts and components, and register them.

> `import { VChart } from '@visactor/vchart'`

The options for registration usually include:

- **Chart types**
- **Components**
- Plugins (media queries, formatting, etc.)
- Interactions (selection, hover, etc.)
- Environment compatibility (Lynx, WeChat Mini Program, Feishu Mini Program compatibility)

  Generally speaking, in addition to registering the chart type, it is also necessary to register the necessary components. For example, in a line chart, the axes (continuous and discrete) are indispensable. If they are not registered, the chart cannot be drawn.

This document will explain the rules for component import in as much detail as possible.

### How to import charts

VChart currently supports 20+ [chart types](/vchart/guide/tutorial_docs/Chart_Types/chart_types), which can be imported as follows:

> `import { registerBarChart } from '@visactor/vchart';`

#### How to import combination charts

A combination chart refers to a chart with type: 'common' in the chart configuration, usually using multiple data series and multiple visual elements, such as line series, bar series, area series, scatter series, pie series, etc., to present various types of data. It is most commonly used to draw dual-axis charts and bar-line combination charts. For a detailed introduction, please refer to the[Combination Chart Tutorial.](vchart/guide/tutorial_docs/Chart_Types/Combination)

When introducing as needed, you need to introduce the Common chart and register the series that will be used:

```ts
import { registerCommonChart, registerBarSeries, registerLineSeries } from '@visactor/vchart';

VChart.useRegisters([registerCommonChart, registerBarSeries, registerLineSeries]);
```

For a list of series register methods, please refer to Appendix I at the end of the document.

### How to import components

Users can understand the forms of various functional components in the chart through the related content of [Chart Concepts](/vchart/guide/tutorial_docs/Chart_Concepts/Understanding_VChart) in the tutorial documents, so as to better choose the required components.

For the following Cartesian coordinate system charts, **the cartesian coordinate system [axes](/vchart/guide/tutorial_docs/Chart_Concepts/Axes) will be registered by default** for the calculation of data-to-graphic position mapping.

> Line chart, area chart, bar chart, histogram, scatter, heatmap, boxplot, waterfall, intervalBar chart, intervalArea chart, linearProgress chart

Usually, linear axis (`registerCartesianLinearAxis`) and the band axis (`registerCartesianBandAxis`) is enough to meet most needs. If you need to use the logarithmic axis (`registerCartesianLogAxis`) or the time axis (`registerCartesianTimeAxis`), you need to load them separately.

```ts
import { registerCartesianTimeAxis, registerCartesianLogAxis } from '@visactor/vchart';

VChart.useRegisters([
  registerCartesianTimeAxis, // Optional
  registerCartesianLogAxis // Optional
]);
```

For the following polar coordinate system charts, **the polar coordinate system [axes](/vchart/guide/tutorial_docs/Chart_Concepts/Axes) will be registered by default**.

> Radar chart, rose chart, gauge chart, circularProgress chart, circlePacking chart

Other components and their registration methods can be found in Appendix II at the end of the document.

#### Supplementary: CustomMark components

CustomMark components, namely the `customMark` and `extensionMark` items in the chart configuration, are usually used to draw supplementary annotations. The usage can be referred to the [Custom Graphic Example.](vchart/examples/custom/series-extension)

VChart provides more than 10 types of graphics. In the mode of loading as needed, in order to minimize redundant packaging, graphics need to be manually registered. For example:

```js
import { registerTextMark, registerImageMark } from '@visactor/vchart';

VChart.useRegisters([registerTextMark, registerImageMark]);
```

Of course, we also provide a method to register all graphics:

```js
import { registerAllMarks } from '@visactor/vchart';

VChart.useRegisters([registerAllMarks]);
```

For a specific list of graphics and their registration methods, please refer to Appendix III at the end of the document.

### How to import plugins

Taking the [Media Query](/vchart/guide/tutorial_docs/Self-adaption/Media_Query)as an example, it can be imported in the following way:

> `import { registerMediaQuery } from '@visactor/vchart';`

## React-VChart On-Demand Loading

React-VChart inherently supports on-demand loading. When on-demand loading of VChart is needed, there are two methods:

React-VChart inherently supports on-demand loading. When on-demand loading of VChart is required, there are two methods:

- Use the `<VChartSimple />` tag to implement custom on-demand loading.

The `<VChartSimple />` component and the `<VChart />` component are used in almost the same way. The only difference is that users need to import the `VChart` constructor class from `@visactor/vchart` and pass it to `<VChartSimple />`.

```typescript
interface VChartSimpleProps extends EventsProps {
  /** Chart definition */
  spec: any;
  /** Chart configuration */
  options?: ChartOptions;
  /** Event triggered when the chart has finished rendering */
  onReady?: (instance: VChart, isInitial: boolean) => void;
  /** Throw error when the chart encounters an error */
  onError?: (err: Error) => void;
  /**
   * Switch to synchronous rendering
   *
   * @since 1.8.3
   **/
  useSyncRender?: boolean;
  /**
   * When props are updated, skip the check for all functions, assuming no functions have updated
   *
   * @since 1.6.5
   **/
  skipFunctionDiff?: boolean;
  /**
   * VChart constructor class
   *
   * @since 1.8.3
   **/
  vchartConstructor: IVChartConstructor;
}
```

- Use semantic tags, from version **1.11.0**, all semantic tags support on-demand loading by default. The default registered components for various semantic tags are as follows:

| Chart                      | Category             | Additional Registered Components      |
| -------------------------- | -------------------- | ------------------------------------- |
| `<LineChart/>`             | Cartesian Coordinate | `registerLabel`                       |
| `<AreaChart/>`             | Cartesian Coordinate | `registerLabel`, `registerTotalLabel` |
| `<BarChart/>`              | Cartesian Coordinate | `registerLabel`, `registerTotalLabel` |
| `<Bar3dChart/>`            | Cartesian Coordinate | `registerLabel`, `registerTotalLabel` |
| `<BoxPlotChart/>`          | Cartesian Coordinate | `registerLabel`,                      |
| `<HeatmapChart/>`          | Cartesian Coordinate | `registerLabel`                       |
| `<Histogram3dChart/>`      | Cartesian Coordinate | `registerLabel`                       |
| `<HistogramChart/>`        | Cartesian Coordinate | `registerLabel`                       |
| `<LinearProgressChart/>`   | Cartesian Coordinate | `registerLabel`                       |
| `<RangeColumnChart/>`      | Cartesian Coordinate | `registerLabel`                       |
| `<RangeColumn3dChart/>`    | Cartesian Coordinate | `registerLabel`                       |
| `<ScatterChart/>`          | Cartesian Coordinate | `registerLabel`                       |
| `<SequenceChart/>`         | Cartesian Coordinate | `registerLabel`                       |
| `<WaterfallChart/>`        | Cartesian Coordinate | `registerLabel`, `registerTotalLabel` |
| `<RadarChart/>`            | Polar Coordinate     | `registerLabel`                       |
| `<RoseChart/>`             | Polar Coordinate     | `registerLabel`                       |
| `<CircularProgressChart/>` | Polar Coordinate     | `registerLabel`, `registerIndicator`  |
| `<Pie3dChart/>`            | General              | `registerLabel`, `registerIndicator`  |
| `<PieChart/>`              | General              | `registerLabel`, `registerIndicator`  |
| `<CirclePackingChart/>`    | General              | None                                  |
| `<FunnelChart/>`           | General              | `registerLabel`                       |
| `<Funnel3dChart/>`         | General              | `registerLabel`                       |
| `<GaugeChart/>`            | General              | None                                  |
| `<MapChart/>`              | General              | `registerLabel`                       |
| `<SankeyChart/>`           | General              | None                                  |
| `<SunburstChart/>`         | General              | None                                  |
| `<TreemapChart/>`          | General              | None                                  |
| `<VennChart/>`             | General              | None                                  |
| `<WordCloud3dChart/>`      | General              | None                                  |
| `<WordCloudChart/>`        | General              | None                                  |
| `<LiquidChart/>`           | General              | `registerIndicator`                   |

For Cartesian coordinate charts, the default registered components are as follows:

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

For polar coordinate charts, the default registered components are as follows:

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

For general charts, the default registered components are as follows:

- `registerDiscreteLegend`
- `registerContinuousLegend`
- `registerCustomMark`
- `registerAllMarks`
- `registerTitle`
- `registerTooltip`
- `registerDomTooltipHandler`

When using semantic tags, if other components not loaded by default are needed, simply register the required components.

For more details on on-demand loading, refer to the [react-vchart](/vchart/guide/tutorial_docs/Cross-terminal_and_Developer_Ecology/react) tutorial section.

## On-Demand Loading for taro-vchart

taro-VChart inherently supports on-demand loading. There are two ways to achieve on-demand loading when needed:

- Using the `<VChartSimple />` tag for custom on-demand loading

> Supported starting from version **1.10.0**

The `<VChartSimple />` component and the `<VChart />` component are used in almost the same way. The only difference is that users need to import the `VChart` constructor from `@viasctor/vchart/esm/core`, register the required charts and components as described in this document, and pass them to `<VChartSimple />`.

- Using semantic tags, all semantic tags support on-demand loading by default, with the default registered content for various semantic tags as follows:

> Supported starting from version **1.12.0**

| Chart                      | Category         | Additional Registered Components      |
| -------------------------- | ---------------- | ------------------------------------- |
| `<LineChart/>`             | Cartesian Charts | `registerLabel`                       |
| `<AreaChart/>`             | Cartesian Charts | `registerLabel`, `registerTotalLabel` |
| `<BarChart/>`              | Cartesian Charts | `registerLabel`, `registerTotalLabel` |
| `<Bar3dChart/>`            | Cartesian Charts | `registerLabel`, `registerTotalLabel` |
| `<BoxPlotChart/>`          | Cartesian Charts | `registerLabel`                       |
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

For Cartesian coordinate charts, the default registered components are as follows:

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
- `registerCanvasTooltipHandler`
- `registerTitle`

For polar coordinate charts, the default registered components are as follows:

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
- `registerCanvasTooltipHandler`
- `registerTitle`

For general charts, the default registered components are as follows:

- `registerDiscreteLegend`
- `registerContinuousLegend`
- `registerCustomMark`
- `registerAllMarks`
- `registerTitle`
- `registerTooltip`
- `registerCanvasTooltipHandler`

When using semantic tags, if other components not loaded by default are needed, simply register the required components.

For more details on on-demand loading, refer to the [taro-vchart](/vchart/guide/tutorial_docs/Cross-terminal_and_Developer_Ecology/taro) tutorial section.

## Cross-platform Related

VChart provides support for the browser and node environments by default. If your project needs to run in a mini-program environment, please note to import the mini-program environment code when loading on demand.
For example, when using in WeChat Mini Program, you need to call `registerWXEnv`:

```ts
import { registerWXEnv } from '@visactor/vchart';
VChart.useRegisters([registerWXEnv]);
```

The environment compatibility registrars currently supported by VChart include:

<table>
  <tr>
    <td>Environment</td>
    <td>Component Registration Method</td>
  </tr>
  <tr>
    <td>Browser</td>
    <td><code>registerBrowserEnv</code></td>
  </tr>
  <tr>
    <td>Node</td>
    <td><code>registerNodeEnv</code></td>
  </tr>
  <tr>
    <td>WeChat Mini Program</td>
    <td><code>registerWXEnv</code></td>
  </tr>
  <tr>
    <td>Lark Mini Program</td>
    <td><code>registerLarkEnv</code></td>
  </tr>
  <tr>
    <td>Lynx</td>
    <td><code>registerLynxEnv</code></td>
  </tr>
  <tr>
    <td>All of the above</td>
    <td><code>registerAllEnv</code></td>
  </tr>
</table>

## FAQ

### Why is on-demand loading not working in the development environment?

In the development environment, tree-shaking is not applied, so the following on-demand import is equivalent to `import VChart from '@visactor/vchart'` (full import).

However, note that tree-shaking will be enabled during the build, so missing necessary imports may cause runtime errors.

```ts
// import VChart core module
import { VChart } from '@visactor/vchart';
// import bar chart
import { registerBarChart } from '@visactor/vchart';
// import tooltip, crosshair components
import { registerTooltip, registerDomTooltipHandler, registerCartesianCrossHair } from '@visactor/vchart';

// register chart and components
VChart.useRegisters([registerBarChart, registerTooltip, registerDomTooltipHandler, registerCartesianCrossHair]);
```

### How to fix the issue when NuxtJs works in development but errors after build?

In NuxtJs, on-demand loading requires the following configuration in nuxt.config.ts, otherwise an error indicating that CommonJS imports are not supported will occur.

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  build: {
    transpile: [
      // ...
      /visactor/
    ]
  }
});
```

## Appendix I: List of series registration methods

<table>
    <tr>
        <td>Series</td>
        <td>Series Register</td>
    </tr>
    <tr>
        <td>Bar</td>
        <td><code>registerBarSeries</code></td>
    </tr>
     <tr>
        <td>Area</td>
        <td><code>registerAreaSeries</code></td>
    </tr>
     <tr>
        <td>Line</td>
        <td><code>registerLineSeries</code></td>
    </tr>
     <tr>
        <td>Scatter</td>
        <td><code>registerScatterSeries</code></td>
    </tr>
     <tr>
        <td>Pie</td>
        <td><code>registerPieSeries</code></td>
    </tr>
     <tr>
        <td>Map</td>
        <td><code>registerMapSeries</code></td>
    </tr>
     <tr>
        <td>Radar</td>
        <td><code>registerRadarSeries</code></td>
    </tr>
     <tr>
        <td>Linear Progress</td>
        <td><code>registerLinearProgressSeries</code></td>
    </tr>
     <tr>
        <td>Boxplot</td>
        <td><code>registerBoxplotSeries</code></td>
    </tr>
     <tr>
        <td>Heatmap</td>
        <td><code>registerHeatmapSeries</code></td>
    </tr>
     <tr>
        <td>RangeArea</td>
        <td><code>registerRangeAreaSeries</code></td>
    </tr>
     <tr>
        <td>RangeColumn</td>
        <td><code>registerRangeColumnSeries</code></td>
    </tr>
     <tr>
        <td>Waterfall</td>
        <td><code>registerWaterfallSeries</code></td>
    </tr>
     <tr>
        <td>Dot in Sequence</td>
        <td><code>registerDotSeries</code></td>
    </tr>
    <tr>
        <td>Link in Sequence</td>
        <td><code>registerLinkSeries</code></td>
    </tr>
     <tr>
        <td>Funnel</td>
        <td><code>registerFunnelSeries</code></td>
    </tr>
     <tr>
        <td>Gauge</td>
        <td><code>registerGaugeSeries</code></td>
    </tr>
     <tr>
        <td>Rose</td>
        <td><code>registerRoseSeries</code></td>
    </tr>
     <tr>
        <td>Circular Progress</td>
        <td><code>registerCircularProgressSeries</code></td>
    </tr>
     <tr>
        <td>Gauge Pointer</td>
        <td><code>registerGaugePointerSeries</code></td>
    </tr>
     <tr>
        <td>Sankey</td>
        <td><code>registerSankeySeries</code></td>
    </tr>
     <tr>
        <td>Treemap</td>
        <td><code>registerTreemapSeries</code></td>
    </tr>
     <tr>
        <td>WordCloud</td>
        <td><code>registerWordCloudSeries</code></td>
    </tr>
     <tr>
        <td>Circle Packing</td>
        <td><code>registerCirclePackingSeries</code></td>
    </tr>
     <tr>
        <td>3d Bar</td>
        <td><code>registerBar3dSeries</code></td>
    </tr>
      <tr>
        <td>3d Funnel</td>
        <td><code>registerFunnel3dSeries</code></td>
    </tr>
      <tr>
        <td>3d Pie</td>
        <td><code>registerPie3dSeries</code></td>
    </tr>
      <tr>
        <td>3d RangeColumn</td>
        <td><code>registerRangeColumn3dSeries</code></td>
    </tr>
      <tr>
        <td>3d WordCloud</td>
        <td><code>registerWordCloud3dSeries</code></td>
    </tr>
</table>

## Appendix II: List of component registration methods

<table>
  <tr>
    <td>Component</td>
    <td>Component Registration Method</td>
    <td>Actual Scenario Illustration</td>
  </tr>
  <tr>
    <td>Discrete Legend</td>
    <td><code>registerDiscreteLegend</code></td>
    <td><img
        src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/48c337ece11d289fc4644a215.png"
        alt="Discrete Legend Illustration" style="max-width: 400px"></td>
  </tr>
  <tr>
    <td>Continuous Legend</td>
    <td><code>registerContinuousLegend</code></td>
    <td><img
        src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/0a2e223bdcd7410c08f6a6a13.png"
        alt="Continuous Legend Illustration" style="max-width: 400px"></td>
  </tr>
  <tr>
    <td>Tooltip</td>
    <td><code>registerTooltip</code></td>
    <td style="font-weight: bold">Tooltip includes two rendering methods, canvas and dom:<br>Usually in a browser
      environment, you need to register<code>registerDomTooltipHandler</code><br>In non-browser environments such as
      mini programs and node, you need to register<code>registerCanvasTooltipHandler</code><br><img
         src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/48c337ece11d289fc4644a212.png"
        alt="Tooltip Illustration" style="max-width: 400px"></td>
  </tr>
  <tr>
    <td>Crosshair (Cartesian Coordinate System)</td>
    <td><code>registerCartesianCrossHair</code></td>
    <td><img
        src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/0a2e223bdcd7410c08f6a6a15.png"
        alt="Cartesian CrossHair Illustration" style="max-width: 400px"></td>
  </tr>
  <tr>
    <td>Crosshair (Polar Coordinate System)</td>
    <td><code>registerPolarCrossHair</code></td>
    <td><img
        src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/48c337ece11d289fc4644a218.png"
        alt="Polar CrossHair Illustration" style="max-width: 400px"></td>
  </tr>
  <tr>
    <td>Zoom Slider</td>
    <td><code>registerDataZoom</code></td>
    <td><img
        src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/load-on-demand-datazoom.png"
        alt="DataZoom Illustration" style="max-width: 400px"></td>
  </tr>
  <tr>
    <td>Scrollbar</td>
    <td><code>registerScrollBar</code></td>
    <td><img
        src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/0a2e223bdcd7410c08f6a6a18.png"
        alt="ScrollBar Illustration" style="max-width: 400px"></td>
  </tr>
  <tr>
    <td>Label</td>
    <td><code>registerLabel</code></td>
    <td><img
        src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/eb08aeafba39ab34c8a08c613.png" alt="Label Illustration"
        style="max-width: 400px"></td>
  </tr>
  <tr>
    <td>Indicator</td>
    <td><code>registerIndicator</code></td>
    <td>Commonly used for numerical indicator card display in pie charts and dashboard charts.<br><img
         src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/load-on-demand-indicator.png"
        alt="Indicator Illustration" style="max-width: 400px"></td>
  </tr>
  <tr>
  <td>Title</td>
  <td><code>registerTitle</code></td>
  <td><img  src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/load-on-demand-title.png"
      alt="Title Illustration" style="max-width: 400px"></td>
  </tr>
  <tr>
    <td>Mark Line</td>
    <td><code>registerMarkLine</code></td>
    <td><img
        src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/eb08aeafba39ab34c8a08c619.png"
        alt="MarkLine Illustration" style="max-width: 400px"></td>
  </tr>
  <tr>
    <td>Mark Point</td>
    <td><code>registerMarkPoint</code></td>
    <td><img
        src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/0a2e223bdcd7410c08f6a6a1b.png"
        alt="MarkPoint Illustration" style="max-width: 400px"></td>
  </tr>
  <tr>
    <td>Mark Area</td>
    <td><code>registerMarkArea</code></td>
    <td><img
        src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/48c337ece11d289fc4644a21c.png"
        alt="MarkArea Illustration" style="max-width: 400px"></td>
  </tr>
  <tr>
    <td>Total Label</td>
    <td><code>registerTotalLabel</code></td>
    <td>Usually used for stacked charts to display the total stack.</br><img
        src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/load-on-demand-totalLabel.png"
        alt="TotalLabel Illustration" style="max-width: 400px"></td>
  </tr>
  <tr>
    <td>Brush</td>
    <td><code>registerBrush</code></td>
    <td><img  src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/load-on-demand-brush.png"
        alt="Brush Illustration" style="max-width: 400px"></td>
  </tr>
  <tr>
    <td>Custom Mark</td>
    <td><code>registerCustomMark</code></td>
    <td>Provides the ability to extend custom drawing.<br><img
        src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/load-on-demand-customMark.png"
        alt="Custom Mark Illustration" style="max-width: 400px"></td>
  </tr>
  <tr>
    <td>Player</td>
    <td><code>registerPlayer</code></td>
    <td><img
        src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/eb08aeafba39ab34c8a08c618.png" alt="Player Illustration"
        style="max-width: 400px"></td>
  </tr>
</table>

## Appendix III: List of graphic registration methods

<table>
    <tr>
        <td>Mark</td>
        <td>Mark Register</td>
        <td>Scene Illustration</td>
    </tr>
    <tr>
        <td>Symbol</td>
        <td><code>registerSymbolMark</code></td>
        <td>Symbol mark is used to draw specific shapes such as circles and rectangles, and can create visualization effects like scatter plots.Support :<br>1. Built-In shapes,Please refer to<a href="vchart/demo/progress/linear-progress-with-target-value?keyword=linearProgress">example</a><br><img   src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart-symbolType.png" alt="Built-In Symbol Illustration" style="max-width: 400px"><br>2. svg path<br> <img   src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart-symbolType-svg.png" alt="SVG Symbol Illustration" style="max-width: 400px"></td>
    </tr>
    <tr>
        <td>Text</td>
        <td><code>registerTextMark</code></td>
        <td>ext mark is used to draw text and can create visualization effects such as labels and titles. Text mark supports both regular text and rich text.<br>1. Regular text<br><img  src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart-text-mark-normal.png" alt="text Illustration" style="max-width: 100px"><br>2. Richtext, Please refer to<a href="vchart/demo/funnel-chart/funnel-template">example</a><br><img   src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart-text-mark.png" alt="RichText Illustration" style="max-width: 300px"></td>
    </tr>
    <tr>
        <td>Rectangle</td>
        <td><code>registerRectMark</code></td>
        <td>Rectangle mark is used to draw rectangles and can create visualization effects such as bar charts. Please refer to<a href="/vchart/demo/custom/pie-extend-bars">example</a><br><img  src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/custom-mark/pie-bar.png" alt="Rect Mark Illustration" style="max-width: 300px"></td>
    </tr>
    <tr>
        <td>Image</td>
        <td><code>registerImageMark</code></td>
        <td>Image mark is used to insert images in visualization scenes, creating visualization effects such as backgrounds and icons. Please refer to<a href="vchart/demo/custom/bar-image-extension">example</a><br><img  src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/custom-mark/bar-image-fill.png" alt="Image Mark Illustration" style="max-width: 300px"></td>
    </tr>
     <tr>
        <td>Polygon</td>
        <td><code>registerPolygonMark</code></td>
        <td>Polygon mark is used to draw polygons and can create visualization effects such as funnel charts and convex hulls. Please refer to<a href="vchart/demo/funnel-chart/funnel-custom-annotation">example</a><br><img  src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart-mark-polygon.png" alt="Polygon Mark Illustration" style="max-width: 300px"></td>
    </tr>
    <tr>
        <td>Arc</td>
        <td><code>registerArcMark</code></td>
        <td>Arc mark s used to draw arcs and can create visualization effects such as pie charts and ring charts. Please refer to<a href="vchart/demo/custom/pie-extension">example</a><br><img  src="/vchart/preview/custom-pie-extension.png" alt="Arc Mark Illustration" style="max-width: 300px"></td>
    </tr>
    <tr>
        <td>Group</td>
        <td><code>registerGroupMark</code></td>
        <td>Group mark are used to group multiple primitives for unified operations such as scaling and translation. It should be noted that group mark is different from other basic marks and do not support data mapping. A declared Group Mark can only correspond to a single final group graphic element. Please refer to<a href="vchart/demo/marker/mark-area-quadrant">example</a><br></td>
    </tr>
    <tr>
        <td>Line</td>
        <td><code>registerLineMark</code></td>
        <td>Line mark is used to draw lines and can create visualization effects such as line charts.</td>
    </tr>
    <tr>
        <td>Rule</td>
        <td><code>registerRuleMark</code></td>
        <td>Rule mark is used to draw straight lines and can create visualization effects such as guide lines and reference lines. </td>
    </tr>
    <tr>
        <td>Area</td>
        <td><code>registerAreaMark</code></td>
        <td>Area mark is used to draw areas between closed curves and coordinate axes, creating visualization effects such as area charts. </td>
    </tr>
    <tr>
        <td>Path</td>
        <td><code>registerPathMark</code></td>
        <td>Path mark is used to draw arbitrary shapes of paths, creating visualization effects such as custom shapes and geographic trajectories. </td>
    </tr>
    <tr>
        <td>Ripple</td>
        <td><code>registerRippleMark</code></td>
        <td>RipplePoint is a point glyph with a ripple effect, typically used to emphasize a specific data point or indicate data changes at a specific location. In map visualization and time series analysis, RipplePoint glyphs can express the spatial distribution of data and the dynamic process of data change. Application scenarios include showing the spread of earthquakes, epidemics, news events, etc.</td>
    </tr>
    <tr>
        <td>3D Rectangle</td>
        <td><code>registerRect3dMark</code></td>
        <td>3D rectangle mark is used to draw cuboids and can create visualization effects such as bar charts in 3D visualizations. </td>
    </tr>
    <tr>
        <td>3D Arc</td>
        <td><code>registerRect3dMark</code></td>
        <td>3D arc mark is used to draw cylinders and can create visualization effects such as pie charts and ring charts in 3D visualizations. </td>
    </tr>
    <tr>
        <td>3D Pyramid </td>
        <td><code>registerPyramid3dMark</code></td>
        <td>3D pyramid marks is used to draw pyramid-shaped hexahedrons and can create visualization effects such as funnel charts in 3D visualizations. </td>
    </tr>
</table>
````

## Appendix V: Interaction Registration List

<table>
  <tr>
    <td>Interaction Type</td>
    <td>Interaction Name</td>
    <td>Interaction Registration Method</td>
    <td>Default Registration in react-vchart</td>
    <td>Default Registration in taro-vchart</td>
  </tr>
  <tr>
    <td>`element-select`</td>
    <td>Element Selection Interaction</td>
    <td><code>registerElementSelect</code></td>
    <td>Yes</td>
    <td>Yes</td>
  </tr>
  <tr>
    <td>`element-highlight`</td>
    <td>Element Hover Interaction</td>
    <td><code>registerElementHighlight</code></td>
    <td>Yes</td>
    <td>Yes</td>
  </tr>
  <tr>
    <td>`element-active`</td>
    <td>Element Activation Interaction</td>
    <td><code>registerElementActive</code></td>
    <td>No</td>
    <td>No</td>
  </tr>
  <tr>
    <td>`element-highlight-by-legend`</td>
    <td>Legend Triggered Element Highlight/Blur</td>
    <td><code>registerElementHighlightByLegend</code></td>
    <td>No</td>
    <td>No</td>
  </tr>
  <tr>
    <td>`element-active-by-legend`</td>
    <td>Legend Triggered Element Activation</td>
    <td><code>registerElementActiveByLegend</code></td>
    <td>No</td>
    <td>No</td>
  </tr>
  <tr>
    <td>`element-highlight-by-group`</td>
    <td>Grouped Element Highlight</td>
    <td><code>registerElementHighlightByGroup</code></td>
    <td>No</td>
    <td>No</td>
  </tr>
  <tr>
    <td>`element-highlight-by-key`</td>
    <td>Element Highlight by Key</td>
    <td><code>registerElementHighlightByKey</code></td>
    <td>No</td>
    <td>No</td>
  </tr>
  <tr>
    <td>`element-highlight-by-name`</td>
    <td>Element Highlight by Name</td>
    <td><code>registerElementHighlightByName</code></td>
    <td>No</td>
    <td>No</td>
  </tr>
</table>
````
