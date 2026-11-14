# Lynx

**[Note] The open-source version of Lynx currently does not provide canvas functionality, so VChart rendering is not supported at this time. Future versions will support this feature. Stay tuned, [see the Lynx official website for more features](https://lynxjs.org/)**

Lynx is a high-performance cross-platform framework open-sourced by ByteDance, enabling the rapid construction of Native views based on the Web technology stack. Lynx was officially open-sourced on March 5, 2025. VChart provides chart rendering capabilities for this framework based on the internal version of Lynx at ByteDance.

## How to get VChart

### npm package

You can install the vchart dependency package directly in the lynx project: `@visactor/vchart`.

### Manually import script

You can also manually reference VChart's umd packaged product, which you can obtain through the following channels:

1. Obtain [packages/block-vchart/block/vchart/index.js](https://github.com/VisActor/VChart/blob/main/packages/block-vchart/block/vchart/index. js), we will update it every time we send a package
2. Get it from the following free CDN

```html
<!-- unpkg -->
<script src="https://unpkg.com/@visactor/vchart/build/index.min.js"></script>

<!-- jsDelivr -->
<script src="https://cdn.jsdelivr.net/npm/@visactor/vchart/build/index.min.js"></script>
```

## how to use

Below we will introduce how to use VChart on Feishu widgets from three parts: `js`, `ttml`, and `ttss`.

### index.ttml

Three canvases need to be declared, and pay attention to the order of declaration.

- `bar_hidden_canvas` hidden canvas, declared in the first, is used for some internal picking logic
- `bar_draw_canvas` draws canvas, the second statement
- `bar_tooltip_canvas` is used to draw the canvas of the tooltip. The tooltip of the cross-end environment is drawn using the canvas.

```html
<view class="vchart">
  <!-- canvas order is important -->
  <canvas
    name="bar_hidden_canvas"
    id="bar_hidden_canvas"
    user-interaction-enabled="{{false}}"
    class="cs-canvas cs-canvas-hidden"
  >
  </canvas>
  <canvas
    class="cs-canvas"
    bindtouchstart="bindChartEvent"
    bindtouchmove="bindChartEvent"
    bindtouchend="bindChartEvent"
    name="bar_draw_canvas"
    id="bar_draw_canvas"
  >
  </canvas>
  <canvas
    name="bar_tooltip_canvas"
    id="bar_tooltip_canvas"
    user-interaction-enabled="{{false}}"
    class="cs-tooltip-canvas"
  >
  </canvas>
</view>
```

### index.js

Create a VChart instance in this file. Because VChart is internally compatible with the lynx environment, its use is basically the same as on the PC. You only need to pay attention to two points:

1. Necessary environment parameters need to be declared in the constructor of VChart

```ts
const chartInstance = new VChart(spec, {
  mode: 'lynx', // Tip: Cross-end environment needs to manually pass in mode
  // Cross-end parameters
  modeParams: {
    domref: domRef, // Canvas node for chart drawing
    force: true, // Whether to force the use of canvas for drawing
    canvasIdLists: [`${item.id}_draw_canvas`, `${item.id}_tooltip_canvas`, `${item.id}_hidden_canvas`], // canvasId list
    tooltipCanvasId: `${item.id}_tooltip_canvas`, // tooltip canvasId
    freeCanvasIdx: 1 // Free canvas index
  },
  dpr: pixelRatio, // Tip: Cross-end environment needs to manually pass in dpr
  renderCanvas: `${item.id}_draw_canvas` // Declare the canvasId used for drawing
});
```

2. Regarding events, users need to bind events to the canvas (canvas used for drawing) element themselves, and then manually dispatch events in the event listening function to trigger events inside VChart.

```ts
bindChartEvent(event) {
   const id = event.target.id.split("_")[0];
   const targetChart = this.data.chartList.find(x => x.id === id);
   const chartInstance = targetChart?.chart;
   if (chartInstance) {
     event.target = chartInstance.getCanvas(); // Tip: Must be set
     chartInstance.getStage().window.dispatchEvent(event);
   }
},
```

The following is the completed code related to index.js:

```ts
import barSpec from './data/bar';
import VChart, { registerLynxEnv } from '@visactor/vchart';
import mapJson from './data/map-data-china';

Card({
  data: {
    chartList: [
      {
        id: 'bar',
        spec: barSpec,
        chart: undefined
      }
    ]
  },
  onLoad: function () {
    // 如果需要使用地图，需要先注册地图
    VChart.registerMap('china', mapJson, {
      type: 'geojson'
    });
    this.init();
  },

  init() {
    registerLynxEnv();
    this.data.chartList.forEach(item => {
      this.createSelectorQuery()
        .select(`#${item.id}_draw_canvas`)
        .invoke({
          method: 'boundingClientRect',
          success: domRef => {
            if (!domRef) {
              console.error(`未找到 #${item.id} 画布`);
              return;
            }
            domRef.id = item.id;
            const pixelRatio = SystemInfo.pixelRatio;

            const chartInstance = new VChart(item.spec, {
              mode: 'lynx', //  Tip: 跨端环境需要手动传入 mode
              // 跨端参数
              modeParams: {
                domref: domRef, // 图表绘制的 canvas 节点
                force: true, // 是否强制使用 canvas 绘制
                canvasIdLists: [`${item.id}_draw_canvas`, `${item.id}_tooltip_canvas`, `${item.id}_hidden_canvas`], // canvasId 列表
                tooltipCanvasId: `${item.id}_tooltip_canvas`, // tooltip canvasId
                freeCanvasIdx: 1 // 自由 canvas 索引
              },
              dpr: pixelRatio, // Tip: 跨端环境需要手动传入 dpr
              renderCanvas: `${item.id}_draw_canvas` // 声明用于绘制的 canvasId
            });
            item.chart = chartInstance;

            if (item.events) {
              item.events.forEach(event => {
                chartInstance.on(event.type, { source: event.element }, event.handler);
              });
            }
            chartInstance.renderSync();
          },
          fail: res => {
            console.log('res:', res);
          }
        })
        .exec();
    });
  },

  bindChartEvent(event) {
    const id = event.target.id.split('_')[0];
    const targetChart = this.data.chartList.find(x => x.id === id);
    const chartInstance = targetChart?.chart;
    if (chartInstance) {
      event.target = chartInstance.getCanvas(); // Tip: 必须设置
      chartInstance.getStage().window.dispatchEvent(event);
    }
  }
});
```

## On-Demand Loading

Lynx-VChart inherently supports on-demand loading. There are two ways to achieve on-demand loading with VChart:

- Use the `<VChartSimple />` tag to implement custom on-demand loading.

The `<VChartSimple />` component and the `<VChart />` component are almost identical in usage. The only difference is that users need to import the `VChart` constructor class from `@viasctor/vchart/esm/core`, register the required charts and components as described in this document, and pass them to `<VChartSimple />`.

- Use semantic tags, all of which support on-demand loading by default. The default registered components for each type of semantic tag are as follows:

> Supported from version **0.0.12**

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
- `registerCanvasTooltipHandler`

For Polar charts, the default registered components are as follows:

- `registerPolarLinearAxis`
- `registerPolarBandAxis`
- `registerPolarCrossHair`
- `registerBrush`
- `registerContinuous Legend`
- `registerDataZoom`
- `registerDiscreteLegend`
- `registerCustomMark`
- `registerAllMarks`
- `registerScrollBar`
- `registerTitle`
- `registerTooltip`
- `registerCanvasTooltipHandler`

For General charts, the default registered components are as follows:

- `registerDiscreteLegend`
- `registerContinuousLegend`
- `registerCustomMark`
- `registerAllMarks`
- `registerTitle`
- `registerTooltip`
- `registerCanvasTooltipHandler`

When using semantic tags, if you need components that are not loaded by default, you only need to register the missing components.

[Note]: If there is an error similar to "No matching export in..." when using Lynx, please upgrade the version of Lynx or configure resolve.enable INodeCache to false

For reference on on-demand loading of VChart, see [related documentation](/vchart/guide/tutorial_docs/Load_on_Demand).
