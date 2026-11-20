# VChart 按需加载教程

## 快速上手

`@visactor/vchart` 默认提供的是 VChart 所有的图表和组件，如果你不想引入所有组件，也可以按需引入相关的组件。使用示例如下：

```ts
// 引入 VChart 核心模块
import { VChart } from '@visactor/vchart';
// 引入柱状图
import { registerBarChart } from '@visactor/vchart';
// 引入坐标轴、提示信息、十字准星组件
import { registerTooltip, registerCartesianCrossHair, registerDomTooltipHandler } from '@visactor/vchart';

// 注册柱状图和组件
VChart.useRegisters([registerBarChart, registerTooltip, registerDomTooltipHandler, registerCartesianCrossHair]);
```

如果你的项目中关闭了打包软件的 tree-shaking 优化，则需要手动引入内部文件 `@visactor/vchart/esm/xxx`，如`@visactor/vchart/esm/core`或`@visactor/vchart/esm/component`等，使用方法如下所示：

```ts
// 引入 VChart 核心模块
import { VChart } from '@visactor/vchart/esm/core';
// 引入柱状图
import { registerBarChart } from '@visactor/vchart/esm/chart';
// 引入坐标轴、Tooltip、CrossHair组件
import { registerTooltip, registerCartesianCrossHair } from '@visactor/vchart/esm/component';
// 引入 Dom tooltip 逻辑
import { registerDomTooltipHandler } from '@visactor/vchart/esm/plugin';
// 引入微信小程序环境代码
import { registerWXEnv } from '@visactor/vchart/esm/env';

// 注册图表和组件
VChart.useRegisters([
  registerBarChart,
  registerTooltip,
  registerCartesianCrossHair,
  registerDomTooltipHandler,
  registerWXEnv
]);
```

## 如何使用

当你通过下面的方式引入 VChart，得到的是一个只有核心逻辑，**不包含任何图表、组件、插件、环境兼容**的对象。用户需要手动引入相关图表、组件，并进行注册。

> `import { VChart } from '@visactor/vchart'`

可以的选择注册内容通常包括：

- **图表类型**
- **组件**
- 插件（媒体查询、格式化等）
- 交互（选中、悬浮等）
- 环境兼容（Lynx、微信小程序、飞书小程序的环境兼容）

通常来说，除了注册图表类型以外，还需要注册必要的组件。例如在折线图中，坐标轴（连续轴和离散轴）是必不可少的，如果不注册，图表将无法绘制。

这篇文的将尽可能详细地说明组件引入的规则。

### 如何引入图表

VChart 目前支持 20+ 种[图表类型](/vchart/guide/tutorial_docs/Chart_Types/chart_types)，可以通过如下方式引入：

> `import { registerBarChart } from '@visactor/vchart;`

#### 如何引入组合图表

组合图是指图表配置中 `type: 'common'` 的图表，通常使用多个数据系列和多个视觉元素，如折线系列、柱状系列、面积系列、散点系列、饼系列等，以呈现各种类型的数据。最常用于绘制双轴图、柱线组合图，详细介绍可以参考[组合图教程](vchart/guide/tutorial_docs/Chart_Types/Combination)。

按需引入时，需要引入 Common 图表，同时按需注册将要用到的系列：

```ts
import { registerCommonChart, registerBarSeries, registerLineSeries } from '@visactor/vchart';

VChart.useRegisters([registerCommonChart, registerBarSeries, registerLineSeries]);
```

系列注册方法列表，请参考文末附录一。

### 如何引入组件

用户可以通过教程文档中的[图表概念](/vchart/guide/tutorial_docs/Chart_Concepts/Understanding_VChart)相关内容，了解在图表中，各个功能组件的名词和形式，从而更好地选择所需的组件。

对于下列笛卡尔坐标系图表而言，**默认引入了直角坐标系[坐标轴](/vchart/guide/tutorial_docs/Chart_Concepts/Axes)**，用于数据到图形位置的映射计算。

> 折线图、面积图、柱状图/条形图、直方图、散点图、热力图、箱型图、瀑布图、区间柱状图、区间面积图、条形进度图

通常，连续轴（`registerCartesianLinearAxis`）和离散轴（`registerCartesianBandAxis`）足以满足大部分需求。如果你需要使用到对数轴（`registerCartesianLogAxis`）、时间轴（`registerCartesianTimeAxis`），则需要手动注册。

```js
import { registerCartesianTimeAxis, registerCartesianLogAxis } from '@visactor/vchart';

VChart.useRegisters([registerCartesianTimeAxis, registerCartesianLogAxis]);
```

对于下列极坐标系图表而言，**默认引了入极坐标系[坐标轴](/vchart/guide/tutorial_docs/Chart_Concepts/Axes)**。

> 雷达图、玫瑰图、仪表盘图、环形进度图、嵌套圆图

其他组件及其注册方法可以文末附录二。

#### 补充说明：自定义图元组件

自定义图元组件，即图表配置项中的 `customMark` 和 `extensionMark` 项，通常用于绘制补充注解，用法可以参考[自定义图元示例](vchart/examples/custom/series-extension)。

VChart 提供了 10+ 种自定义图元，在按需加载的模式下，为了尽可能减少冗余打包，图元需要手动注册。例如：

```js
import { registerTextMark, registerImageMark } from '@visactor/vchart';

VChart.useRegisters([registerTextMark, registerImageMark]);
```

当然，我们也提供了注册所有图元的方法，请酌情使用：

```js
import { registerAllMarks } from '@visactor/vchart';

VChart.useRegisters([registerAllMarks]);
```

具体的图元及其注册方法列表请参考文末附录三。

### 如何引入插件

以[媒体查询器](/vchart/guide/tutorial_docs/Self-adaption/Media_Query)为例，可以通过如下方式引入：

> `import { registerMediaQuery } from '@visactor/vchart';`

## react-vchart 按需加载

React-VChart 本身代码都支持按需加载，当需要 VChart 按需加载的时候，有两种办法：

- 使用 `<VChartSimple />` 标签，实现自定义的按需加载

`<VChartSimple />`组件和`<VChart />`组件使用方法基本完全相同，唯一差异点为，需要用户从 `@viasctor/vchart` 引用 `VChart` 构造类，并传入给 `<VChartSimple />`;

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

- 使用语义化标签，自**1.11.0**版本，所有的语义化标签默认支持按需加载，其中各种语义化标签默认注册的内容如下：

| 图表                       | 分类           | 额外注册的组件                        |
| -------------------------- | -------------- | ------------------------------------- |
| `<LineChart/>`             | 直角坐标系图表 | `registerLabel`                       |
| `<AreaChart/>`             | 直角坐标系图表 | `registerLabel`, `registerTotalLabel` |
| `<BarChart/>`              | 直角坐标系图表 | `registerLabel`, `registerTotalLabel` |
| `<Bar3dChart/>`            | 直角坐标系图表 | `registerLabel`, `registerTotalLabel` |
| `<BoxPlotChart/>`          | 直角坐标系图表 | `registerLabel`,                      |
| `<HeatmapChart/>`          | 直角坐标系图表 | `registerLabel`                       |
| `<Histogram3dChart/>`      | 直角坐标系图表 | `registerLabel`                       |
| `<HistogramChart/>`        | 直角坐标系图表 | `registerLabel`                       |
| `<LinearProgressChart/>`   | 直角坐标系图表 | `registerLabel`                       |
| `<RangeColumnChart/>`      | 直角坐标系图表 | `registerLabel`                       |
| `<RangeColumn3dChart/>`    | 直角坐标系图表 | `registerLabel`                       |
| `<ScatterChart/>`          | 直角坐标系图表 | `registerLabel`                       |
| `<SequenceChart/>`         | 直角坐标系图表 | `registerLabel`                       |
| `<WaterfallChart/>`        | 直角坐标系图表 | `registerLabel`, `registerTotalLabel` |
| `<RadarChart/>`            | 极坐标系图表   | `registerLabel`                       |
| `<RoseChart/>`             | 极坐标系图表   | `registerLabel`                       |
| `<CircularProgressChart/>` | 极坐标系图表   | `registerLabel`, `registerIndicator`  |
| `<Pie3dChart/>`            | 通用图表       | `registerLabel`, `registerIndicator`  |
| `<PieChart/>`              | 通用图表       | `registerLabel`, `registerIndicator`  |
| `<CirclePackingChart/>`    | 通用图表       | 无                                    |
| `<FunnelChart/>`           | 通用图表       | `registerLabel`                       |
| `<Funnel3dChart/>`         | 通用图表       | `registerLabel`                       |
| `<GaugeChart/>`            | 通用图表       | 无                                    |
| `<MapChart/>`              | 通用图表       | `registerLabel`                       |
| `<SankeyChart/>`           | 通用图表       | 无                                    |
| `<SunburstChart/>`         | 通用图表       | 无                                    |
| `<TreemapChart/>`          | 通用图表       | 无                                    |
| `<VennChart/>`             | 通用图表       | 无                                    |
| `<WordCloud3dChart/>`      | 通用图表       | 无                                    |
| `<WordCloudChart/>`        | 通用图表       | 无                                    |
| `<LiquidChart/>`           | 通用图表       | `registerIndicator`                   |

其中，直角坐标系图表默认注册组件如下：

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

极坐标系图表默认注册组件如下：

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

通用图表默认注册组件如下：

- `registerDiscreteLegend`
- `registerContinuousLegend`
- `registerCustomMark`
- `registerAllMarks`
- `registerTitle`
- `registerTooltip`
- `registerDomTooltipHandler`

使用语义化标签的时候，如果用到其他没有默认加载的组件，只需要注册未加载的组件即可；

也可以参考[react-vchart](/vchart/guide/tutorial_docs/Cross-terminal_and_Developer_Ecology/react) 教程中的按需加载章节

## taro-vchart 按需加载

taro-VChart 本身代码都支持按需加载，当需要 VChart 按需加载的时候，有两种办法：

- 使用 `<VChartSimple />` 标签，实现自定义的按需加载

> 自**1.10.0**版本开始支持

`<VChartSimple />`组件和`<VChart />`组件使用方法基本完全相同，唯一差异点为，需要用户从 `@viasctor/vchart/esm/core` 引用 `VChart` 构造类，根据本文描述，注册需要的图表和组件，并传入给 `<VChartSimple />`;

- 使用语义化标签，，所有的语义化标签默认支持按需加载，其中各种语义化标签默认注册的内容如下：

> 自**1.12.0**版本开始支持

| 图表                       | 分类           | 额外注册的组件                        |
| -------------------------- | -------------- | ------------------------------------- |
| `<LineChart/>`             | 直角坐标系图表 | `registerLabel`                       |
| `<AreaChart/>`             | 直角坐标系图表 | `registerLabel`, `registerTotalLabel` |
| `<BarChart/>`              | 直角坐标系图表 | `registerLabel`, `registerTotalLabel` |
| `<Bar3dChart/>`            | 直角坐标系图表 | `registerLabel`, `registerTotalLabel` |
| `<BoxPlotChart/>`          | 直角坐标系图表 | `registerLabel`,                      |
| `<HeatmapChart/>`          | 直角坐标系图表 | `registerLabel`                       |
| `<Histogram3dChart/>`      | 直角坐标系图表 | `registerLabel`                       |
| `<HistogramChart/>`        | 直角坐标系图表 | `registerLabel`                       |
| `<LinearProgressChart/>`   | 直角坐标系图表 | `registerLabel`                       |
| `<RangeColumnChart/>`      | 直角坐标系图表 | `registerLabel`                       |
| `<RangeColumn3dChart/>`    | 直角坐标系图表 | `registerLabel`                       |
| `<ScatterChart/>`          | 直角坐标系图表 | `registerLabel`                       |
| `<SequenceChart/>`         | 直角坐标系图表 | `registerLabel`                       |
| `<WaterfallChart/>`        | 直角坐标系图表 | `registerLabel`, `registerTotalLabel` |
| `<RadarChart/>`            | 极坐标系图表   | `registerLabel`                       |
| `<RoseChart/>`             | 极坐标系图表   | `registerLabel`                       |
| `<CircularProgressChart/>` | 极坐标系图表   | `registerLabel`, `registerIndicator`  |
| `<Pie3dChart/>`            | 通用图表       | `registerLabel`, `registerIndicator`  |
| `<PieChart/>`              | 通用图表       | `registerLabel`, `registerIndicator`  |
| `<CirclePackingChart/>`    | 通用图表       | 无                                    |
| `<FunnelChart/>`           | 通用图表       | `registerLabel`                       |
| `<Funnel3dChart/>`         | 通用图表       | `registerLabel`                       |
| `<GaugeChart/>`            | 通用图表       | 无                                    |
| `<MapChart/>`              | 通用图表       | `registerLabel`                       |
| `<SankeyChart/>`           | 通用图表       | 无                                    |
| `<SunburstChart/>`         | 通用图表       | 无                                    |
| `<TreemapChart/>`          | 通用图表       | 无                                    |
| `<VennChart/>`             | 通用图表       | 无                                    |
| `<WordCloud3dChart/>`      | 通用图表       | 无                                    |
| `<WordCloudChart/>`        | 通用图表       | 无                                    |
| `<LiquidChart/>`           | 通用图表       | `registerIndicator`                   |

其中，直角坐标系图表默认注册组件如下：

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

极坐标系图表默认注册组件如下：

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

通用图表默认注册组件如下：

- `registerDiscreteLegend`
- `registerContinuousLegend`
- `registerCustomMark`
- `registerAllMarks`
- `registerTitle`
- `registerTooltip`
- `registerCanvasTooltipHandler`

使用语义化标签的时候，如果用到其他没有默认加载的组件，只需要注册未加载的组件即可；

也可以参考[taro-vchart](/vchart/guide/tutorial_docs/Cross-terminal_and_Developer_Ecology/taro) 教程中的按需加载章节

## 跨端

VChart 默认对浏览器和 node 环境提供了支持。如果你的项目需要运行在小程序环境下，按需加载时，请注意引入小程序环境代码。
例如，在微信小程序中使用时，需要调用 `registerWXEnv`：

```ts
import { registerWXEnv } from '@visactor/vchart';
VChart.useRegisters([registerWXEnv]);
```

目前 VChart 支持的环境兼容注册器包括：

<table>
    <tr>
        <td>环境</td>
        <td>组件注册方法</td>
    </tr>
    <tr>
        <td>浏览器</td>
        <td><code>registerBrowserEnv</code></td>
    </tr>
    <tr>
        <td>Node</td>
        <td><code>registerNodeEnv</code></td>
    </tr>
    <tr>
        <td>微信小程序</td>
        <td><code>registerWXEnv</code></td>
    </tr>
    <tr>
        <td>飞书小程序</td>
        <td><code>registerLarkEnv</code></td>
    </tr>
    <tr>
        <td>Lynx</td>
        <td><code>registerLynxEnv</code></td>
    </tr>
    <tr>
        <td>以上所有</td>
        <td><code>registerAllEnv</code></td>
    </tr>
</table>

## 常见问题

### 开发环境按需加载不起作用？

开发环境并未做 tree-shaking 处理，以下按需导入等同于`import VChart from '@visactor/vchart'`全量导入

但需注意，当打包编译时将会开启 tree-shaking，如缺少必要组件导入，项目运行将会报错！

```ts
// 引入 VChart 核心模块
import { VChart } from '@visactor/vchart';
// 引入柱状图
import { registerBarChart } from '@visactor/vchart';
// 引入坐标轴、提示信息、十字准星组件
import { registerTooltip, registerCartesianCrossHair, registerDomTooltipHandler } from '@visactor/vchart';
// 注册柱状图和组件
VChart.useRegisters([registerBarChart, registerTooltip, registerDomTooltipHandler, registerCartesianCrossHair]);
```

### NuxtJs 开发环境使用正常，打包后报错如何解决？

在 NuxtJs 中按需加载需要在`nuxt.config.ts`中进行如下配置，否则将会出现不支持 CommonJS 导入的错误

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

## 附录一：系列注册方法列表

<table>
    <tr>
        <td>系列</td>
        <td>系列注册方法</td>
    </tr>
    <tr>
        <td>柱系列</td>
        <td><code>registerBarSeries</code></td>
    </tr>
     <tr>
        <td>面积系列</td>
        <td><code>registerAreaSeries</code></td>
    </tr>
     <tr>
        <td>线系列</td>
        <td><code>registerLineSeries</code></td>
    </tr>
     <tr>
        <td>散点系列</td>
        <td><code>registerScatterSeries</code></td>
    </tr>
     <tr>
        <td>饼系列</td>
        <td><code>registerPieSeries</code></td>
    </tr>
     <tr>
        <td>地图系列</td>
        <td><code>registerMapSeries</code></td>
    </tr>
     <tr>
        <td>雷达图系列</td>
        <td><code>registerRadarSeries</code></td>
    </tr>
     <tr>
        <td>条形进度图系列</td>
        <td><code>registerLinearProgressSeries</code></td>
    </tr>
     <tr>
        <td>箱型图系列</td>
        <td><code>registerBoxplotSeries</code></td>
    </tr>
     <tr>
        <td>热力图系列</td>
        <td><code>registerHeatmapSeries</code></td>
    </tr>
     <tr>
        <td>区间面积图系列</td>
        <td><code>registerRangeAreaSeries</code></td>
    </tr>
     <tr>
        <td>区间柱图系列</td>
        <td><code>registerRangeColumnSeries</code></td>
    </tr>
     <tr>
        <td>瀑布图系列</td>
        <td><code>registerWaterfallSeries</code></td>
    </tr>
     <tr>
        <td>时序图点系列</td>
        <td><code>registerDotSeries</code></td>
    </tr>
    <tr>
        <td>时序图连线系列</td>
        <td><code>registerLinkSeries</code></td>
    </tr>
     <tr>
        <td>漏斗图系列</td>
        <td><code>registerFunnelSeries</code></td>
    </tr>
     <tr>
        <td>仪表盘系列</td>
        <td><code>registerGaugeSeries</code></td>
    </tr>
     <tr>
        <td>玫瑰图系列</td>
        <td><code>registerRoseSeries</code></td>
    </tr>
     <tr>
        <td>环形进度图系列</td>
        <td><code>registerCircularProgressSeries</code></td>
    </tr>
     <tr>
        <td>仪表图指针系列</td>
        <td><code>registerGaugePointerSeries</code></td>
    </tr>
     <tr>
        <td>桑基图系列</td>
        <td><code>registerSankeySeries</code></td>
    </tr>
     <tr>
        <td>矩形树图系列</td>
        <td><code>registerTreemapSeries</code></td>
    </tr>
     <tr>
        <td>词云系列</td>
        <td><code>registerWordCloudSeries</code></td>
    </tr>
     <tr>
        <td>圆嵌套图系列</td>
        <td><code>registerCirclePackingSeries</code></td>
    </tr>
     <tr>
        <td>3d 柱系列</td>
        <td><code>registerBar3dSeries</code></td>
    </tr>
      <tr>
        <td>3d 漏斗系列</td>
        <td><code>registerFunnel3dSeries</code></td>
    </tr>
      <tr>
        <td>3d 饼系列</td>
        <td><code>registerPie3dSeries</code></td>
    </tr>
      <tr>
        <td>3d 区间柱系列</td>
        <td><code>registerRangeColumn3dSeries</code></td>
    </tr>
      <tr>
        <td>3d 词云系列</td>
        <td><code>registerWordCloud3dSeries</code></td>
    </tr>
</table>

## 附录二：组件注册方法列表

<table>
    <tr>
        <td>组件</td>
        <td>组件注册方法</td>
        <td>实际场景示意</td>
    </tr>
    <tr>
        <td>离散图例</td>
        <td><code>registerDiscreteLegend</code></td>
        <td><img  src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/48c337ece11d289fc4644a215.png" alt="Discrete Legend Illustration" style="max-width: 400px"></td>
    </tr>
    <tr>
        <td>连续图例</td>
        <td><code>registerContinuousLegend</code></td>
        <td><img  src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/0a2e223bdcd7410c08f6a6a13.png" alt="Continuous Legend Illustration" style="max-width: 400px"></td>
    </tr>
    <tr>
        <td>提示信息</td>
        <td><code>registerTooltip</code></td>
        <td style="font-weight: bold">Tooltip 包括 canvas 和 dom 两种绘制方式：<br>通常在浏览器环境下，需要注册<code>registerDomTooltipHandler</code><br>在小程序、node等非浏览器环境下，需要注册<code>registerCanvasTooltipHandler</code><br><img  src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/48c337ece11d289fc4644a212.png" alt="Tooltip Illustration" style="max-width: 400px"></td>
    </tr>
    <tr>
        <td>十字准星（直角坐标系）</td>
        <td><code>registerCartesianCrossHair</code></td>
        <td><img  src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/0a2e223bdcd7410c08f6a6a15.png" alt="Cartesian CrossHair Illustration" style="max-width: 400px"></td>
    </tr>
    <tr>
        <td>十字准星（极坐标系）</td>
        <td><code>registerPolarCrossHair</code></td>
        <td><img  src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/48c337ece11d289fc4644a218.png" alt="Polar CrossHair Illustration" style="max-width: 400px"></td>
    </tr>
    <tr>
        <td>缩略轴</td>
        <td><code>registerDataZoom</code></td>
        <td><img  src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/load-on-demand-datazoom.png" alt="DataZoom Illustration" style="max-width: 400px"></td>
    </tr>
    <tr>
        <td>滚动条</td>
        <td><code>registerScrollBar</code></td>
        <td><img  src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/0a2e223bdcd7410c08f6a6a18.png" alt="ScrollBar Illustration" style="max-width: 400px"></td>
    </tr>
    <tr>
        <td>标签</td>
        <td><code>registerLabel</code></td>
        <td><img  src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/eb08aeafba39ab34c8a08c613.png" alt="Label Illustration" style="max-width: 400px"></td>
    </tr>
    <tr>
        <td>指标卡</td>
        <td><code>registerIndicator</code></td>
        <td>常用于饼图、仪表盘图的数值指标卡展示。<br><img  src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/load-on-demand-indicator.png" alt="Indicator Illustration" style="max-width: 400px"></td>
    </tr>
    <tr>
        <td>标题</td>
        <td><code>registerTitle</code></td>
        <td><img  src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/load-on-demand-title.png" alt="Title Illustration" style="max-width: 400px"></td>
    </tr>
    <tr>
        <td>标注线</td>
        <td><code>registerMarkLine</code></td>
        <td><img  src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/eb08aeafba39ab34c8a08c619.png" alt="MarkLine Illustration" style="max-width: 400px"></td>
    </tr>
    <tr>
        <td>标注点</td>
        <td><code>registerMarkPoint</code></td>
        <td><img  src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/0a2e223bdcd7410c08f6a6a1b.png" alt="MarkPoint Illustration" style="max-width: 400px"></td>
    </tr>
    <tr>
        <td>标注区域</td>
        <td><code>registerMarkArea</code></td>
        <td><img  src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/48c337ece11d289fc4644a21c.png" alt="MarkArea Illustration" style="max-width: 400px"></td>
    </tr>
    <tr>
        <td>总计标签</td>
        <td><code>registerTotalLabel</code></td>
        <td>通常用于堆叠图表，显示堆叠总和。</br><img  src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/load-on-demand-totalLabel.png" alt="TotalLabel Illustration" style="max-width: 400px"></td>
    </tr>
    <tr>
        <td>框选</td>
        <td><code>registerBrush</code></td>
        <td><img  src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/load-on-demand-brush.png" alt="Brush Illustration" style="max-width: 400px"></td>
    </tr>
    <tr>
        <td>自定义图元</td>
        <td><code>registerCustomMark</code></td>
        <td style="font-weight: bold">提供自定义绘图的扩展能力。<br>在按需加载的使用方式下，需要手动注册用到的图元。例如，如果用到文本，则需要注册 text 图元：<code>registerTextMark</code><br>下面的教程会详细列举出各图元类型。<img  src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/load-on-demand-customMark.png" alt="Custom Mark Illustration" style="max-width: 400px"></td>
    </tr>
    <tr>
        <td>播放器</td>
        <td><code>registerPlayer</code></td>
        <td><img  src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/eb08aeafba39ab34c8a08c618.png" alt="Player Illustration" style="max-width: 400px"></td>
    </tr>

</table>

## 附录三：图元注册方法列表

<table>
    <tr>
        <td>图元</td>
        <td>图元注册方法</td>
        <td>实际场景示意</td>
    </tr>
    <tr>
        <td>符号</td>
        <td><code>registerSymbolMark</code></td>
        <td>符号图元用于绘制特定图形，如圆、矩形等。支持:<br>1. 内置形状，请参考<a href="vchart/demo/progress/linear-progress-with-target-value?keyword=linearProgress">使用示例</a><br><img   src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart-symbolType.png" alt="Built-In Symbol Illustration" style="max-width: 400px"><br>2. svg path<br> <img   src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart-symbolType-svg.png" alt="SVG Symbol Illustration" style="max-width: 400px"></td>
    </tr>
    <tr>
        <td>文本</td>
        <td><code>registerTextMark</code></td>
        <td>文本图元支持常规文本和富文本<br>1. 常规文本<br><img  src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart-text-mark-normal.png" alt="text Illustration" style="max-width: 100px"><br>2. 富文本，请参考<a href="vchart/demo/funnel-chart/funnel-template">使用示例</a><br><img   src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart-text-mark.png" alt="RichText Illustration" style="max-width: 300px"></td>
    </tr>
    <tr>
        <td>矩形</td>
        <td><code>registerRectMark</code></td>
        <td>矩形图元用于绘制矩形，可以用来创建柱状图等可视化效果，请参考<a href="/vchart/demo/custom/pie-extend-bars">使用示例</a><br><img  src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/custom-mark/pie-bar.png" alt="Rect Mark Illustration" style="max-width: 300px"></td>
    </tr>
    <tr>
        <td>图像</td>
        <td><code>registerImageMark</code></td>
        <td>图像图元用于在视化场景中插入图片，可以用来创建背景、图标等可视化效果，请参考<a href="vchart/demo/custom/bar-image-extension">使用示例</a><br><img  src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/custom-mark/bar-image-fill.png" alt="Image Mark Illustration" style="max-width: 300px"></td>
    </tr>
     <tr>
        <td>多边形</td>
        <td><code>registerPolygonMark</code></td>
        <td>多边形图元用于绘制（非闭合）多边形，可以用来创建漏斗图、凸包等可视化效果，请参考<a href="vchart/demo/funnel-chart/funnel-custom-annotation">使用示例</a><br><img  src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart-mark-polygon.png" alt="Polygon Mark Illustration" style="max-width: 300px"></td>
    </tr>
    <tr>
        <td>弧形</td>
        <td><code>registerArcMark</code></td>
        <td>弧形图元用于绘制圆弧，可以用来创建饼图、环形图等可视化效果。请参考<a href="vchart/demo/custom/pie-extension">使用示例</a><br><img  src="/vchart/preview/custom-pie-extension.png" alt="Arc Mark Illustration" style="max-width: 300px"></td>
    </tr>
    <tr>
        <td>分组</td>
        <td><code>registerGroupMark</code></td>
        <td>分组图元用于对多个图元进行收拢，以便对其进行统一操作，如缩放、平移等。需要注意的是，分组图元与其他基础图元不同，并不支持数据映射，请参考<a href="vchart/demo/marker/mark-area-quadrant">使用示例</a>。<br></td>
    </tr>
    <tr>
        <td>线</td>
        <td><code>registerLineMark</code></td>
        <td>线图元用于绘制折线，可以用来创建折线图等可视化效果。</td>
    </tr>
    <tr>
        <td>连线</td>
        <td><code>registerRuleMark</code></td>
        <td>主要是用于展示直线，最简单的使用场景就是用于图表中的辅助线的展示。</td>
    </tr>
    <tr>
        <td>面积</td>
        <td><code>registerAreaMark</code></td>
        <td>面积图元用于绘制封闭曲线与坐标轴之间的区域，可以用来创建面积图等可视化效果。</td>
    </tr>
    <tr>
        <td>路径</td>
        <td><code>registerPathMark</code></td>
        <td>路径图元用于绘制任意形状的路径，可以用来创建自定义的图形和地理轨迹等可视化效果。</td>
    </tr>
    <tr>
        <td>涟漪点</td>
        <td><code>registerRippleMark</code></td>
        <td>涟漪点图元是一种具有涟漪效果的点图元，通常用于强调某个特定的数据点或者表示某个位置上的数据变化。在地图可视化、时间序列分析等场景中，涟漪点图元可以表达数据的空间分布、数据变化的动态过程等。使用场景包括表示地震、疫情、新闻事件等的传播过程。</td>
    </tr>
    <tr>
        <td>3D 矩形</td>
        <td><code>registerRect3dMark</code></td>
        <td>三维矩形图元用于绘制长方体，可以用来创建三维可视化中的柱状图等可视化效果。</td>
    </tr>
    <tr>
        <td>3D 弧形</td>
        <td><code>registerRect3dMark</code></td>
        <td>三维弧形图元用于绘制柱体，可以用来创建三维可视化中的饼图、环形图等可视化效果。</td>
    </tr>
    <tr>
        <td>3D 金字塔</td>
        <td><code>registerPyramid3dMark</code></td>
        <td>三维金字塔图元用于绘制金字塔形状的六面体，可以用来创建三维可视化中的漏斗图等可视化效果。</td>
    </tr>
</table>

## 附录四：插件注册列表

<table>
    <tr>
        <td>插件</td>
        <td>插件注册方法</td>
    </tr>
    <tr>
        <td>全局形变动画</td>
        <td><code>registerMorph</code></td>
    </tr>
     <tr>
        <td>3d渲染</td>
        <td><code>register3DPlugin</code></td>
    </tr>
     <tr>
        <td>动画</td>
        <td><code>registerAnimate</code></td>
    </tr>
     <tr>
        <td>React插件</td>
        <td><code>registerReactAttributePlugin</code></td>
    </tr>
     <tr>
        <td>HTML插件</td>
        <td><code>registerHtmlAttributePlugin</code></td>
    </tr>
     <tr>
        <td>拖拽插件</td>
        <td><code>registerDragPlugin</code></td>
    </tr>
     <tr>
        <td>手势插件</td>
        <td><code>registerGesturePlugin</code></td>
    </tr>
     
</table>

## 附录五：交互注册列表

<table>
    <tr>
        <td>交互类型</td>
        <td>交互名称</td>
        <td>交互注册方法</td>
        <td>react-vchart是否默认注册</td>
        <td>taro-vchart是否默认注册</td>
    </tr>
    <tr>
        <td>`element-select`</td>
        <td>图元选中交互</td>
        <td><code>registerElementSelect</code></td>
        <td>是</td>
        <td>是</td>
    </tr>
    <tr>
        <td>`element-highlight`</td>
        <td>图元Hover交互</td>
        <td><code>registerElementHighlight</code></td>
        <td>是</td>
        <td>是</td>
    </tr>
    <tr>
        <td>`element-active`</td>
        <td>图元激活交互</td>
        <td><code>registerElementActive</code></td>
        <td>否</td>
        <td>否</td>
    </tr>
    <tr>
        <td>`element-highlight-by-legend`</td>
        <td>图例触发图元高亮、失焦状态</td>
        <td><code>registerElementHighlightByLegend</code></td>
        <td>否</td>
        <td>否</td>
    </tr>
    <tr>
        <td>`element-active-by-legend`</td>
        <td>图例触发图元激活状态</td>
        <td><code>registerElementActiveByLegend</code></td>
        <td>否</td>
        <td>否</td>
    </tr>
    <tr>
        <td>`element-highlight-by-group`</td>
        <td>图元分组高亮</td>
        <td><code>registerElementHighlightByGroup</code></td>
        <td>否</td>
        <td>否</td>
    </tr>
    <tr>
        <td>`element-highlight-by-key`</td>
        <td>图元按key值高亮</td>
        <td><code>registerElementHighlightByKey</code></td>
        <td>否</td>
        <td>否</td>
    </tr>
    <tr>
        <td>`element-highlight-by-name`</td>
        <td>图元按名称高亮</td>
        <td><code>registerElementHighlightByName</code></td>
        <td>否</td>
        <td>否</td>
    </tr>
</table>
