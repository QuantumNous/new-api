---
title: 1 VChart 基本原理    

key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
# 1.1 图表组成

## 术语

1. Mark：基本图形元素（基本图元），如线、点、矩形等    

1. Series：负责特定类型数据的可视化表达，包含一组图元及其对应的图表逻辑，比如折线图中的一系列线    

1. Region：定义图表的空间区域，关联一组或多组 series，处理交互和动画，提供坐标系统    

1. Component：组件，帮助图表阅读和交互的元素，如图例、坐标轴、提示等    

1. Layout：管理图表的布局，包括 region 和 component 的位置和大小    

1. Chart：整个图表的抽象概念，包含视图上的元素比如 layout，component 和 region，也包含数据等所有构成一个表格需要的元素    

## 结构关系

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/sourcecode/img/HOM9w48WrhyL5hbEByTcG0BanGf.gif' alt='' width='534' height='auto' />

## 简单图表例子

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/sourcecode/img/S64ebNauBobOOJxwIalcq8E9ncf.gif' alt='' width='1000' height='auto' />

## 组合图表例子

### 同一个 Region

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/sourcecode/img/GAGOb6NrBoGdMrxHbt9cvDXNndb.gif' alt='' width='1000' height='auto' />

上图是一个组合图，简单来说就是有多组 series，上面是 bar 和 line 这两组 series。    

1. 如果我们没有特别配置，所有 series 都会关联在一个 region，所以他们会重叠在一起，并且共享某些坐标    

1. 每个系列可以有自己的数据源，也可以直接将数据源配置在 chart 上，series 中通过 `fromDataId` 或者 `fromDataIndex` 来关联，当前的例子我们选择配置在 chart 上    

### 不同 Region

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/sourcecode/img/FdZebrNhWo3MqTxoqOfcAyYJnh6.gif' alt='' width='1000' height='auto' />

在这个例子中，也是一个组合图，但是他的两组 series 出现在了不同的 region。如上文所说，我们用 layout 管理 region 的布局，在这个例子中，我们使用了如下代码：    

```Typescript
  layout: {
    type: 'grid',
    col: 4,
    row: 3,
    elements: [
      {
        modelId: 'legend',
        col: 0,
        colSpan: 4,
        row: 0
      },
      {
        modelId: 'pie-region',
        col: 0,
        colSpan: 2,
        row: 1
      },
      {
        modelId: 'axis-left',
        col: 2,
        row: 1
      },
      {
        modelId: 'bar-region',
        col: 3,
        row: 1
      },
      {
        modelId: 'axis-bottom',
        col: 3,
        row: 2
      }
    ]
  },    

```
上面通过了类似于 grid 的方式来管理 region 和 component 的布局。我们使用这些 `modelId` 来关联对应 region 和 component 的配置：    

```Typescript
  region: [
    {
      id: 'pie-region'
    },
    {
      id: 'bar-region'
    }
  ],
  axes: [
    {
      id: 'axis-left',
      regionId: 'bar-region',
      orient: 'left'
    },
    {
      id: 'axis-bottom',
      regionId: 'bar-region',
      orient: 'bottom'
    }
  ]    

```
# 1.2 VChart 架构与源码结构

## 1.2.1 VChart, VGrammar 和 VRender 的关系

这三者是 VisActor 可视化系统中的三个核心组件，它们的关系是层次化的，从底层到上层分别是：    

### VRender（底层）

VRender 是一个底层的可视化渲染引擎，负责最基本的图形绘制和渲染工作：    

*  它提供了丰富的可视化渲染功能，包括自定义动画、元素组合和叙事排列    

*  它是 VisActor 可视化系统的基础，为上层库提供渲染能力    

*  VRender 提供插件系统，可以灵活扩展    

*  它可以在 2D/3D 效果之间无缝切换    

*  它负责底层的 Canvas 操作、图形绘制、场景管理等    

### VGrammar（中层）

VGrammar 是基于 VRender 的可视化语法库：    

*  它使用声明式语法来描述数据可视化    

*  VGrammar 将数据与视觉元素映射起来，处理数据变换、标记、比例尺等    

*  它提供了更加高级的 API，简化了创建复杂可视化的过程    

*  VGrammar 负责图表的语法定义、数据映射、自动布局等    

*  它相当于是对 VRender 的进一步封装，增加了更多的可视化语法概念    

### VChart（上层）

VChart 是最上层的图表组件库：    

*  它基于 VGrammar 构建，封装了常见的图表类型（柱状图、饼图、折线图等）    

*  VChart 提供了开箱即用的图表组件，用户不需要了解底层的图形语法    

*  它具有跨平台特性，能自动适配桌面、H5 和多种小程序环境    

*  VChart 提供了完整的数据叙事能力，包括全面的注释、动画、流程控制和叙事模板    

*  它面向最终用户，提供了最友好的可视化界面和 API    

### 总结关系

这三者的架构关系可以理解为：    

```Typescript
VChart (图表组件库)
   ↓
VGrammar (可视化语法)
   ↓
VRender (渲染引擎)
   ↓
浏览器/Canvas/WebGL    

```
从代码实现上看：    

*  VChart 使用 VGrammar 来定义和构建图表    

*  VGrammar 使用 VRender 来进行实际的绘制和渲染    

*  最终，VRender 控制底层的 Canvas/WebGL 绘制图形    

这种分层架构使得开发者可以根据需要选择不同层次的工具：如果需要高度自定义的可视化，可以直接使用 VRender 或 VGrammar；如果需要快速创建标准图表，则可以使用 VChart。    

## 1.2.2 VChart 内部组件之间关系与源码结构

整体架构采用了模块化设计，核心分为以下几个主要部分：    

1. 核心引擎 (Core): VChart 的中心控制器，负责组织各模块协同工作    

1. 图表 (Chart): 各种图表类型的具体实现    

1. 系列 (Series): 负责图表中数据到图形的映射    

1. 标记 (Mark): 基础图形元素    

1. 区域 (Region): 定义图表渲染的区域    

1. 组件 (Component): 如坐标轴、图例等附加组件    

1. 布局 (Layout): 处理图表各元素的位置计算    

1. 事件 (Event): 处理用户交互    

1. 缩放 (Scale): 数据映射和比例尺相关    

1. 数据处理 (Data): 数据转换和处理    

### 核心模块

#### VChart 核心类

VChart 类是整个图表库的入口，它负责实例化和管理整个图表的生命周期。    

```Typescript
// packages/vchart/src/core/vchart.ts
export class VChart implements IVChart {
  readonly id = createID();
  
  // 用于注册图表、组件、系列等
  static useRegisters(comps: (() => void)[]) { ... }
  static useChart(charts: IChartConstructor[]) { ... }
  static useSeries(series: ISeriesConstructor[]) { ... }
  
  // 核心渲染流程
  renderSync(morphConfig?: IMorphConfig) { ... }
  async renderAsync(morphConfig?: IMorphConfig) { ... }
  
  // 数据更新方法
  updateData(id: StringOrNumber, data: DataView | Datum[] | string, ...) { ... }
  updateSpec(spec: ISpec, forceMerge: boolean = false, ...) { ... }
  
  // 状态管理
  setSelected(datum: MaybeArray<any> | null, ...) { ... }
  setHovered(datum: MaybeArray<Datum> | null, ...) { ... }
}    

```
VChart 的生命周期主要包括：    

1. 初始化配置与数据    

1. 创建图表实例    

1. 布局计算    

1. 渲染    

1. 交互事件处理    

1. 更新与销毁    

#### 模块图表类 (Chart)

图表模块实现了各种不同类型的图表，如柱状图、折线图、饼图等，都继承自 BaseChart。    

```Typescript
// packages/vchart/src/chart/base/base-chart.ts
export class BaseChart<T extends IChartSpec> extends CompilableBase implements IChart {
  readonly type: string = 'chart';
  readonly seriesType: string;
  
  protected _regions: IRegion[] = [];
  protected _series: ISeries[] = [];
  protected _components: IComponent[] = [];
  
  protected _layoutFunc: LayoutCallBack;
  protected _layoutRect: IRect = { ... };
  
  layout(params: ILayoutParams): void { ... }
  compile() { ... }
}    

```
比如 BarChart 继承自 BaseChart    

```Typescript
export class BarChart<T extends IBarChartSpec = IBarChartSpec> extends BaseChart<T> {
  static readonly type: string = ChartTypeEnum.bar;
  static readonly seriesType: string = SeriesTypeEnum.bar;
  static readonly transformerConstructor = BarChartSpecTransformer;
  readonly transformerConstructor = BarChartSpecTransformer;
  readonly type: string = ChartTypeEnum.bar;
  readonly seriesType: string = SeriesTypeEnum.bar;
}    

```
图表模块负责:    

*  确定图表类型和布局    

*  管理包含的区域、系列和组件    

*  处理数据到视觉元素的整体映射    

#### 系列模块 (Series)

系列模块是数据到视觉表现的核心映射，不同的系列类型对应不同的图形表现形式。    

```Typescript
// packages/vchart/src/series/base/base-series.ts
export abstract class BaseSeries<T extends ISeriesSpec> extends BaseModel<T> implements ISeries {
  readonly type: string = 'series';
  readonly coordinate: CoordinateType = 'none';
  
  protected _region: IRegion;
  protected _rootMark: IGroupMark = null;
  protected _seriesMark: Maybe<IMark> = null;
  
  protected _rawData!: DataView;
  protected _data: SeriesData = null;
  
  abstract initMark(): void;
  abstract initMarkStyle(): void;
  abstract dataToPosition(data: Datum, checkInViewData?: boolean): IPoint;
}    

```
系列模块负责:    

*  数据到图形标记的转换    

*  处理特定图表类型的数据映射    

*  管理标记的样式和状态    

#### 标记模块 (Mark)

标记是最基础的视觉元素，如线、矩形、点等，它们是构成图表的基本单位。相对应的代码在 `packages/vchart/src/mark `目录下有各种标记实现    

标记负责:    

*  实现具体的图形渲染    

*  处理交互状态（如高亮、选中）    

*  与数据进行绑定    

#### 区域模块 (Region)

区域定义了图表在画布中的渲染位置，可以包含多个系列。对应代码在 `packages/vchart/src/region`    

区域模块负责:    

*  确定图表中各个子区域的位置和大小    

*  管理其中包含的系列    

*  处理区域之间的布局关系    

#### 组件模块 (Component)

组件是图表中除了数据图形外的辅助元素，如坐标轴、图例、标题等。`packages/vchart/src/component` 目录下有各种组件实现    

组件模块负责:    

*  渲染各种辅助元素    

*  与用户交互（如图例的点击）    

*  与主图表的协同工作    

#### 布局模块 (Layout)

布局模块负责计算图表各个元素的位置和大小。对应代码在 `packages/vchart/src/layout`具体包括：    

*  元素位置的计算    

*  自适应容器大小的调整    

*  处理元素之间的层级关系    

#### 事件模块 (Event)

事件模块处理用户交互和内部事件。具体包括：    

*  处理用户交互事件（如点击、hover）    

*  分发内部事件    

*  触发数据更新和渲染更新    

#### 缩放模块 (Scale)

缩放模块负责数据到视觉属性的映射转换。具体包括：    

*  处理数据与视觉空间的映射    

*  管理各种比例尺（线性、离散、颜色等）    

*  计算坐标轴的范围和刻度    

#### 数据模块 (Data)

数据模块处理原始数据的转换和处理。具体包括：    

*  数据的解析和转换    

*  统计计算    

*  处理缺失值和异常值    

## 渲染流程

VChart 的渲染流程主要包括以下步骤：    

1. 初始化: 通过 spec 配置创建 VChart 实例    

1. 编译: 解析配置，创建各种组件和系列    

1. 布局: 计算各元素的位置和大小    

1. 数据处理: 处理和转换数据    

1. 渲染准备: 绑定数据到标记    

1. 实际渲染: 将标记绘制到画布    

1. 交互绑定: 绑定各种交互事件    

## 数据更新流程

当数据或配置发生变化时：    

1. 调用 updateData 或 updateSpec 方法    

1. 重新处理受影响的数据    

1. 更新相关比例尺    

1. 重新布局（如果需要）    

1. 更新受影响的标记    

1. 触发重新渲染    



 # 本文档由以下人员修正整理 
 [玄魂](https://github.com/xuanhun)