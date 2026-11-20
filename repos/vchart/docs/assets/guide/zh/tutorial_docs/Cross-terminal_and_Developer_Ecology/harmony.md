# Harmony VChart

- 仓库地址：[https://github.com/VisActor/VChart/tree/main/packages/harmony-vchart](https://github.com/VisActor/VChart/tree/main/packages/harmony-vchart)

HarmonyOS 是华为研发的智能终端操作系统，以 ArkTS 为主要开发语言，VChart 从 1.11.1 版本开始，支持兼容 HarmonyOS 的图表开发（支持 HarmonyOS API 9 以上）。

OpenHarmony 是由开放原子开源基金会（OpenAtom Foundation）孵化及运营的开源项目，目标是面向全场景、全连接、全智能时代，基于开源的方式，搭建一个智能终端设备操作系统的框架和平台，促进万物互联产业的繁荣发展。VChart 同时也兼容 OpenHarmony 应用开发的图表开发（支持 API 10 Release 以上）

为了方便 Harmony 技术栈的同学更好的使用，我们提供了 VChart 的 HarmonyOS 封装包`@visactor/harmony-vchart`（此包不是 NPM 包，是 OHPM 包），该组件的 spec 配置项与 VChart 一致，该包在 HarmonyOS 和 OpenHarmony 应用开发环境中的使用是一致的

我们将在本教程中详细讲解如在 Harmony 项目中使用 VChart，并创建一个简单的柱状图。

## 效果展示

<div style="text-align: center;">
  <img style="width: 160px; height: 360px;" crossorigin="anonymous" src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/harmony-vchart-example-dualaxis.png" alt="Harmony VChart示例">
  <img style="width: 160px; height: 360px;" crossorigin="anonymous" src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/harmony-vchart-example-funnel.png" alt="Harmony VChart示例">
  <img style="width: 160px; height: 360px;" crossorigin="anonymous" src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/harmony-vchart-example-scatter.png" alt="Harmony VChart示例">
  <img style="width: 160px; height: 360px;" crossorigin="anonymous" src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/harmony-vchart-example-area.png" alt="Harmony VChart示例">
  <img style="width: 160px; height: 360px;" crossorigin="anonymous" src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/harmony-vchart-example-ring.png" alt="Harmony VChart示例">
  <img style="width: 160px; height: 360px;" crossorigin="anonymous" src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/harmony-vchart-example-rose.png" alt="Harmony VChart示例">
  <img style="width: 160px; height: 360px;" crossorigin="anonymous" src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/harmony-vchart-example-sankey.png" alt="Harmony VChart示例">
  <img style="width: 160px; height: 360px;" crossorigin="anonymous" src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/harmony-vchart-example-wordcloud.png" alt="Harmony VChart示例">
  <img crossorigin="anonymous" src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/harmony-vchart-demo-low-quality.gif" alt="Harmony VChart示例">
</div>

## 快速上手

本文假设用户已了解并会使用 HarmonyOS，具体 HarmonyOS 的相关知识，请参考[HarmonyOS 开发者平台](https://developer.huawei.com/consumer/cn/)

### 如何安装

要开始使用 Harmony VChart，首先需要在你的 Harmony 项目中安装 `@visactor/harmony-vchart` 包。在项目根目录下，使用以下命令安装该包：

```
ohpm install @visactor/harmony-vchart
```

### 创建图表

以创建一个简单的状图为例。在你的 Harmony 组件中，引入 `visactor/harmony-vchart` 的 `<BarChart>` 组件，并在组件中使用它们。下面是一个创建柱状图的示例代码：

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

在这个示例中，我们创建了一个简单的柱状图，使用了一些基本的组件和配置。

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/350c0511133d336e622523213.png" alt="柱状图示例">
</div>

## 统一图表标签 `<VChart />`

`<VChart />` 接收的一个完整的**spec**作为图表定义，其**spec**的数据结构完全等同于 VChart 中的定义，因此开发者可以将任何对于 VChart 合法的 spec 送入 Harmony-VChart 中进行图表渲染。

### Props

如果你已经有了 spec 图表描述信息，使用统一图表标签是比较快捷的方式，只需要引入`VChart`组件即可：

```typescript
import { VChart } from '@visactor/harmony-vchart';
```

`VChart`组件即封装的 Harmony 组件，其 props 定义如下：

```typescript
interface VChartProps extends EventsProps {
  /** 图表定义 */
  spec: any;
  /** 图表配置 */
  options?: IInitOption;
  /**
   * 图表初始化的回调
   * @param vchart
   */
  onChartInitCb?: (vchart: VChartConstructor) => void;
  /**
   * 图表准备好的回调(第一次渲染完成)
   * @param vchart
   */
  onChartReadyCb?: (vchart: VChartConstructor) => void;
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

```typescript
export interface IInitOption {
  /**
   * 图表开始渲染的回调
   * @param vchart
   */
  beforeRender?: (stage: Object) => void;
  /**
   * 渲染完成的回调
   * @param vchart
   */
  afterRender?: (stage: Object) => void;
  /**
   * 启用的插件列表
   */
  pluginList?: string[];
  /** 数据集 */
  dataSet?: Object;
  /**
   * 是否开启动画
   */
  animation?: boolean;
  /**
   * 当文本省略时，鼠标 hover 到文本上时是否显示 poptip
   * @default true
   */
  poptip?: boolean;

  /**
   * 报错的回调函数
   * @since 1.2.0
   */
  onError?: () => void;

  /**
   * 默认主题（支持完整主题对象或者主题名称，主题名称需要提前在 `ThemeManager` 中注册）
   * @since 1.3.0
   */
  theme?: string;
}
```

`EventsProps` 的定义参考事件交互章节

`onReady`是一个内置的回调事件，会在图表渲染或更新时触发，其入参分别代表图表实例对象，以及是否初次渲染。

举例来说，开发者可以在初次渲染时，将需要触发的回调事件注册在图表实例上以实现图表交互功能。

## 按需加载 `<VChartSimple />`

> 注意，目前鸿蒙的IDE并不支持代码tree-shaking，所以此种引入形式目前仅可作为一种实验性的方案。

一般情况下，作为移动端应用，包体积并不会非常影响业务，但在某些场景中（比如元服务）会对包体积有严格的要求，因此我们提供了按需加载的方式，使用`VChartSimple`标签。其使用上和`VChart`的使用方式基本一致，只是需要调用额外的注册函数注册所需要的组件。

### 注册组件
在使用`VChartSimple`标签时，需要先注册所需要的组件和图表（我们内置了柱图、线图、饼图的基本功能，其他功能需要按需注册），可以调用的函数如下：
```ts
import {
  // 图表
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
  // 注册组件
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

// 注册布局
  registerGridLayout,

// vgrammar interactions,
  registerElementHighlight,
  registerElementSelect,
  // 注册动画
  registerAnimate
} from '@visactor/harmony-vchart';
```
### demo

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
        Text(`每一帧耗时：${this.delta}`)
        // VisActor()
      }
      .width('100%')
    }
    .height('100%')
  }
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

## 总结

通过本教程，你应该已经学会了如何在 Harmony 项目中使用 VChart 图表创建一个简单的柱状图。同时，你还了解了如何根据需求配置图表，以满足项目中不同的场景。VChart 提供了丰富的配置选项和组件，相信你在实际项目中会更好地掌握它们的使用，并发挥出更大的作用。希望你能在项目中愉快地使用 VChart 表库！

## 🔗 相关链接

- [Homepage](https://www.visactor.io/vchart)
- [VCharts Gallery](https://www.visactor.io/vchart/example)
- [VChart Tutorials](https://www.visactor.io/vchart/guide/tutorial_docs/VChart_Website_Guide)
- [VChart Options](https://www.visactor.io/vchart/option/)
- [VChart API](https://www.visactor.io/vchart/api/API/vchart)
- [VGrammar](https://www.visactor.io/vgrammar)
- [VRender](https://www.visactor.io/vrender)
- [FAQ](https://www.visactor.io/vchart/guide/tutorial_docs/FAQ)
- [CodeSandbox Template](https://codesandbox.io/s/the-template-of-visactor-vchart-vl84ww?file=/src/index.ts) for bug reports
