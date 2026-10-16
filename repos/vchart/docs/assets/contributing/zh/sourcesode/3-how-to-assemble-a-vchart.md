---
title: 3 如何“组装”一个 VChart 图表    

key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
前面的章节我们讲到了图表组成和基本原理，现在我们来看看如果通过声明式语法，来组装一个 VChart 图表。    

# 3.1 接口定义

一份基础的 spec 需包含以下部分：    

*  `type` 图表类型    

*  `data` 数据源    

*  数据映射，大部分情况下在直角坐标系中为 `xField` 和 `yField`，极坐标系下为 `categoryField` 和 `valueField`    

*  系列配置，VChart 的图表有 series 系列构成，系列下包含图元和 label，图元和 label 的配置都在系列配置中    

*  组件配置，如 `legends`、`axes` 等，除去组合图必须配置 `axes` 之外，其余图表的组件的配置其实是可选的，按需配置即可    

## 3.1.1 图表类型

在 spec 中我们首先要决定图表类型，例如：    

```Typescript
{
  "type": "bar"
}    

```
常见的图表类型有`bar`, `line`, `pie`，更多的图表类型可以参考接口文档： https://www.visactor.io/vchart/option    

注意有一种特殊的图表类型为 `common`, 这种类型是复合了多种图表类型 series 的图。后续会给出例子。    

## 3.1.2 数据源

数据是图表可视化的基础，我们需要在 spec 中指定数据源。通常情况下，数据以 JSON 格式表示，使用 `data` 字段指定。例如，我们可以将数据源指定为如下格式：    

```Typescript
{
  "data": [
    {
      "id": "barData",
      "values": [
        { "type": "A", "year": "1930", "value": 129 },
        { "type": "A", "year": "1940", "value": 133 },
        { "type": "A", "year": "1950", "value": 130 },
        { "type": "A", "year": "1960", "value": 126 },
        { "type": "A", "year": "1970", "value": 117 },
        { "type": "A", "year": "1980", "value": 114 },
        { "type": "A", "year": "1990", "value": 111 },
        { "type": "A", "year": "2000", "value": 89 },
        { "type": "A", "year": "2010", "value": 80 },
        { "type": "A", "year": "2018", "value": 80 },
        { "type": "B", "year": "1930", "value": 22 },
        { "type": "B", "year": "1940", "value": 13 },
        { "type": "B", "year": "1950", "value": 25 },
        { "type": "B", "year": "1960", "value": 29 },
        { "type": "B", "year": "1970", "value": 38 },
        { "type": "B", "year": "1980", "value": 41 },
        { "type": "B", "year": "1990", "value": 57 },
        { "type": "B", "year": "2000", "value": 87 },
        { "type": "B", "year": "2010", "value": 98 },
        { "type": "B", "year": "2018", "value": 99 }
      ]
    }
  ]
}    

```
其中 `id` 字段用于标识数据源，`values` 字段用于指定数据源的数据。    

在 VChart 中，多数情况下我们会期望使用`展平`的数据对象。`展平`的数据对象与`非展平`的数据对象区别见下方这个例子    

```Typescript
// 非展平数据对象
[
    {date: "Monday", class No.1: 20, class No.2: 30},
    {date: "Tuesday", class No.1: 25, class No.2: 28},
]
// 展平数据对象
[
    { date: "Monday", class: "class No.1", score: 20 },
    { date: "Monday", class: "class No.2", score: 30 },

    { date: "Tuesday", class: "class No.1", score: 25 },
    { date: "Tuesday", class: "class No.2", score: 28 },
]    

```
展平数据最重要的意义在于，可以使数据与图形产生一对一的对应关系。    

## 3.1.3 数据映射

接下来我们需要将数据映射到图的基本图形元素（marks）上。对于本教程的分组柱状图来说，我们指定 `xField`，`yField` 和 `seriesField`。其中 `xField`，`yField` 用于位置映射，`seriesField` 用于颜色映射    

```Typescript
{
  "xField": ["year", "type"],
  "yField": "value",
  "seriesField": "type"
}    

```
## 3.1.4 系列配置

系列指的是图片中的图表主体，比如折线图中的折线，后续会更详细地介绍    

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/sourcecode/img/MyP0bDrC5oCnraxw194cdlkAnac.gif' alt='' width='1000' height='auto' />

## 3.1.5 组件配置

VChart 还支持配置图表的各种组件，如坐标轴（axes）、图例(legends)、crosshair 和提示框（tooltip）等。目前 VChart 支持的组件有：    

# 3.2 系列

## 3.2.1 概念和类型

在VChart中，系列(Series)是可视化图表的核心构建块，负责将数据映射为可视化表达。一个系列代表一组相关的数据项，它们共享相同的可视化表现形式（如折线、柱状等）。系列是数据到图形的转换器，包含了数据处理、坐标映射、视觉编码等功能。每个系列类型都对应一种特定的可视化表现形式，具有独特的数据结构需求和视觉映射规则。    

### 基础和坐标系类

*  base: 系列的基础实现，提供所有系列共有的功能    

*  cartesian: 笛卡尔坐标系基类，用于X-Y轴系列    

*  polar: 极坐标系基类，用于环形和放射状系列    

*  geo: 地理坐标系基类，用于地图相关系列    

### 笛卡尔坐标系系列

*  bar: 柱状图/条形图，用于类别数据比较    

*  line: 折线图，展示数据趋势和变化    

*  area: 面积图，强调数据量的累积变化    

*  scatter: 散点图，展示数据点的分布    

*  box-plot: 箱线图，显示数据分布和异常值    

*  dot: 点图，简化的散点图    

*  heatmap: 热力图，用色彩强度表示数值大小    

*  range-area: 范围面积图，显示上下边界区域    

*  range-column: 范围柱状图，显示数据范围    

*  waterfall: 瀑布图，显示累积效应    

### 极坐标系系列

*  pie: 饼图，展示部分与整体关系    

*  rose: 玫瑰图，多维度数据的环形展示    

*  radar: 雷达图，多变量数据的放射状展示    

### 层次结构系列

*  treemap: 矩形树图，嵌套矩形展示层次结构    

*  sunburst: 旭日图，环形展示层次数据    

*  circle-packing: 圆形树图，嵌套圆形展示层次结构    

### 关系型系列

*  sankey: 桑基图，展示流量和转化关系    

*  correlation: 关联图，显示不同维度的相关性    

*  venn: 韦恩图，展示集合间的交集关系    

*  link: 链接图，展示实体间的连接    

### 特殊系列

*  funnel: 漏斗图，展示多阶段流程的转化率    

*  gauge: 仪表盘，展示单一指标的达成情况    

*  liquid: 水球图，用液体填充效果展示进度    

*  map: 地图系列，在地理空间上展示数据    

*  mosaic: 马赛克图，用矩形面积展示多维数据关系    

*  pictogram: 象形图，用图标表示数据    

*  progress: 进度条，线性展示完成度    

*  word-cloud: 词云图，基于词频展示文本数据    

## 3.2.2 系列数据管理

![](https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/sourcecode/img/HO0Nw3yr0hL76IbRjkOcCzlTn1f.gif)

### 初始化阶段

```Typescript
// packages/vchart/src/series/base/base-series.ts
  protected initData(): void {
    const d = this._spec.data ?? this._option.getSeriesData(this._spec.dataId, this._spec.dataIndex);
    if (d) {
      this._rawData = dataToDataView(d, this._dataSet, this._option.sourceDataList);
    }
    this._rawData?.target?.addListener('change', this.rawDataUpdate.bind(this));
    this._addDataIndexAndKey();
    // 初始化viewData
    if (this._rawData) {
      if (this.getStack()) {
        // 初始化viewDataFilter
        this._viewDataFilter = dataViewFromDataView(this._rawData, this._dataSet, {
          name: `${this.type}_${this.id}_viewDataFilter`
        });
      }

      // 初始化viewData
      const viewData = dataViewFromDataView(this.getStack() ? this._viewDataFilter : this._rawData, this._dataSet, {
        name: `${this.type}_${this.id}_viewData`
      });
      this._data = new SeriesData(this._option, viewData);

      if (this.getStack()) {
        this._viewDataFilter.target.removeListener('change', viewData.reRunAllTransform);
      }
    }

    this.initInvalidDataTransform();
  }    

```
1. 第一部分从 spec 的 data 或者 option 里面提取 data，转化成 DataView    

1. 然后注册 Listener，当数据变化时，触发 rawDataUpdate 函数    

1. 给 Data 增加 index 和 key    

1. 然后我们会生成不同层级的 DataView    

1. 如果需要堆叠的数据，我们创建一个中间 DataView    

1. 如果不需要堆叠的数据，直接创建 viewData，图表用来统计和渲染    

<div style="padding:5px;background-color: rgb(255, 245, 235);border-color: rgb(255, 245, 235);">DataView 是什么？    
它是对数据集合的一个视图封装，提供了一系列操作和转换数据的能力。可以将DataView理解为一个"智能数据容器"，它不仅存储数据，还能对数据进行各种处理和变换。    
</div>
```Typescript
// packages/vchart/src/series/base/base-series.ts
protected _statisticViewData() {
  registerDataSetInstanceTransform(this._dataSet, 'dimensionStatistics', dimensionStatistics);
  const viewDataStatisticsName = `${this.type}_${this.id}_viewDataStatic`;
  this._viewDataStatistics = new DataView(this._dataSet, { name: viewDataStatisticsName });
  this._viewDataStatistics.parse([this._data.getDataView()], {
    type: 'dataview'
  });
  this._viewDataStatistics.transform(
    {
      type: 'dimensionStatistics',
      options: {
        fields: () => {
          const fields = this.getStatisticFields();
          if (this._seriesField) {
            mergeFields(fields, [
              {
                key: this._seriesField,
                operations: ['values']
              }
            ]);
          }
          return fields;
        },
        target: 'latest'
      }
    },
    false
  );
  // ...
}    

```
创建一系列的统计数据，比如最大值，最小值等等。不同类型的图表生成的统计数据可能会不同。具体图表的 series 类，会实现这个 `abstract function getStatisticFields` 来控制生成什么 Statistics    

```xml
  abstract getStatisticFields(): {
    key: string;
    operations: StatisticOperations;
  }[];    

```
### 更新数据

#### 数据层

```Typescript
// 1. 原始数据视图
protected _rawData!: DataView;

// 2. 原始数据统计视图
protected _rawDataStatistics?: DataView;

// 3. 原始数据统计缓存
protected _rawStatisticsCache: Record<string, { values?: any[]; min?: number; max?: number }>;

// 4. 更新原始数据
updateRawData(d: any): void {
  if (!this._rawData) {
    return;
  }
  this._rawData.updateRawData(d);
}

// 5. 原始数据更新处理
rawDataUpdate(d: DataView): void {
  // 重新计算统计信息
  this._rawDataStatistics?.reRunAllTransform();
  // 清空缓存
  this._rawStatisticsCache = null;
  // 触发事件
  this.event.emit(ChartEvent.rawDataUpdate, { model: this });
}    

```
#### 过滤层

```Typescript
// 1. 数据过滤视图
protected _viewDataFilter: DataView = null;

// 2. 过滤完成处理
viewDataFilterOver(d: DataView): void {
  this.event.emit(ChartEvent.viewDataFilterOver, { model: this });
}

// 3. 添加数据过滤
addViewDataFilter(option: ITransformOptions) {
  (this._viewDataFilter ?? this.getViewData())?.transform(option, false);
}

// 4. 重新过滤数据
reFilterViewData() {
  (this._viewDataFilter ?? this.getViewData())?.reRunAllTransform();
}    

```
#### 视图层

```Typescript
// 1. 视图数据
protected _data: SeriesData = null;

// 2. 视图数据统计
protected _viewDataStatistics!: DataView;

// 3. 视图数据更新处理
viewDataUpdate(d: DataView): void {
  this.event.emit(ChartEvent.viewDataUpdate, { model: this });
  this._data?.updateData();
  this._viewDataStatistics && this._viewDataStatistics.reRunAllTransform();
}

// 4. 统计信息更新处理
viewDataStatisticsUpdate(d: DataView): void {
  this.event.emit(ChartEvent.viewDataStatisticsUpdate, { model: this });
}    

```
### 释放阶段

主要分为以下几个过程：    

```Typescript
release(): void {
  super.release();
  
  // 1. 清理视图数据映射
  this._viewDataMap.clear();
  
  // 2. 清理原始数据转换
  const transformIndex = this._rawData?.transformsArr?.findIndex(t => t.type === 'addVChartProperty');
  if (transformIndex >= 0) {
    this._rawData.transformsArr.splice(transformIndex, 1);
  }
  
  // 3. 释放系列数据
  this._data?.release();
  
  // 4. 清空数据引用
  this._dataSet = null;
  this._data = null;
  this._rawData = null;
  this._rawDataStatistics = null;
  this._viewDataStatistics = null;
  this._viewStackData = null;
}    

```
## 3.2.3 系列的图元创建

1. 根图元：    

*  作用：作为容器，组织和管理其他图元    

*  特点：必须是 group 类型    

*  位置：最顶层    

1. 系列图元：    

*  作用：实现图表的核心可视化功能，用于绘制系列 series    

*  特点：与具体图表类型相关    

*  位置：根图元下的主要图元    

1. 扩展图元：    

*  作用：提供额外的功能支持    

*  特点：可选的，用于增强图表功能，比如 label    

*  位置：根图元下的辅助图元    

![](https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/sourcecode/img/X2zBwLhMBhllo6bvdc6c8ReonPh.gif)

### 创建入口

```Typescript
// BaseSeries 中的 created 方法
created(): void {
  super.created();
  
  // 1. 构建图元属性上下文
  this._buildMarkAttributeContext();
  
  // 2. 初始化数据
  this.initData();
  this.initGroups();
  this.initStatisticalData();
  
  // 3. 初始化图元
  this.initRootMark();
  this.initMark();
  
  // 4. 初始化扩展图元
  const hasAnimation = isAnimationEnabledForSeries(this);
  this._initExtensionMark({ hasAnimation });
  
  // 5. 初始化样式和状态
  this.initMarkStyle();
  this.initMarkState();
  
  // 6. 初始化动画
  if (hasAnimation) {
    this.initAnimation();
  }
  
  // 7. 初始化交互
  if (!this._option.disableTriggerEvent) {
    this.initInteraction();
  }
  
  this.afterInitMark();
}    

```
### 根图元创建

```Typescript
initRootMark() {
  // 1. 创建根图元
  this._rootMark = this._createMark(
    { 
      type: MarkTypeEnum.group, 
      name: `seriesGroup_${this.type}_${this.id}` 
    },
    {
      parent: this._region.getGroupMark?.(),
      dataView: false
    }
  ) as IGroupMark;
  
  // 2. 设置层级
  this._rootMark.setMarkConfig({ 
    zIndex: this._spec.zIndex ?? this.layoutZIndex 
  });
}    

```
### 系列图元创建

```Typescript
// 创建图元的通用方法
protected _createMark<M extends IMark>(
  markInfo: ISeriesMarkInfo,
  option: ISeriesMarkInitOption = {},
  config: ICompileMarkConfig = {}
) {
  const {
    key,
    groupKey,
    skipBeforeLayouted,
    themeSpec = {},
    markSpec,
    dataView,
    dataProductId,
    parent,
    isSeriesMark,
    depend,
    stateSort,
    noSeparateStyle = false
  } = option;

  // 1. 创建图元
  const m = super._createMark<M>(markInfo, {
    key: key ?? this._getDataIdKey(),
    seriesId: this.id,
    attributeContext: this._markAttributeContext,
    componentType: option.componentType,
    noSeparateStyle
  });

  if (isValid(m)) {
    // 2. 添加到图元集合
    this._marks.addMark(m, { name: markInfo.name });

    // 3. 设置系列图元
    if (isSeriesMark) {
      this._seriesMark = m;
    }

    // 4. 设置父级关系
    if (isNil(parent)) {
      this._rootMark?.addMark(m);
    } else if (parent !== false) {
      parent.addMark(m);
    }

    // 5. 设置数据视图
    if (isNil(dataView)) {
      m.setDataView(this.getViewData(), this.getViewDataProductId());
      m.setSkipBeforeLayouted(true);
    } else if (dataView !== false) {
      m.setDataView(dataView, dataProductId);
    }

    // 6. 设置其他属性
    if (isBoolean(skipBeforeLayouted)) {
      m.setSkipBeforeLayouted(skipBeforeLayouted);
    }

    if (isValid(depend)) {
      m.setDepend(...array(depend));
    }

    if (!isNil(groupKey)) {
      m.setGroupKey(groupKey);
    }

    if (stateSort) {
      m.setStateSortCallback(stateSort);
    }

    // 7. 设置图元配置
    const markConfig: IMarkConfig = {
      ...config,
      morph: config.morph ?? false,
      support3d: is3DMark(markInfo.type as MarkTypeEnum) || 
                (config.support3d ?? (spec.support3d || !!(spec as any).zField)),
      morphKey: spec.morph?.morphKey || `${this.getSpecIndex()}_${this.getMarks().length}`,
      morphElementKey: spec.morph?.morphElementKey ?? config.morphElementKey
    };

    m.setMarkConfig(markConfig);

    // 8. 初始化样式
    this.initMarkStyleWithSpec(m, mergeSpec({}, themeSpec, markSpec || spec[m.name]));
  }
  return m;
}    

```
###  扩展图元初始化

```Typescript
protected _initExtensionMark(options: { hasAnimation: boolean; depend?: IMark[] }) {
  if (!this._spec.extensionMark) {
    return;
  }
  
  const mainMarks = this.getMarksWithoutRoot();
  options.depend = mainMarks;

  // 创建扩展图元
  this._spec.extensionMark?.forEach((m, i) => {
    this._createExtensionMark(
      m, 
      null, 
      this._getExtensionMarkNamePrefix(), 
      i, 
      options
    );
  });
}

private _createExtensionMark(
  spec: IExtensionMarkSpec<Exclude<EnableMarkType, 'group'>> | IExtensionGroupMarkSpec,
  parentMark: null | IGroupMark,
  namePrefix: string,
  index: number,
  options: { hasAnimation: boolean; depend?: IMark[] }
) {
  // 1. 创建扩展图元
  const mark = this._createMark(
    { 
      type: spec.type, 
      name: isValid(spec.name) ? `${spec.name}` : `${namePrefix}_${index}` 
    },
    {
      skipBeforeLayouted: true,
      markSpec: spec,
      parent: parentMark,
      dataView: false,
      componentType: spec.componentType,
      depend: options.depend,
      key: spec.dataKey
    },
    {
      setCustomizedShape: spec?.customShape
    }
  ) as IGroupMark;

  if (!mark) {
    return;
  }

  // 2. 设置用户ID
  if (isValid(spec.id)) {
    mark.setUserId(spec.id);
  }

  // 3. 设置动画
  if (options.hasAnimation) {
    const config = animationConfig(
      {}, 
      userAnimationConfig(spec.type, spec as any, this._markAttributeContext)
    );
    mark.setAnimationConfig(config);
  }

  // 4. 处理子图元
  if (spec.type === 'group') {
    namePrefix = `${namePrefix}_${index}`;
    spec.children?.forEach((s, i) => {
      this._createExtensionMark(s as any, mark, namePrefix, i, options);
    });
  } 
  // 5. 设置数据视图
  else if (!parentMark && (!isNil(spec.dataId) || !isNil(spec.dataIndex))) {
    const dataView = this._option.getSeriesData(spec.dataId, spec.dataIndex);
    if (dataView === this._rawData) {
      mark.setDataView(this.getViewData(), this.getViewDataProductId());
    } else {
      mark.setDataView(dataView);
      dataView.target.addListener('change', () => {
        mark.getData().updateData();
      });
    }
  }
}    

```
## 3.2.4 系列和`Region`之间的关系

Region 是 VChart 中的一个重要概念，它代表图表中的一个区域，用于组织和布局不同的图表组件。每个 Region 可以包含多个 Series，并且负责管理这些 Series 的布局和渲染。    

Series 使用 Region 的信息来布局：    

```Typescript
// packages/vchart/src/series/base/base-series.ts
export abstract class BaseSeries<T extends ISeriesSpec> extends BaseModel<T> implements ISeries {
  // Region 引用
  protected _region: IRegion = null as unknown as IRegion;
  
  // 获取关联的 Region
  getRegion(): IRegion {
    return this._region;
  }

  // 构造函数中设置 Region
  constructor(spec: T, options: ISeriesOption) {
    super(spec, options);
    this._region = options.region;
    this._dataSet = options.dataSet;
    this._spec?.name && (this.name = this._spec.name);
  }

  // 获取布局起始点
  getLayoutStartPoint(): ILayoutPoint {
    return this._region.getLayoutStartPoint();
  }

  // 获取布局矩形
  getLayoutRect: () => ILayoutRect = () => {
    return {
      width: this._layoutRect.width ?? this._region.getLayoutRect().width,
      height: this._layoutRect.height ?? this._region.getLayoutRect().height
    };
  };
}    

```
Region 可以增删 Series    

```Typescript
// packages/vchart/src/region/base/base-region.ts
export abstract class BaseRegion extends BaseModel implements IRegion {
  protected _series: ISeries[] = [];
  protected _groupMark: IGroupMark;
  
  // 添加系列
  addSeries(series: ISeries): void {
    this._series.push(series);
  }
  
  // 移除系列
  removeSeries(series: ISeries): void {
    const index = this._series.indexOf(series);
    if (index > -1) {
      this._series.splice(index, 1);
    }
  }
  
  // 获取所有系列
  getSeries(): ISeries[] {
    return this._series;
  }
  
  // 获取区域组图元
  getGroupMark(): IGroupMark {
    return this._groupMark;
  }
  
  // 等待所有系列过滤完成
  async waitAllSeriesFilterOver(): Promise<void> {
    const promises = this._series.map(series => {
      return new Promise<void>(resolve => {
        series.event.on(
          ChartEvent.viewDataFilterOver,
          { filter: ({ model }) => model?.id === series.id },
          () => resolve()
        );
      });
    });
    await Promise.all(promises);
  }
}    

```
# 3.3 图表组装

## 3.3.1 如何实现一个 Bar Chart

![](https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/sourcecode/img/XEDEwkYbbht2qtbVjejcFTLwnHh.gif)

首先，我们创建 BarChart 实例：    

```Typescript
// packages/vchart/src/chart/bar/bar.ts
export class BarChart<T extends IBarChartSpec = IBarChartSpec> extends BaseChart<T> {
  static readonly type: string = ChartTypeEnum.bar;
  static readonly seriesType: string = SeriesTypeEnum.bar;
  static readonly transformerConstructor = BarChartSpecTransformer;
  readonly transformerConstructor = BarChartSpecTransformer;
  readonly type: string = ChartTypeEnum.bar;
  readonly seriesType: string = SeriesTypeEnum.bar;
}

// 注册 Bar Chart
export const registerBarChart = () => {
  registerBarSeries();
  Factory.registerChart(BarChart.type, BarChart);
};    

```
然后会触发 BaseChart 的 constructor    

```Typescript
// packages/vchart/src/chart/base/base-chart.ts
constructor(spec: T, option: IChartOption) {
  super(option);
  this._paddingSpec = normalizeLayoutPaddingSpec(spec.padding ?? option.getTheme().padding);
  this._event = new Event(option.eventDispatcher, option.mode);
  this._dataSet = option.dataSet;
  this._chartData = new ChartData(this._dataSet);
  // ... 其他初始化
}    

```
### 创建元素

布局    

```Typescript
private _createLayout() {
  this._updateLayoutRect(this._viewBox);
  this._initLayoutFunc();
}

private _initLayoutFunc() {
  this._layoutFunc = this._option.layout;
  if (!this._layoutFunc) {
    const constructor = Factory.getLayoutInKey(this._spec.layout?.type ?? 'base');
    if (constructor) {
      const layout = new constructor(this._spec.layout, {
        onError: this._option?.onError
      });
      this._layoutFunc = layout.layoutItems.bind(layout);
    }
  }
}    

```
创建 Region 和 Series    

```Typescript
protected _createRegion(constructor: IRegionConstructor, specInfo: IModelSpecInfo) {
  if (!constructor) return;
  const { spec, ...others } = specInfo;
  const region = new constructor(spec, {
    ...this._modelOption,
    ...others
  });
  if (region) {
    region.created();
    this._regions.push(region);
  }
}

protected _createSeries(constructor: ISeriesConstructor, specInfo: IModelSpecInfo) {
  if (!constructor) return;
  const { spec, ...others } = specInfo;
  
  // 获取对应的区域
  let region: IRegion | undefined;
  if (isValid(spec.regionId)) {
    region = this.getRegionsInUserId(spec.regionId);
  } else if (isValid(spec.regionIndex)) {
    region = this.getRegionsInIndex([spec.regionIndex])[0];
  }
  
  if (!region && !(region = this._regions[0])) return;

  // 创建系列
  const series = new constructor(spec, {
    ...this._modelOption,
    ...others,
    type: spec.type,
    region,
    globalScale: this._globalScale,
    sourceDataList: this._chartData.dataList
  });

  if (series) {
    series.created();
    this._series.push(series);
    region.addSeries(series);
  }
}    

```
创建 Component    

```xml
  protected _createComponent(constructor: IComponentConstructor, specInfo: IModelSpecInfo) {
    const component = constructor.createComponent(specInfo, {
      ...this._modelOption,
      type: constructor.type,
      getAllRegions: this.getAllRegions,
      getRegionsInIndex: this.getRegionsInIndex,
      getRegionsInIds: this.getRegionsInIds,
      getRegionsInUserIdOrIndex: this.getRegionsInUserIdOrIndex,
      getAllSeries: this.getAllSeries,
      getSeriesInIndex: this.getSeriesInIndex,
      getSeriesInIds: this.getSeriesInIds,
      getSeriesInUserIdOrIndex: this.getSeriesInUserIdOrIndex,
      getAllComponents: this.getComponents,
      getComponentByIndex: this.getComponentByIndex,
      getComponentByUserId: this.getComponentByUserId,
      getComponentsByKey: this.getComponentsByKey,
      getComponentsByType: this.getComponentsByType
    });
    if (!component) {
      return;
    }
    component.created();
    this._components.push(component);
  }    

```
### 除图表可视元素外的其他部分

初始化事件    

```Typescript
  private _initEvent() {
    [ChartEvent.dataZoomChange, ChartEvent.scrollBarChange].forEach(event => {
      this._event.on(event, ({ value }) => {
        this._disableMarkAnimation(['exit', 'update']);
        const enableMarkAnimate = () => {
          this._enableMarkAnimation(['exit', 'update']);
          this._event.off(VGRAMMAR_HOOK_EVENT.AFTER_MARK_RENDER_END, enableMarkAnimate);
        };
        this._event.on(VGRAMMAR_HOOK_EVENT.AFTER_MARK_RENDER_END, enableMarkAnimate);
      });
    });
  }    

```
数据流处理    

```Typescript
reDataFlow() {
  this._series.forEach(s => s.getRawData()?.markRunning());
  this._series.forEach(s => s.fillData());
  this.updateGlobalScaleDomain();
}    

```
布局计算    

```xml
layout(params: ILayoutParams): void {
  if (this.getLayoutTag()) {
    this._event.emit(ChartEvent.layoutStart, { chart: this });
    this.onLayoutStart(params);
    const elements = this.getLayoutElements();
    this._layoutFunc(this, elements, this._layoutRect, this._viewBox);
    this._event.emit(ChartEvent.afterLayout, { elements, chart: this });
    this.setLayoutTag(false);
    this.onLayoutEnd(params);
    this._event.emit(ChartEvent.layoutEnd, { chart: this });
  }
}    

```
### 编译渲染

```Typescript
compile() {
  this.compileBackground();
  this.compileLayout();
  this.compileRegions();
  this.compileSeries();
  this.compileComponents();
}

compileSeries() {
  this._option.performanceHook?.beforeSeriesCompile?.();
  this.getAllSeries().forEach(s => {
    s.compile();
  });
  this._option.performanceHook?.afterSeriesCompile?.();
}    

```
## 3.3.2 Common chart

Common Chart 是 VChart 中的一个通用图表类型，它允许用户在一个图表中组合使用多个不同类型的系列（Series）。让我来详细分析它的实现。    

### 创建自适应系列类型

```Typescript
// packages/vchart/src/chart/common/common.ts
export class CommonChart<T extends ICommonChartSpec = ICommonChartSpec> extends BaseChart<AdaptiveSpec<T, 'series'>> {
  static readonly type: string = ChartTypeEnum.common;
  static readonly transformerConstructor = CommonChartSpecTransformer;
  readonly transformerConstructor = CommonChartSpecTransformer;
  readonly type: string = ChartTypeEnum.common;
}    

```
`AdaptiveSpec<T, 'series'>`，允许 Common Chart 接受任何类型的系列配置。    

### 系列注册机制

```Typescript
// packages/vchart/src/core/factory.ts
export class Factory {
  private static _seriesMap: Map<string, ISeriesConstructor> = new Map();
  
  static registerSeries(type: string, constructor: ISeriesConstructor) {
    this._seriesMap.set(type, constructor);
  }
  
  static getSeries(type: string): ISeriesConstructor {
    return this._seriesMap.get(type);
  }
}    

```
Common Chart 通过 Factory 模式实现了动态系列注册，这让 Common Chart 可以注册多个系列。    

### 对系列的特殊处理

我们需要详细看下面的三个函数    

```xml
// packages/vchart/src/chart/common/common-transformer.ts
protected _getDefaultSeriesSpec(spec: AdaptiveSpec<T, 'series'>) {
  const defaultSpec = super._getDefaultSeriesSpec(spec);
  // 删除默认的 data 配置
  delete defaultSpec.data;
  return defaultSpec;
}    

```
这个函数的作用是：    

*  获取系列的默认配置    

*  继承父类的默认配置    

*  删除默认的 data 配置    

*  原因：在组合图中，每个系列需要自己决定数据配置，不能使用统一的默认配置    

```Typescript
protected _transformAxisSpec(spec: AdaptiveSpec<T, 'series'>) {
  if (!spec.axes) return;
  
  if (!!spec.autoBandSize) {
    spec.series.forEach((series: any, seriesIndex: number) => {
      // 只处理柱状图系列
      if (series.type === 'bar') {
        // 找到对应的坐标轴
        const relatedAxis = this._findBandAxisBySeries(series, seriesIndex, spec.axes);
        if (relatedAxis && !relatedAxis.bandSize && !relatedAxis.maxBandSize && !relatedAxis.minBandSize) {
          // 处理柱状图的宽度配置
          const extend = isObject(series.autoBandSize) ? series.autoBandSize.extend ?? 0 : 0;
          const { barMaxWidth, barMinWidth, barWidth, barGapInGroup } = series;
          this._applyAxisBandSize(relatedAxis, extend, { barMaxWidth, barMinWidth, barWidth, barGapInGroup });
        }
      }
    });
  }
}    

```
这个函数的作用是：    

*  处理坐标轴的配置    

*  特别处理柱状图的宽度配置    

*  当启用 autoBandSize 时：    

*  遍历所有系列    

*  找到柱状图系列    

*  找到对应的坐标轴    

*  计算并设置柱子的宽度    

*  处理柱子的间距    

```Typescript
transformSpec(spec: AdaptiveSpec<T, 'series'>): void {
  // 1. 调用父类的转换方法
  super.transformSpec(spec);
  
  // 2. 处理系列配置
  if (spec.series && spec.series.length) {
    const defaultSeriesSpec = this._getDefaultSeriesSpec(spec);
    spec.series.forEach((s: ISeriesSpec) => {
      // 验证系列类型
      if (!this._isValidSeries(s.type)) {
        return;
      }
      // 应用默认配置
      Object.keys(defaultSeriesSpec).forEach(k => {
        if (!(k in s)) {
          s[k] = defaultSeriesSpec[k];
        }
      });
    });
  }

  // 3. 处理坐标轴配置
  if (spec.axes && spec.axes.length) {
    spec.axes.forEach((axis: any) => {
      // 处理坐标轴内边距
      if (get(axis, 'trimPadding')) {
        mergeSpec(axis, getTrimPaddingConfig(this.type, spec));
      }
    });
  }

  // 4. 处理坐标轴的 bandSize 配置
  this._transformAxisSpec(spec);
}    

```
这个函数是主要的转换入口，作用包括：    

*  调用父类的转换方法    

*  处理系列配置：    

*  获取默认配置    

*  验证系列类型    

*  应用默认配置    

*  处理坐标轴配置：    

*  处理内边距    

*  处理 bandSize    

这三个函数共同构成了 Common Chart 的配置转换系统，主要解决：    

1. 多系列配置的处理    

1. 柱状图特殊配置的处理    

1. 坐标轴配置的处理    

这是 Common Chart 区别于其他图表类型的关键实现。    



 # 本文档由以下人员修正整理 
 [玄魂](https://github.com/xuanhun)