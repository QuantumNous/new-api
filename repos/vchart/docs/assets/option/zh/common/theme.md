{{ target: common-theme }}

<!-- ITheme -->

## theme(Object|string)

图表上的主题定义，支持直接在配置项上声明已注册的主题名（string 类型）。

主题配置由`ITheme`接口描述，大致可以分为 6 种配置：

```ts
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

### name(string)

主题命名，用于标识主题。

### background(string|Object)

图表背景色，可以配置纯色或渐变色。

### padding(number|number[]|Object)

{{ use: common-layout-padding(
  prefix = '###'
) }}

### fontFamily(string)

图表默认字体配置。

### colorScheme(IThemeColorScheme)

全局色板配置。

`IThemeColorScheme`的类型声明为：

```ts
type IThemeColorScheme = {
  /** 必选 */
  default: ColorScheme;
} & Partial<Record<SeriesTypeEnum, ColorScheme>>;
```

色板配置接受一个对象，包含默认色板（`IThemeColorScheme.default`）和针对不同系列的特定色板。

例如，如果希望词云系列的色板与默认色板不同，可以这样配置：

```ts
const colorScheme: IThemeColorScheme = {
  /** 默认色板 */
  default: ['red', 'blue', 'green'],
  /** 词云系列专用色板 */
  wordCloud: ['#98abc5', '#8a89a6', '#7b6888', '#6b486b', '#a05d56', '#d0743c', '#ff8c00']
};
```

#### default(Array<string>|ProgressiveDataScheme<string>|IColorSchemeStruct)

默认色板配置。

色板配置类型`ColorScheme`的类型声明为：

```ts
type ColorScheme = Array<string> | ProgressiveDataScheme<string> | IColorSchemeStruct;
```

意味着有 3 种类型可以配到色板里。

- 第一种类型`Array<string>`为字符串数组，这是最简易的色板。可以这样配置：

  ```ts
  const colorScheme: IThemeColorScheme = {
    /** 默认色板 */
    default: ['red', 'blue', 'green', '#98abc5', 'rgb(255, 128, 0)']
  };
  ```

- 第二种类型`ProgressiveDataScheme<string>`为渐进式色板。渐进式色板允许同时存在多套色板方案，具体应用哪个色板需要靠执行用户回调来判断。`ProgressiveDataScheme`的类型定义如下：

  ```ts
  /** 渐进式数据色板：由多个色板组成，应用时会依次判断色板上附带的条件（如 `isAvailable` 回调），如果满足条件则立即应用对应色板 */
  type ProgressiveDataScheme<T> = Array<IProgressiveDataSchemeCase<T>>;

  interface IProgressiveDataSchemeCase<T> {
    /** 可选，适合此色板的最大 domain 数量 */
    maxDomainLength?: number;
    /** 可选，更加灵活的自定义回调，返回是否应用此色板。将覆盖 maxDomainLength 等配置 */
    isAvailable?: boolean | ((domain: any[]) => boolean);
    /** 色板 */
    scheme: T[];
  }
  ```

  用户可以通过配置`maxDomainLength`或者`isAvailable`来给色板分档。在`isAvailable`回调中，参数`domain`将传递本次色板应用的 domain 信息。

  例：通过`maxDomainLength`配置给色板分档

  ```ts
  const colorScheme: IThemeColorScheme = {
    default: [
      // 第一档颜色（数据项 <= 10）
      {
        maxDomainLength: 10,
        scheme: [
          '#1664FF',
          '#1AC6FF',
          '#FF8A00',
          '#3CC780',
          '#7442D4',
          '#FFC400',
          '#304D77',
          '#B48DEB',
          '#009488',
          '#FF7DDA'
        ]
      },
      // 第二档颜色（数据项 > 10）
      {
        scheme: [
          '#1664FF',
          '#B2CFFF',
          '#1AC6FF',
          '#94EFFF',
          '#FF8A00',
          '#FFCE7A',
          '#3CC780',
          '#B9EDCD',
          '#7442D4',
          '#DDC5FA',
          '#FFC400',
          '#FAE878',
          '#304D77',
          '#8B959E',
          '#B48DEB',
          '#EFE3FF',
          '#009488',
          '#59BAA8',
          '#FF7DDA',
          '#FFCFEE'
        ]
      }
    ]
  };
  ```

- 第三种类型`IColorSchemeStruct`包含了语义色板和渐进式色板，是功能最多的色板定义。`IColorSchemeStruct`的类型定义为：

  ```ts
  /** 色板总结构，包含数据色板和语义色板 */
  type IColorSchemeStruct = {
    /** 数据色板 */
    dataScheme: Array<DataSchemeItem> | ProgressiveDataScheme<DataSchemeItem>;

    /** 语义色板 */
    palette?: {
      /** 用户自定义语义化色值 */
      [key: string]: ColorSchemeItem;
    };
  };
  ```

  其中：

  - `dataScheme` 支持传入上述两种基本色板类型，对应着数据项作为 domain 应用的数据色板。
  - 而`palette`为语义色板，可以理解为颜色字典，由 key-value 对组成。

  例如，将上一个示例进行扩展，加上语义色板就可以改写为：

  ```ts
  const colorScheme: IThemeColorScheme = {
    default: {
      // 数据色板
      dataScheme: [
        // 第一档颜色（数据项 <= 10）
        {
          maxDomainLength: 10,
          scheme: [
            '#1664FF',
            '#1AC6FF',
            '#FF8A00',
            '#3CC780',
            '#7442D4',
            '#FFC400',
            '#304D77',
            '#B48DEB',
            '#009488',
            '#FF7DDA'
          ]
        },
        // 第二档颜色（数据项 > 10）
        {
          scheme: [
            '#1664FF',
            '#B2CFFF',
            '#1AC6FF',
            '#94EFFF',
            '#FF8A00',
            '#FFCE7A',
            '#3CC780',
            '#B9EDCD',
            '#7442D4',
            '#DDC5FA',
            '#FFC400',
            '#FAE878',
            '#304D77',
            '#8B959E',
            '#B48DEB',
            '#EFE3FF',
            '#009488',
            '#59BAA8',
            '#FF7DDA',
            '#FFCFEE'
          ]
        }
      ],
      // 语义色板
      palette: {
        labelFontColor: '#89909D',
        primaryFontColor: '#000000',
        axisGridColor: '#EBEDF2',
        axisDomainColor: '#D9DDE4'
      }
    }
  };
  ```

  注意语义色板部分的配置：

  ```ts
  {
    ...
    // 语义色板
    palette: {
      labelFontColor: '#89909D',
      primaryFontColor: '#000000',
      axisGridColor: '#EBEDF2',
      axisDomainColor: '#D9DDE4'
    }
  }
  ```

  应用了这样的语义色板，在用户的 spec 各处就可以做到通过 key 值来取色。例如，在 spec 中配置轴样式：

  ```ts
  const chartSpec = {
    ...图表 spec
    axis: [{
      orient: 'bottom',
      type: 'band',
      domainLine: {
        visible: true,
        style: {
          lineWidth: 1,
          stroke: { type: 'palette', key: 'axisDomainColor' }, // 语义色值
          strokeOpacity: 1
        }
      },
      grid: {
        visible: true,
        style: {
          lineWidth: 1,
          stroke: { type: 'palette', key: 'axisGridColor' }, // 语义色值
          strokeOpacity: 1,
          lineDash: []
        }
      },
      subGrid: {
        visible: false,
        style: {
          lineWidth: 1,
          stroke: { type: 'palette', key: 'axisGridColor' }, // 语义色值
          strokeOpacity: 1,
          lineDash: [4, 4]
        }
      },
      tick: {
        visible: true,
        tickSize: THEME_CONSTANTS.AXIS_TICK_SIZE,
        style: {
          lineWidth: 1,
          stroke: { type: 'palette', key: 'axisDomainColor' }, // 语义色值
          strokeOpacity: 1
        }
      },
      subTick: {
        visible: false,
        tickSize: THEME_CONSTANTS.AXIS_TICK_SIZE / 2,
        style: {
          lineWidth: 1,
          stroke: { type: 'palette', key: 'axisDomainColor' }, // 语义色值
          strokeOpacity: 1
        }
      },
      label: {
        visible: true,
        space: 10,
        style: {
          fontSize: THEME_CONSTANTS.LABEL_FONT_SIZE,
          fill: { type: 'palette', key: 'labelFontColor' }, // 语义色值
          fontWeight: 'normal',
          fillOpacity: 1
        }
      }
    }];
  }
  ```

  示例中多次出现了通过`IColorKey`结构引用语义颜色的配置。`IColorKey`的类型定义为：

  ```ts
  /** 语义化色值的色值索引 */
  interface IColorKey {
    /** 颜色type声明 */
    type: 'palette';

    /** 颜色索引 */
    key: string;

    /** 明度系数（可选，0~1） */
    l?: number;

    /** 透明度系数（可选，0~1） */
    a?: number;
  }
  ```

### mark(IGlobalMarkThemeByType)

全局 mark 样式属性，按 mark 类别索引。

`IGlobalMarkThemeByType`类型定义如下：

```ts
interface IGlobalMarkThemeByType {
  [MarkTypeEnum.line]?: Partial<IMarkTheme<ILineMarkSpec>>;
  [MarkTypeEnum.symbol]?: Partial<IMarkTheme<ISymbolMarkSpec>>;
  [MarkTypeEnum.area]?: Partial<IMarkTheme<IAreaMarkSpec>>;
  [MarkTypeEnum.rect]?: Partial<IMarkTheme<IRectMarkSpec>>;
  [MarkTypeEnum.arc]?: Partial<IMarkTheme<IArcMarkSpec>>;
  [MarkTypeEnum.text]?: Partial<IMarkTheme<ITextMarkSpec>>;
  [MarkTypeEnum.path]?: Partial<IMarkTheme<IPathMarkSpec>>;
}
```

#### line(Object)

line 图元样式配置。

{{ use: common-mark(
  prefix = '####'
) }}

##### style(Object)

{{ use: mark-style(
  markName = 'line'
) }}

{{ use: mark-line(
  prefix = '#####'
) }}

##### state(Object)

{{ use: mark-state-style() }}

#### symbol(Object)

symbol 图元样式配置。

{{ use: common-mark(
  prefix = '####'
) }}

##### style(Object)

{{ use: mark-style(
  markName = 'point'
) }}

{{ use: mark-point(
  prefix = '#####'
) }}

##### state(Object)

{{ use: mark-state-style() }}

#### area(Object)

area 图元样式配置。

{{ use: common-mark(
  prefix = '####'
) }}

##### style(Object)

{{ use: mark-style(
  markName = 'area'
) }}

{{ use: mark-area(
  prefix = '#####'
) }}

##### state(Object)

{{ use: mark-state-style() }}

#### rect(Object)

rect 图元样式配置。

{{ use: common-mark(
  prefix = '####'
) }}

##### style(Object)

{{ use: mark-style(
  markName = 'rect'
) }}

{{ use: mark-rect(
  prefix = '#####'
) }}

##### state(Object)

{{ use: mark-state-style() }}

#### arc(Object)

arc 图元样式配置。

{{ use: common-mark(
  prefix = '####'
) }}

##### style(Object)

{{ use: mark-style(
  markName = 'arc'
) }}

{{ use: mark-arc(
  prefix = '#####'
) }}

##### state(Object)

{{ use: mark-state-style() }}

#### text(Object)

text 图元样式配置。

{{ use: common-mark(
  prefix = '####'
) }}

##### style(Object)

{{ use: mark-style(
  markName = 'text'
) }}

{{ use: mark-text(
  prefix = '#####'
) }}

##### state(Object)

{{ use: mark-state-style() }}

#### path(Object)

path 图元样式配置。

{{ use: common-mark(
  prefix = '####'
) }}

##### style(Object)

{{ use: mark-style(
  markName = 'path'
) }}

{{ use: mark-path(
  prefix = '#####'
) }}

##### state(Object)

{{ use: mark-state-style() }}

### markByName(IGlobalMarkThemeByName)

全局 mark 样式属性，按 mark name 索引。

这个配置项十分便于对多个系列的一些公共配置进行修改。

`IGlobalMarkThemeByName`类型定义如下：

```ts
interface IGlobalMarkThemeByName {
  /** used in lineSeries, areaSeries, radarSeries, etc. */
  line?: Partial<IMarkTheme<ILineMarkSpec>>;
  /** used in lineSeries, areaSeries, radarSeries, scatterSeries etc. */
  point?: Partial<IMarkTheme<ISymbolMarkSpec>>;
  /** used in lineSeries, areaSeries, radarSeries, etc. */
  area?: Partial<IMarkTheme<IAreaMarkSpec>>;
  /** used in barSeries, rangeColumnSeries etc. */
  bar?: Partial<IMarkTheme<IRectMarkSpec>>;
  /** used in many series */
  label?: Partial<IMarkTheme<ITextMarkSpec>>;

  [markName: string]: Partial<IMarkTheme<any>>;
}
```

#### line(Object)

line 图元样式配置，用于 line, area, radar 等系列。

{{ use: common-mark(
  prefix = '####'
) }}

##### style(Object)

{{ use: mark-style(
  markName = 'line'
) }}

{{ use: mark-line(
  prefix = '#####'
) }}

##### state(Object)

{{ use: mark-state-style() }}

#### point(Object)

point 图元样式配置。用于 line、area、radar、scatter 等系列。

{{ use: common-mark(
  prefix = '####'
) }}

##### style(Object)

{{ use: mark-style(
  markName = 'point'
) }}

{{ use: mark-point(
  prefix = '#####'
) }}

##### state(Object)

{{ use: mark-state-style() }}

#### area(Object)

area 图元样式配置，用于 line, area, radar 等系列。

{{ use: common-mark(
  prefix = '####'
) }}

##### style(Object)

{{ use: mark-style(
  markName = 'area'
) }}

{{ use: mark-area(
  prefix = '#####'
) }}

##### state(Object)

{{ use: mark-state-style() }}

#### bar(Object)

bar 图元样式配置，用于 bar、rangeColumn 等系列。

{{ use: common-mark(
  prefix = '####'
) }}

##### style(Object)

{{ use: mark-style(
  markName = 'bar'
) }}

{{ use: mark-rect(
  prefix = '#####'
) }}

##### state(Object)

{{ use: mark-state-style() }}

#### label(Object)

label 图元样式配置，用于几乎所有系列。

{{ use: common-mark(
  prefix = '####'
) }}

##### style(Object)

{{ use: mark-style(
  markName = 'label'
) }}

{{ use: mark-text(
  prefix = '#####'
) }}

##### state(Object)

{{ use: mark-state-style() }}

### series(ISeriesTheme)

系列样式属性，按系列类别索引。

`ISeriesTheme`的类型定义如下：

```ts
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

其中每个系列类型都对应一个主题配置`IXxxSeriesTheme`。这个类型是组件`IXxxSeriesSpec`的子集，包含该系列的所有样式配置。具体可参考对应系列的 spec。

### component(IComponentTheme)

组件样式属性，按组件类别索引。

`IComponentTheme`的类型定义如下：

```ts
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
  /**
   * 省略文本配置
   */
  [ComponentTypeEnum.poptip]?: PopTipAttributes;
}
```

其中每个系列类型都对应一个主题配置`IXxxTheme`。这个类型是组件`IXxxSpec`的子集，包含该组件的所有样式配置。具体可参考对应组件的 spec。

其中轴有一些公共配置：

- `IComponentTheme.axis` 为所有轴的公共配置，优先级最低。类型`IAxisCommonTheme`的定义如下：
  ```ts
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
  ```ts
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
  ```ts
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
