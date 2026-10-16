# 主题配置

如上节所述，图表主题（Theme）是 VChart 的一种强大特性，它提供了统一的配置方式来控制图表的全局样式、色板、图元、系列和组件样式等。使用图表主题能够让你的图表样式在整个项目中更具有统一性和可复用性，提升开发效率。

下面将详细介绍 VChart 的图表主题配置。

## 主题结构

主题配置由`ITheme`接口描述，大致可以分为 6 种配置：

```typescript
interface ITheme {
  /**
   * 第 1 种配置：主题信息
   */
  /** 主题命名 */
  name?: string;

  /**
   * 第 2 种配置：图表层级的样式属性
   */
  /** 图表背景色 */
  background?: string | IGradientColor;
  /** 图表内边距 */
  padding?: ILayoutPaddingSpec;
  /** 图表字体配置 */
  fontFamily?: string;

  /**
   * 第 3 种配置：色板
   */
  /** 全局色板 */
  colorScheme?: IThemeColorScheme;

  /**
   * 第 4 种配置：全局 mark 属性配置
   */
  /** 全局 mark 样式属性，按 mark 类别索引 */
  mark?: IGlobalMarkThemeByType;
  /** 全局 mark 样式属性，按 mark 名称索引，优先级更高 */
  markByName?: IGlobalMarkThemeByName;

  /**
   * 第 5 种配置：系列属性配置
   */
  /** 系列样式属性 */
  series?: ISeriesTheme;

  /**
   * 第 6 种配置：组件属性配置
   */
  /** 组件样式属性 */
  component?: IComponentTheme;
}
```

接下来，我们将详细介绍这些主题配置及其应用。

### 主题信息

包含 1 个配置：

- `ITheme.name`: 主题名称，用于标识主题。详见“自定义主题”小节。

### 图表层级的样式属性

全局样式配置用于设置图表整体样式，包括图表中的背景色、内间距、文本字体等。具体配置如下：

1. `ITheme.background`: 图表背景色。可以是纯色，如 '#FF0000'，表示图表背景为红色。也可以是渐变色配置，例如：

```json
{
  type: 'linear',
  x1: 0,
  y1: 0,
  x2: 100,
  y2: 100,
  colorStops: [
    { offset: 0, color: '#FF0000 },
    { offset: 0.5, color: '#00FF00' },
    { offset: 1, color: '#0000' }
  ]
}
```

2. `ITheme.padding`: 图表内边距，可分别配置 left, right, top 和 bottom。

3. `ITheme.fontFamily`: 图表默认字体配置。例如 `"Times New Roman"`等。

### 色板

包含 1 个配置：

- `ITheme.colorScheme`: 全局色板。

  全局色板用于设置图表的颜色方案，如数据系列的颜色，组件的颜色等。全局色板包括几种类型：

  1. 类型 `Array<string>` 是最简单的色板配置，直接提供一个颜色值数组。
  2. 类型 `ProgressiveDataScheme<string>` 是渐进式色板配置，允许同时存在多套色板方案，具体应用哪个色板需要靠执行用户回调来判断。
  3. 类型 `IColorSchemeStruct` 是功能最多的色板定义，包含了语色板和渐进式色板。

  以上这几种类型可以混合使用，以满足您在图表中对色彩的需要。这部分可详见“色板”小节。

### 全局图元属性配置

图表中的每个图形元素都是一个图元，例如点、线和柱状图里的矩形等。图元主题是根据图表中的基本图形元素类型配置的公共样式。

包含 2 个配置：

- `ITheme.mark`: 全局 mark 样式属性，按 mark 类别索引。其类型 `IGlobalMarkThemeByType`定义如下：

  ```typescript
  interface IGlobalMarkThemeByType {
    [MarkTypeEnum.line]?: Partial<ILineMarkSpec>;
    [MarkTypeEnum.symbol]?: Partial<ISymbolMarkSpec>;
    [MarkTypeEnum.area]?: Partial<IAreaMarkSpec>;
    [MarkTypeEnum.rect]?: Partial<IRectMarkSpec>;
    [MarkTypeEnum.arc]?: Partial<IArcMarkSpec>;
    [MarkTypeEnum.text]?: Partial<ITextMarkSpec>;
    [MarkTypeEnum.path]?: Partial<IPathMarkSpec>;
  }
  ```

  在 VChart 内部逻辑中，`ITheme.mark`的每个成员将**按照图元类型**合并到每个系列的各个图元的 spec 中。

- `ITheme.markByName`: 全局 mark 样式属性，按 mark 名称索引，优先级更高。
  这个配置项十分便于对多个系列的一些公共配置进行修改。其类型`IGlobalMarkThemeByName`定义如下：

  ```typescript
  interface IGlobalMarkThemeByName {
    /** used in lineSeries, areaSeries, radarSeries, etc. */
    line?: Partial<ILineMarkSpec>;
    /** used in lineSeries, areaSeries, radarSeries, scatterSeries etc. */
    point?: Partial<ISymbolMarkSpec>;
    /** used in lineSeries, areaSeries, radarSeries, etc. */
    area?: Partial<IAreaMarkSpec>;
    /** used in barSeries, rangeColumnSeries etc. */
    bar?: Partial<IRectMarkSpec>;
    /** used in many series */
    label?: Partial<ITextMarkSpec>;

    [markName: string]: any;
  }
  ```

  - line 图元样式配置，用于 line, area, radar 等系列。
  - point 图元样式配置。用于 line、area、radar、scatter 等系列。
  - area 图元样式配置，用于 line, area, radar 等系列。
  - bar 图元样式配置，用于 bar、rangeColumn 等系列。
  - label 图元样式配置，用于几乎所有系列。
  - 自定义图元样式配置，用户可以在此对象中添加任意 name-spec 对。在 VChart 内部逻辑中，`ITheme.markByName`的每个成员将**按照图元名称**合并到每个系列的各个图元的 spec 中。

关于不同类型图元 spec 的配置方法，请参考 VChart 配置文档中与图元相关的部分。

#### 图元主题配置与图元 spec 配置的区别

不难发现在上文中出现了类似于这样的主题类型定义：

```typescript
{
  [MarkTypeEnum.line]?: Partial<ILineMarkSpec>;
}
```

这其实体现了主题配置项的设计思路：**具体图表元素的主题配置（或者说样式配置）是 spec 的子集，理论上应该做到可以直接合并进 spec 配置中。**

事实上，为了区分图表元素 spec 和主题的区别，真实的主题配置类似于如下定义：

```typescript
{
  [MarkTypeEnum.line]?: Partial<IMarkTheme<ILineMarkSpec>>;
}
```

其中泛型`IMarkTheme`规范了在图元 spec 中，哪些属性可以作为主题配置。在教程文档中为了从简描述，默认省略了泛型`IMarkTheme`。

### 系列属性配置

图表中可能包含多个系列，如折线图系列、柱状图系列和饼图系列等。系列主题允许用户根据系列的不同类型为其设置特定的样式，例如每种类型的系列在颜色、外观和动画等方面的表现。

包含 1 个配置：

- `ITheme.series`: 系列样式属性，按系列类别索引。

  其类型`ISeriesTheme`的定义如下：

  ```typescript
  interface ISeriesTheme {
    [SeriesTypeEnum.bar]?: IBarSeriesTheme;
    [SeriesTypeEnum.bar3d]?: IBar3dSeriesTheme;
    [SeriesTypeEnum.line]?: ILineSeriesTheme;
    [SeriesTypeEnum.scatter]?: IScatterSeriesTheme;
    [SeriesTypeEnum.area]?: IAreaSeriesTheme;
    [SeriesTypeEnum.radar]?: IRadarSeriesTheme;
    [SeriesTypeEnum.pie]?: IPieSeriesTheme;
    [SeriesTypeEnum.pie3d]?: IPie3dSeriesTheme;
    [SeriesTypeEnum.rose]?: IRoseSeriesTheme;
    [SeriesTypeEnum.map]?: IMapSeriesTheme;
    [SeriesTypeEnum.circularProgress]?: ICircularProgressSeriesTheme;
    [SeriesTypeEnum.link]?: ILinkSeriesTheme;
    [SeriesTypeEnum.dot]?: IDotSeriesTheme;
    [SeriesTypeEnum.wordCloud]?: IWordCloudSeriesTheme;
    [SeriesTypeEnum.wordCloud3d]?: IWordCloud3dSeriesTheme;
    [SeriesTypeEnum.funnel]?: IFunnelSeriesTheme;
    [SeriesTypeEnum.funnel3d]?: IFunnel3dSeriesTheme;
    [SeriesTypeEnum.wordCloud]?: IWordCloudSeriesTheme;
    [SeriesTypeEnum.linearProgress]?: ILinearProgressSeriesTheme;
    [SeriesTypeEnum.waterfall]?: IWaterfallSeriesTheme;
    [SeriesTypeEnum.boxPlot]?: IBoxPlotSeriesTheme;
    [SeriesTypeEnum.treemap]?: ITreemapSeriesTheme;
    [SeriesTypeEnum.sankey]?: ISankeySeriesTheme;
    [SeriesTypeEnum.gauge]?: IGaugeSeriesTheme;
    [SeriesTypeEnum.gaugePointer]?: IGaugePointerSeriesTheme;
    [SeriesTypeEnum.sunburst]?: ISunburstSeriesTheme;
    [SeriesTypeEnum.rangeColumn]?: IRangeColumnSeriesTheme;
    [SeriesTypeEnum.circlePacking]?: ICirclePackingSeriesTheme;
    [SeriesTypeEnum.heatmap]?: IHeatmapSeriesTheme;
  }
  ```

  其中，对象里的 key 值为系列类型，value 值为系列主题。

  和图元主题类似的是，`IXxxSeriesTheme`也可以看做是系列 spec 的子集，在 VChart 内部逻辑中，`ITheme.series`的每个成员将**按照系列类型**合并到每个系列的 spec 中。

关于不同类型系列 spec 的配置方法，请参考 VChart 配置文档中与系列相关的部分。

### 组件属性配置

图表中可能包含多个组件，如坐标轴、图例、提示信息等。组件主题允许用户根据组件的不同类型为其设置特定的样式，如轴线颜色、刻度线长度、标题字体等。

包含 1 个配置：

- `ITheme.component`: 组件样式属性，按组件类别索引。

  其类型`IComponentTheme`的定义如下：

  ```typescript
  interface IComponentTheme {
    /**
     * 通用坐标轴配置
     */
    axis?: IAxisCommonTheme;
    /**
     * 离散轴的通用配置
     */
    axisBand?: IAxisCommonTheme;
    /**
     * 连续轴的通用配置
     */
    axisLinear?: IAxisCommonTheme;
    /**
     * 笛卡尔坐标系下 x 轴的配置
     */
    axisX?: ICartesianAxisCommonTheme;
    /**
     * 笛卡尔坐标系下 y 轴配置
     */
    axisY?: ICartesianAxisCommonTheme;
    /**
     * 极坐标系下半径轴配置
     */
    axisRadius?: IPolarAxisCommonTheme;
    /**
     * 极坐标系下角度轴配置
     */
    axisAngle?: IPolarAxisCommonTheme;
    /**
     * 离散图例配置
     */
    [ComponentTypeEnum.discreteLegend]?: IDiscreteLegendTheme;
    /**
     * 连续颜色图例配置
     */
    [ComponentTypeEnum.colorLegend]?: IColorLegendTheme;
    /**
     * 连续尺寸图例配置
     */
    [ComponentTypeEnum.sizeLegend]?: ISizeLegendTheme;
    /**
     * markLine 标记配置
     */
    [ComponentTypeEnum.markLine]?: IMarkLineTheme;
    /**
     * markArea 标记配置
     */
    [ComponentTypeEnum.markArea]?: IMarkAreaTheme;
    /**
     * markPoint 标记配置
     */
    [ComponentTypeEnum.markPoint]?: IMarkPointTheme;
    /**
     * tooltip 组件配置
     */
    [ComponentTypeEnum.tooltip]?: ITooltipTheme;
    /**
     * crosshair 配置
     */
    [ComponentTypeEnum.crosshair]?: ICrosshairTheme;
    /**
     * dataZoom 配置
     */
    [ComponentTypeEnum.dataZoom]?: IDataZoomTheme;
    /**
     * scrollbar 滚动条配置
     */
    [ComponentTypeEnum.scrollBar]?: IScrollBarTheme;
    /**
     * 指标卡组件配置
     */
    [ComponentTypeEnum.indicator]?: IIndicatorTheme;
    /**
     * 播放器配置
     */
    [ComponentTypeEnum.player]?: IPlayerTheme;
    /**
     * 框选配置
     */
    [ComponentTypeEnum.brush]?: IBrushTheme;
    /**
     * 图表标题配置
     */
    [ComponentTypeEnum.title]?: ITitleTheme;
    /**
     * 地图标签配置
     */
    [ComponentTypeEnum.mapLabel]?: IMapLabelTheme;
  }
  ```

  其中每个组件类型都对应一个主题配置`IXxxTheme`。和系列主题类似的是，这个类型是组件`IXxxSpec`的子集，包含该组件的所有样式配置。具体可参考对应组件的 spec。

  在 VChart 内部逻辑中，`ITheme.component`的每个成员将**按照组件类型**合并到每个组件的 spec 中。

  其中轴有一些公共配置：

  - `IComponentTheme.axis` 为所有轴的公共配置，但合并优先级最低。类型`IAxisCommonTheme`的定义如下：

    ```typescript
    interface IAxisCommonTheme {
      /** 网格线配置 */
      grid?: IGrid;
      /** 网格线配置 */
      subGrid?: IGrid;
      /** 轴线配置 */
      domainLine?: IDomainLine;
      /** 轴标签配置 */
      label?: ILabel;
      /** 轴标题配置 */
      title?: ITitle;
      /** 轴刻度线配置 */
      tick?: ITick;
      /** 轴刻度线配置 */
      subTick?: ITick;
    }
    ```

    具体配置项可参见轴组件 spec。

  - `IComponentTheme.axisBand` 和 `IComponentTheme.axisLinear` 分别为离散轴、连续轴的公共配置（不区分坐标系），优先级更高一些。类型同样为`IAxisCommonTheme`。

  - `IComponentTheme.axisX` 和 `IComponentTheme.axisY` 分别为平面直角坐标系两个轴的配置，优先级最高。类型为`ICartesianAxisCommonTheme`。类型定义如下：

  ```typescript
  interface ICartesianAxisCommonTheme {
    /** 网格线配置 */
    grid?: IGrid;
    /** 网格线配置 */
    subGrid?: IGrid;
    /** 轴线配置 */
    domainLine?: ICartesianDomainLine;
    /** 轴标签配置 */
    label?: ILabel;
    /** 轴标题配置 */
    title?: ICartesianTitle;
    /** 轴刻度线配置 */
    tick?: ITick;
    /** 轴刻度线配置 */
    subTick?: ITick;
    /**
     * 轴背景配置
     */
    background?: ICartesianAxisCommonSpec['background'];
  }
  ```

  具体配置项可参见轴组件 spec。

  - `IComponentTheme.axisAngle` 和 `IComponentTheme.axisRadius` 分别为平面极坐标系两个轴的配置，优先级同样最高。类型为`IPolarAxisCommonTheme`。类型定义如下：

  ```typescript
  interface IPolarAxisCommonTheme {
    /** 网格线配置 */
    grid?: IPolarGrid;
    /** 子网格线配置 */
    subGrid?: IPolarGrid;
    /** 轴线配置 */
    domainLine?: IDomainLine;
    /** 轴标签配置 */
    label?: ILabel;
    /** 轴标题配置 */
    title?: ITitle;
    /** 轴刻度线配置 */
    tick?: ITick;
    /** 轴子刻度线配置 */
    subTick?: ITick;
  }
  ```

  具体配置项可参见轴组件 spec。

下一节将详细讲述 VChart 的色板配置功能。
