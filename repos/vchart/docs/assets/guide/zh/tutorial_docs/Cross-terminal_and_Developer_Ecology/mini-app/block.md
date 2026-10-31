## 飞书小组件

[飞书小组件](https://open.feishu.cn/document/client-docs/block/block-introduction) 是飞书独创的轻量级功能块，它被定义为一个集渲染、交互、数据为一体的信息单元载体，实现信息在飞书套件内的顺畅流转与消费。在飞书小组件上可以使用 VChart 进行图表绘制。

## 使用方式

Tip: **目前 VChart（@visactor/vchart）还未内置进飞书小组件，所以需要你在飞书小组件项目中手动引入。**

## 如何获取 VChart

目前小组件上需要 VChart 的 umd 打包产物，你可以通过如下渠道获取：

1. 直接仓库中获取 [packages/block-vchart/block/vchart/index.js](https://github.com/VisActor/VChart/blob/main/packages/block-vchart/block/vchart/index.js) ，每次发包我们都会进行更新，**这是我们专门为飞书小组件环境构建的，为了尽可能降低大小，该包只包含了飞书小组件的渲染环境。**
2. 你也可以从如下免费的 CDN 中获取，**这是包含了所有渲染环境以及所有功能的 vchart 构建产物**

```html
<!-- unpkg -->
<script src="https://unpkg.com/@visactor/vchart/build/index.min.js"></script>

<!-- jsDelivr -->
<script src="https://cdn.jsdelivr.net/npm/@visactor/vchart/build/index.min.js"></script>
```

## 暂不支持的功能

飞书小组件现阶段由于序列化问题，还不支持在 `setData` 传递复杂对象及函数，只支持可序列化的数据。所以你无法在传递给 `setData` 的图表 spec 中为属性配置回调函数。目前可以通过如下两个方法来解决这个问题：

1. 不要通过 `setData` 传递 spec，或者在 VChart 实例创建之后，通过 `vchart.updateSpec(spec)` 方法来更新图表，这个时候将带函数的 spec 传入
2. 升级 vchart 升级到 1.7.0+，使用我们提供的注册自定义函数功能来实现，具体的使用方式见下文: [注册函数](#注册函数)

## Demo 示例

我们提供了一个完整的 demo 项目，可供开发时参考：[https://github.com/VisActor/VChart/tree/main/packages/block-vchart](https://github.com/VisActor/VChart/tree/main/packages/block-vchart)

**前提：请了解下飞书小组件的[官方教程文档](https://open.feishu.cn/document/client-docs/block/block-introduction)，大致了解下如何开发飞书小组件。**

下面我们从 `js`、`ttml`、`ttss` 三部分介绍下如何在飞书小组件上使用 VChart。

### index.ttml

在 `index.ttml` 去声明如下代码，作为使用图表能力的 canvas 载体，这里的属性有 `class`，`id`，`canvas-id`。

- `class`：样式的类名，会和即将在 `index.ttss` 中设置的类自动链接使用
- `id`：用于在下方的 `index.js` 中通过 query 取到 dom
- `canvas-id`：一个特殊标志符，是为了让编译服务进行元素区分

另外因为 VChart 默认使用 html 渲染 tooltip，而小组件环境不支持 html，所以我们需要使用 canvas 版本的 tooltip，同时为了更好的交互性能，我们需要使用另一层 canvas 元素来作为 tooltip 绘制的载体。**需要注意 canvas 声明的顺序（在 draw canvas 下层），同时关闭 tooltip canvas 事件**。

```html
<view class="vchart">
  <!-- 绘制层 canvas -->
  <canvas
    class="cs-canvas"
    id="line_draw_canvas"
    canvas-id="line_draw_canvas"
    bindtouchstart="bindChartEvent"
    bindtouchmove="bindChartEvent"
    bindtouchend="bindChartEvent"
  >
  </canvas>
  <!-- 注意 canvas 顺序 -->
  <!-- tooltip canvas -->
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

这一部分需要开发者给上方的 index.ttml 元素设置样式。值得注意的是，需要保证图表容器 canvas 是有宽高的。

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

block 下的根 index.js，在这里引入 VChart 并创建 VChart 实例。开发者需在 block 的生命周期 onReady 内，进行 dom 的查询。取到 dom 后，开始创建 VChart 实例。

```js
import pieSpec from "./data/pie";
import VChart from './vchart/index'; // 假设将 VChart 脚本放在这个目录下
...
onReady(){
    tt.createSelectorQuery()
      .select('#line_draw_canvas')
      .boundingClientRect(domRef => {
        if (!domRef) {
          console.error(`未找到 #line 画布`);
          return;
        }
        const chartInstance = new VChart(
          {
            width: domRef.width,
            height: domRef.height,
            ...pieSpec
          },
          // 以下是小组件端环境的配置
          {
            mode: 'miniApp',
            modeParams: {
              domref: domRef,
              force: true,
              canvasIdLists: ['line_draw_canvas', 'line_tooltip_canvas'],
              tooltipCanvasId: 'line_tooltip_canvas',
              freeCanvasIdx: 1
            },
            // 需要保证 dpr 在发生变化时能够实时更新到对象上
            dpr: tt.getSystemInfoSync().pixelRatio,
            renderCanvas: 'line_draw_canvas'
          }
        );
        chartInstance.renderSync();
      })
    .exec();
}
```

### 事件绑定

可以看到在上面 index.ttml 中 id 为 "line_draw_canvas" 的 canvas 绑定了 `touchstart` `touchmove` `touchend` 这三类事件。绑定了之后，需要在 index.js 上编写 `bindChartEvent` 事件处理函数：

```js
// index.js
methods: {
    init() {
      // do something
    },
    // 处理事件
    bindChartEvent(event) {
      const id = event.target.id.split('_')[0];
      // 以下为示例代码，即根据 id 查找对对应的 VChart 实例，实际场景请根据自己的情况获取 VChart 实例
      const targetChart = this.data.chartList.find(x => x.id === id);
      const chartInstance = targetChart?.chart;
      if (chartInstance) {
        event.target = chartInstance.getCanvas(); // Tip: 必须设置
        chartInstance.getStage().window.dispatchEvent(event);
      }
    },
  }
```

#### mouse 事件监听

飞书小组件桌面端也支持 mouse 事件，所以你也可以绑定 `mousemove` `mouseover` 等事件，**但是要注意事件冲突的处理（这个需要在自己的业务层处理）**。

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

## 注册函数

自从`1.7.0`版本, 飞书小组件支持注册自定义函数，你可以使用全局注册或实例注册`registerFunction`两种方法进行函数注册。

#### 全局注册函数

在使用全局注册函数时，调用图表方法`VChart.registerFunction`注册自定义函数，在运行时便会进行回调处理，如下方的示例。

1. 在 `index.js` 中引入 VChart，并注册 `labelFormat` 自定义函数

```js
<!-- index.js  -->
import VChart from './vchart/index';

Block({
  // ...
  onLoad(options) {

    // 全局注册该自定义函数
    VChart.registerFunction('labelFormat', (text) => {
      return `$${text}`;
    });
  },
  // ...
});
```

2. spec 声明如下

```ts
{
  type: 'line',
  // ...
  label: {
    visible: true,
    position: 'top',
    formatMethod: 'labelFormat', // 声明使用的函数名称
  }
}
```

#### 实例注册函数

在使用实例注册函数时，调用实例方法`registerFunction`注册自定义函数，在运行时便会进行回调处理，如下方的示例。

```js
<!-- index.js  -->
methods: {
    init() {
      this.data.chartList.forEach(item => {
        tt.createSelectorQuery()
          .select(`#${item.id}_draw_canvas`)
          .boundingClientRect(domRef => {
            if (!domRef) {
              console.error(`未找到 #${item.id} 画布`);
              return;
            }

            item.chart && item.chart.release();

            // 自定义函数
            function labelFormat(key){
              return key + 'test';
            }

            const chartInstance = new VChart(
              {
                width: domRef.width,
                height: domRef.height,
                /**
                 * spec中可使用该函数名'labelFormat'
                 * 例如，使用该函数做label的格式化
                 * label: {
                 *   visible: true,
                 *   formatMethod: 'labelFormat'
                 * }
                 */
                ...item.spec
              },
              {
                // do something
              }
            );

            // 实例注册该自定义函数
            chartInstance.registerFunction('labelFormat', labelFormat);

            chartInstance.renderSync();
          })
          .exec();
      });
    }
  }
```

具体详见：[https://github.com/VisActor/VChart/tree/main/packages/block-vchart](https://github.com/VisActor/VChart/tree/main/packages/block-vchart)
