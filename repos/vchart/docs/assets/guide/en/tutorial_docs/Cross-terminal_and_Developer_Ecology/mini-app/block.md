## Lark Mini-Program Widget

[Lark Mini-Program Widget](https://open.feishu.cn/document/client-docs/block/block-introduction) is a lightweight functional block created by Lark. It is defined as a carrier of an information unit that integrates rendering, interaction, and data. VChart can be used for chart drawing on the Lark Mini-Program Widget.

## How to Use

Tip: **Currently, VChart (@visactor/vchart) is not built into Lark Mini-Program Widget, so you need to manually import it into your Lark Mini-Program Widget project.**

## How to get VChart

Currently, the widget requires VChart's umd packaged product, which you can obtain through the following channels:

1. Obtain [packages/block-vchart/block/vchart/index.js](https://github.com/VisActor/VChart/blob/main/packages/block-vchart/block/vchart/index. js), we will update it every time we send a package. **This is specially built for the Feishu widget environment. In order to reduce the size as much as possible, this package only contains the rendering environment of the Feishu widget. **
2. You can also get it from the following free CDN, **This is the vchart build product that includes all rendering environments and all functions**

```html
<!-- unpkg -->
<script src="https://unpkg.com/@visactor/vchart/build/index.min.js"></script>

<!-- jsDelivr -->
<script src="https://cdn.jsdelivr.net/npm/@visactor/vchart/build/index.min.js"></script>
```

## Functions not supported yet

Due to serialization issues, Feishu widgets currently do not support passing complex objects and functions in `setData`, and only support serializable data. So you cannot configure callback functions for properties in the chart spec passed to `setData`. There are currently two methods to solve this problem:

1. Do not pass spec through `setData`, or update the chart through `vchart.updateSpec(spec)` method after the VChart instance is created. At this time, pass in the spec with function
2. Upgrade vchart to 1.7.0+ and use the registration custom function function we provide to achieve this. See the specific usage below: [Registration Function](#Registration Function)

## Demo Example

We provide a complete example project for reference during development: [https://github.com/VisActor/VChart/tree/main/packages/block-vchart](https://github.com/VisActor/VChart/tree/main/packages/block-vchart)

**Prerequisite: Please refer to Lark Mini-Program Widget's [official tutorial documentation](https://open.feishu.cn/document/client-docs/block/block-introduction) to get an idea of how to develop Lark Mini-Program Widget.**

Below we will introduce how to use VChart on the Lark Mini-Program Widget from the `js`, `ttml`, `ttss` sections.

### index.ttml

In `index.ttml`, declare the following code as the canvas carrier using the chart capability. The attributes here are `class`, `id`, and `canvas-id`.

- `class`: CSS class name, which will be automatically linked with the class set in `index.ttss`.
- `id`: For querying the DOM in the `index.js` below.
- `canvas-id`: A special identifier, used to distinguish elements by the compiler service.

Additionally, VChart uses HTML rendering for tooltips by default, but the Mini-Program Widget environment does not support HTML. So we need to use the canvas version of the tooltip, and to improve interaction performance, we need to use another layer of canvas as the tooltip's drawing carrier. **Notice the order in which the canvas is declared (below the draw canvas layer) and disable tooltip canvas events**.

```html
<view class="vchart">
  <!-- Drawing layer canvas -->
  <canvas
    class="cs-canvas"
    id="line_draw_canvas"
    canvas-id="line_draw_canvas"
    bindtouchstart="bindChartEvent"
    bindtouchmove="bindChartEvent"
    bindtouchend="bindChartEvent"
  >
  </canvas>
  <!-- Pay attention to the canvas order -->
  <!-- Tooltip canvas -->
  <canvas
    id="line_tooltip_canvas"
    canvas-id="line_tooltip_canvas"
    class="cs-tooltip-canvas"
    user-interaction-enabled="{{false}}"
  >
  </canvas>
</view>
```

### index.ttss

In this part, developers need to set the styles for the elements in `index.ttml` above. It's important to ensure that the chart container canvas has a width and height.

```css
/* chart */
.vchart {
  position: relative;
  width: 100%;
  margin: 12px 8px;
  height: 400px;
  display: block;
}

.cs-canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.cs-tooltip-canvas {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}
```

### index.js

The root index.js in the block, where you import VChart and create a VChart instance. Developers need to query the DOM in the block's lifecycle `onReady`. After getting the DOM, start creating a VChart instance.

```js
import pieSpec from "./data/pie";
import VChart from './vchart/index'; // Assuming the VChart script is placed in this directory
...
onReady(){
    tt.createSelectorQuery()
      .select('#line_draw_canvas')
      .boundingClientRect(domRef => {
        if (!domRef) {
          console.error(`Canvas #line not found`);
          return;
        }
        const chartInstance = new VChart(
          {
            width: domRef.width,
            height: domRef.height,
            ...pieSpec
          },
          // The following is the configuration for the miniApp environment
          {
            mode: 'miniApp',
            modeParams: {
              domref: domRef,
              force: true,
              canvasIdLists: ['line_draw_canvas', 'line_tooltip_canvas'],
              tooltipCanvasId: 'line_tooltip_canvas',
              freeCanvasIdx: 1
            },
            // Please ensure that dpr can be updated to the object in real time when it changes
            dpr: tt.getSystemInfoSync().pixelRatio,
            renderCanvas: 'line_draw_canvas'
          }
        );
        chartInstance.renderSync();
      })
    .exec();
}
```

### Event Binding

You can see that the canvas with the id "line_draw_canvas" in index.ttml above has bound `touchstart`, `touchmove`, and `touchend` events. Once bound, you need to write the `bindChartEvent` event handler function in index.js:

```js
// index.js
methods: {
    init() {
      // do something
    },
    // Handle events
    bindChartEvent(event) {
      const id = event.target.id.split('_')[0];
      // The following is example code, i.e., find the corresponding VChart instance by id, and the actual scenario depends on your specific situation to get the VChart instance
      const targetChart = this.data.chartList.find(x => x.id === id);
      const chartInstance = targetChart?.chart;
      if (chartInstance) {
        event.target = chartInstance.getCanvas(); // Tip: Must be set
        chartInstance.getStage().window.dispatchEvent(event);
      }
    },
  }
```

#### Mouse Event Listening

Lark Mini-Program Widget desktop versions also support mouse events, so you can bind `mousemove`, `mouseover`, etc. **But be careful to handle event conflicts (this requires handling at your own business level)**.

```html
<!-- index.ttml  -->
<canvas
  class="cs-canvas"
  id="line_draw_canvas"
  canvas-id="line_draw_canvas"
  bindmousemove="bindChartEvent"
  bindmouseover="bindChartEvent"
></canvas>
```

## Register function

Since version `1.7.0`, Feishu widget supports registering custom functions. You can use global registration or instance registration `registerFunction` to register functions.

#### Global registration function

When using a global registration function, call the chart method `VChart.registerFunction` to register a custom function, and callback processing will be performed at runtime, as shown in the example below.

1. Introduce VChart in `index.js` and register the `labelFormat` custom function

```js
<!-- index.js -->
import VChart from './vchart/index';

Block({
   // ...
   onLoad(options) {

     // Register the custom function globally
     VChart.registerFunction('labelFormat', (text) => {
       return `$${text}`;
     });
   },
   // ...
});
```

2. The spec statement is as follows

```ts
{
   type: 'line',
   // ...
   label: {
     visible: true,
     position: 'top',
     formatMethod: 'labelFormat', // Declare the function name used
   }
}
```

#### Instance registration function

When using an instance to register a function, call the instance method `registerFunction` to register a custom function, and callback processing will be performed at runtime, as shown in the example below.

```js
<!-- index.js -->
methods: {
     init() {
       this.data.chartList.forEach(item => {
         tt.createSelectorQuery()
           .select(`#${item.id}_draw_canvas`)
           .boundingClientRect(domRef => {
             if (!domRef) {
               console.error(`#${item.id} canvas not found`);
               return;
             }

             item.chart && item.chart.release();

             //Custom function
             function labelFormat(key){
               return key + 'test';
             }

             const chartInstance = new VChart(
               {
                 width:domRef.width,
                 height: domRef.height,
                 /**
                  * The function name 'labelFormat' can be used in spec
                  * For example, use this function to format labels
                  * label: {
                  * visible: true,
                  * formatMethod: 'labelFormat'
                  * }
                  */
                 ...item.spec
               },
               {
                 //do something
               }
             );

             //Instance registers the custom function
             chartInstance.registerFunction('labelFormat', labelFormat);

             chartInstance.renderSync();
           })
           .exec();
       });
     }
   }
```

For details, see: [https://github.com/VisActor/VChart/tree/main/packages/block-vchart](https://github.com/VisActor/VChart/tree/main/packages/block-vchart)
