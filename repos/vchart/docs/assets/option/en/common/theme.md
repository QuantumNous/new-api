{{ target: common-theme }}

<!-- ITheme -->

## theme(Object)

The topic definition on the chart supports directly declaring the registered topic name (string type) on the configuration item.

Theme configurations are described by the `ITheme` interface and can be broadly categorized into 6 configurations:

````ts
interface ITheme {
  /**
   * :: Configuration 1: Thematic information
   */
  /** Theme naming */
  name?: string;

  /**
   * :: Configuration 2: Style attributes for the chart hierarchy
   */
  /** Chart background color */
  background?: string | IGradientColor.
  /** Inside margins of charts */
  padding?: ILayoutPaddingSpec.
  /** Chart font configuration */
  fontFamily?: string;

  /**
   * :: Configuration 3: color palette
   */
  /** Global color palette */
  colorScheme?: IThemeColorScheme;

  /**
   * :: Configuration 4: Global mark attribute configuration
   */
  /** Global mark style attribute, indexed by mark category */
  mark?: IGlobalMarkThemeByType.
  /** Global mark style attribute, indexed by mark name, higher priority */
  markByName?: IGlobalMarkThemeByName.

  /**
   * :: Configuration No. 5: Series Attribute Configuration
   */
  /** Series style attributes */
  series?: ISeriesTheme;

  /**
   * :: Configuration 6: Component attribute configuration
   */
  /** Component style attributes */
  component?: IComponentTheme.
}
``

### name(string)

Topic naming, used to identify the topic.

### background(string|Object)

Chart background color, which can be configured as a solid or gradient color.

### padding(number|number[]|Object)

{{ use: common-layout-padding(
  prefix = '###'
) }}

### fontFamily(string)

Chart default font configuration.

### colorScheme(IThemeColorScheme)

Global color palette configuration.

The type declaration for `IThemeColorScheme` is:

```ts
type IThemeColorScheme = {
  /** Mandatory */
  default: ColorScheme.
} & Partial<Record<SeriesTypeEnum, ColorScheme>>.
``

The color palette configuration accepts an object containing a default color palette (`IThemeColorScheme.default`) and specific color palettes for different families.

For example, if you want the color palette of the word cloud series to be different from the default color palette, you can configure it like this:

```ts
const colorScheme: IThemeColorScheme = {
  /** Default color palette */
  default: ['red', 'blue', 'green'],
  /** Color swatches for word cloud series */
  wordCloud: ['#98abc5', '#8a89a6', '#7b6888', '#6b486b', '#a05d56', '#d0743c', '#ff8c00']
};
``

#### default(Array<string>|ProgressiveDataScheme<string>|IColorSchemeStruct)

Default color palette configuration.

The color palette configuration type `ColorScheme` has a type declaration of:

```ts
type ColorScheme = Array<string> | ProgressiveDataScheme<string> | IColorSchemeStruct.
``

It means that there are 3 types that can be matched to the color palette.

- The first type `Array<string>` is an array of strings, which is the simplest color palette. It can be configured like this:

  ```ts
  const colorScheme: IThemeColorScheme = {
    /** Default color palette */
    default: ['red', 'blue', 'green', '#98abc5', 'rgb(255, 128, 0)']
  };
  ``

- The second type `ProgressiveDataScheme<string>` is a progressive color palette. Progressive color palettes allow multiple color palette schemes to exist at the same time, and the exact color palette to be applied is determined by executing the user callback. The type definition of `ProgressiveDataScheme` is as follows:

  ```ts
  /** Progressive data swatches: consists of multiple swatches, the conditions attached to the swatches (e.g. `isAvailable` callback) will be judged sequentially when applying the swatches, and the corresponding swatches will be applied immediately if the conditions are met */
  type ProgressiveDataScheme<T> = Array<IProgressiveDataSchemeCase<T>>;

  interface IProgressiveDataSchemeCase<T> {
    /** Optional, maximum number of domains that will fit this color palette */
    maxDomainLength?: number.
    /** Optional, more flexible custom callback that returns whether this color palette is applied. Will override configurations like maxDomainLength */
    isAvailable?: boolean | ((domain: any[]) => boolean);
    /** color plates */
    scheme: T[].
  }
  ``

  Users can slot color swatches by configuring `maxDomainLength` or `isAvailable`. In the `isAvailable` callback, the `domain` parameter will pass the domain information of the current color palette application.

  Example: Staging a color palette with `maxDomainLength` configuration

  ```ts
  const colorScheme: IThemeColorScheme = {
    default: [
      // First color (data item <= 10)
      {
        maxDomainLength: 10,
        scheme: [
          '#1664FF'.
          '#1AC6FF'.
          '#FF8A00'.
          '#3CC780'.
          '#7442D4'.
          '#FFC400'.
          '#304D77'.
          '#B48DEB'.
          '#009488'.
          '#FF7DDA'
        ]
      }, }
      // Second color (data items > 10)
      {
        scheme: [
          '#1664FF'.
          '#B2CFFF'.
          '#1AC6FF'.
          '#94EFFF'.
          '#FF8A00'.
          '#FFCE7A'.
          '#3CC780'.
          '#B9EDCD'.
          '#7442D4'.
          '#DDC5FA'.
          '#FFC400'.
          '#FAE878'.
          '#304D77'.
          '#8B959E'.
          '#B48DEB'.
          '#EFE3FF'.
          '#009488'.
          '#59BAA8'.
          '#FF7DDA'.
          '#FFCFEE'
        ]
      }
    ]
  };
  ``

- The third type, `IColorSchemeStruct`, contains semantic and progressive color palettes and is the most versatile palette definition. The type definition of `IColorSchemeStruct` is:

  ```ts
  /** General structure of the color palette, including the data palette and the semantic palette */
  type IColorSchemeStruct = {
    /** Data color swatches */
    dataScheme: Array<DataSchemeItem> | ProgressiveDataScheme<DataSchemeItem>;

    /** Semantic color palette */
    palette?
      /** User-defined semantic color values */
      [key: string]: ColorSchemeItem;
    };
  };
  ``

  Among them:

  - The `dataScheme` supports passing in the two basic swatch types described above, corresponding to the data item as the data swatch for the domain application.
  - And `palette` is a semantic color palette, which can be understood as a color dictionary, consisting of key-value pairs.

  For example, extending the previous example with a semantic color palette could be rewritten as:

  ```ts
  const colorScheme: IThemeColorScheme = {
    default: {
      // Data color palette
      dataScheme: [
        // First color (data item <= 10)
        {
          maxDomainLength: 10,
          scheme: [
            '#1664FF'.
            '#1AC6FF'.
            '#FF8A00'.
            '#3CC780'.
            '#7442D4'.
            '#FFC400'.
            '#304D77'.
            '#B48DEB'.
            '#009488'.
            '#FF7DDA'
          ]
        }, }
        // Second color (data items > 10)
        {
          scheme: [
            '#1664FF'.
            '#B2CFFF'.
            '#1AC6FF'.
            '#94EFFF'.
            '#FF8A00'.
            '#FFCE7A'.
            '#3CC780'.
            '#B9EDCD'.
            '#7442D4'.
            '#DDC5FA'.
            '#FFC400'.
            '#FAE878'.
            '#304D77'.
            '#8B959E'.
            '#B48DEB'.
            '#EFE3FF'.
            '#009488'.
            '#59BAA8'.
            '#FF7DDA'.
            '#FFCFEE'
          ]
        }
      ],
      // Semantic color palette
      palette: {
        labelFontColor: '#89909D',
        primaryFontColor: '#000000',
        axisGridColor: '#EBEDF2',
        axisDomainColor: '#D9DDE4'
      }
    }
  };
  ``

  Note the configuration of the semantic color palette section:

  ```ts
  {
    ...
    // Semantic color palette
    palette: {
      labelFontColor: '#89909D',
      primaryFontColor: '#000000',
      axisGridColor: '#EBEDF2',
      axisDomainColor: '#D9DDE4'
    }
  }
  ``

  With such a semantic color palette in place, it is possible to pick up colors from key values throughout the user's spec. For example, configure the axis style in the spec:

  ```ts
  const chartSpec = {
    ... Chart spec
    axis: [{
      orient: 'bottom',
      type: 'band',
      domainLine: {
        visible: true,
        style: {
          lineWidth: 1,
          stroke: { type: 'palette', key: 'axisDomainColor' }, // semantic color value
          strokeOpacity: 1
        }
      },
      grid: {
        visible: true,
        style: {
          lineWidth: 1,
          stroke: { type: 'palette', key: 'axisGridColor' }, // semantic color values
          strokeOpacity: 1,
          lineDash: []
        }
      },
      subGrid: {
        visible: false,
        style: {
          lineWidth: 1,
          stroke: { type: 'palette', key: 'axisGridColor' }, // semantic color values
          strokeOpacity: 1,
          lineDash: [4, 4]
        }
      },
      tick: {
        visible: true,
        tickSize: THEME_CONSTANTS.AXIS_TICK_SIZE,
        style: {
          lineWidth: 1,
          stroke: { type: 'palette', key: 'axisDomainColor' }, // semantic color value
          strokeOpacity: 1
        }
      },
      subTick: {
        visible: false,
        tickSize: THEME_CONSTANTS.AXIS_TICK_SIZE / 2,
        style: {
          lineWidth: 1,
          stroke: { type: 'palette', key: 'axisDomainColor' }, // semantic color value
          strokeOpacity: 1
        }
      },
      label: {
        visible: true,
        space: 10.
        style: {
          fontSize: THEME_CONSTANTS.LABEL_FONT_SIZE,
          fill: { type: 'palette', key: 'labelFontColor' }, // semantic color value
          fontWeight: 'normal',
          fillOpacity: 1
        }
      }
    }];
  }
  ```

  The configuration of semantic colors referenced through the `IColorKey` structure appears several times in the example. The type definition of `IColorKey` is:

  ```ts
  /** Color value index for semantic color values */
  interface IColorKey {
    /** Color type declaration */
    type: 'palette';

    /** Color index */
    key: string;

    /** Brightness factor (optional, 0~1) */
    l?: number.

    /** Transparency factor (optional, 0~1) */
    a?: number.
  }
  ``

### mark(IGlobalMarkThemeByType)

Global mark style attribute, indexed by mark category.

The `IGlobalMarkThemeByType` type is defined as follows:

```ts
interface IGlobalMarkThemeByType {
  [MarkTypeEnum.line]? : Partial<IMarkTheme<ILineMarkSpec>>;.
  [MarkTypeEnum.symbol]? : Partial<IMarkTheme<ISymbolMarkSpec>>;.
  [MarkTypeEnum.area]? : Partial<IMarkTheme<IAreaMarkSpec>>;.
  [MarkTypeEnum.rect]? : Partial<IMarkTheme<IRectMarkSpec>>;.
  [MarkTypeEnum.arc]? : Partial<IMarkTheme<IArcMarkSpec>>;.
  [MarkTypeEnum.text]? : Partial<IMarkTheme<ITextMarkSpec>>;.
  [MarkTypeEnum.path]? : Partial<IMarkTheme<IPathMarkSpec>>;.
}
``

#### line(Object)

line Tuple style configuration.

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

symbol Tuple style configuration.

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

area Tuple style configuration.

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

rect Tuple style configuration.

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

arc Tuple style configuration.

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

text The metric style configuration.

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

path Tuple style configuration.

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

Global mark style attributes, indexed by mark name.

This configuration item is very convenient for making changes to some common configurations across multiple series.

The `IGlobalMarkThemeByName` type is defined as follows:

```ts
interface IGlobalMarkThemeByName {
  /** used in lineSeries, areaSeries, radarSeries, etc. */
  line?: Partial<IMarkTheme<ILineMarkSpec>>;
  /** used in lineSeries, areaSeries, radarSeries, scatterSeries etc. */
  point?: Partial<IMarkTheme<ISymbolMarkSpec>>;
  /** used in lineSeries, areaSeries, radarSeries, etc. */
  area?: Partial<IMarkTheme<IAreaMarkSpec>>;.
  /** used in barSeries, rangeColumnSeries etc. */
  bar?: Partial<IMarkTheme<IRectMarkSpec>>.
  /** used in many series */
  label?: Partial<IMarkTheme<ITextMarkSpec>>;

  [markName: string]: Partial<IMarkTheme<any>>;.
}
``

#### line(Object)

line The line element style configuration for the line, area, radar, etc. series.

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

The point metric style configuration. Used for line, area, radar, scatter and other series.

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

area metric style configuration for line, area, radar and other series.

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

The bar element style configuration for bar, rangeColumn, and other series.

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

label Tuple style configuration for almost all series.

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

Series style properties, indexed by series category.

The type definition of `ISeriesTheme` is as follows:

```ts
interface ISeriesTheme {
  [SeriesTypeEnum.bar]? : IBarSeriesTheme;
  [SeriesTypeEnum.bar3d]? : IBar3dSeriesTheme;.
  [SeriesTypeEnum.line]? : ILineSeriesTheme;
  [SeriesTypeEnum.scatter]? : IScatterSeriesTheme.
  [SeriesTypeEnum.area]? : IAreaSeriesTheme;
  [SeriesTypeEnum.radar]? : IRadarSeriesTheme;
  [SeriesTypeEnum.pie]? : IPieSeriesTheme;
  [SeriesTypeEnum.pie3d]? : IPie3dSeriesTheme;.
  [SeriesTypeEnum.rose]? : IRoseSeriesTheme;
  [SeriesTypeEnum.map]? : IMapSeriesTheme;.
  [SeriesTypeEnum.circularProgress]? : ICircularProgressSeriesTheme;
  [SeriesTypeEnum.link]? : ILinkSeriesTheme;
  [SeriesTypeEnum.dot]? : IDotSeriesTheme;.
  [SeriesTypeEnum.wordCloud]? : IWordCloudSeriesTheme.
  [SeriesTypeEnum.wordCloud3d]? : IWordCloud3dSeriesTheme;.
  [SeriesTypeEnum.funnel]? : IFunnelSeriesTheme.
  [SeriesTypeEnum.funnel3d]? : IFunnel3dSeriesTheme;.
  [SeriesTypeEnum.wordCloud]? : IWordCloudSeriesTheme.
  [SeriesTypeEnum.linearProgress]? : ILinearProgressSeriesTheme;
  [SeriesTypeEnum.waterfall]? : IWaterfallSeriesTheme;
  [SeriesTypeEnum.boxPlot]? : IBoxPlotSeriesTheme;
  [SeriesTypeEnum.treemap]? : ITreemapSeriesTheme;
  [SeriesTypeEnum.sankey]? : ISankeySeriesTheme;
  [SeriesTypeEnum.gauge]? : IGaugeSeriesTheme.
  [SeriesTypeEnum.gaugePointer]? : IGaugePointerSeriesTheme;.
  [SeriesTypeEnum.sunburst]? : ISunburstSeriesTheme;.
  [SeriesTypeEnum.rangeColumn]? : IRangeColumnSeriesTheme;.
  [SeriesTypeEnum.circlePacking]? : ICirclePackingSeriesTheme;.
  [SeriesTypeEnum.heatmap]? : IHeatmapSeriesTheme;.
}
``

Each of these series types corresponds to a theme configuration `IXxxSeriesTheme`. This type is a subset of the component `IXxxSeriesSpec` and contains all style configurations for that series. For details, refer to the spec of the corresponding series.

### component(IComponentTheme)

Component style properties, indexed by component category.

The type definition of `IComponentTheme` is as follows:

```ts
interface IComponentTheme {
  /**
   * :: Generic axis configuration
   */
  axis?: IAxisCommonTheme.
  /**
   * :: Generic configuration of discrete axes
   */
  axisBand?: IAxisCommonTheme.
  /**
   * :: Generalized configuration of continuous axes
   */
  axisLinear?: IAxisCommonTheme.
  /**
   * :: Configuration of the x-axis in the Cartesian coordinate system
   */
  axisX?: ICartesianAxisCommonTheme.
  /**
   * :: Configuration of the y-axis in the Cartesian coordinate system
   */
  axisY?: ICartesianAxisCommonTheme.
  /**
   * :: Radius axis configuration in polar coordinate system
   */
  axisRadius?: IPolarAxisCommonTheme.
  /**
   * :: Configuration of angular axes in polar coordinate system
   */
  axisAngle?: IPolarAxisCommonTheme.
  /**
   * :: Discrete legend configuration
   */
  [ComponentTypeEnum.discreteLegend]? : IDiscreteLegendTheme;.
  /**
   * :: Continuous color legend configuration
   */
  [ComponentTypeEnum.colorLegend]? : IColorLegendTheme;.
  /**
   * :: Continuous size legend configuration
   */
  [ComponentTypeEnum.sizeLegend]? : ISizeLegendTheme;.
  /**
   * :: markLine marking configuration
   */
  [ComponentTypeEnum.markLine]? : IMarkLineTheme;.
  /**
   * :: markArea marking configuration
   */
  [ComponentTypeEnum.markArea]? : IMarkAreaTheme;.
  /**
   * :: MarkPoint marking configuration
   */
  [ComponentTypeEnum.markPoint]? : IMarkPointTheme;.
  /**
   * :: Configuration of tooltip components
   */
  [ComponentTypeEnum.tooltip]? : ITooltipTheme;.
  /**
   * :: crosshair configuration
   */
  [ComponentTypeEnum.crosshair]? : ICrosshairTheme;.
  /**
   * :: dataZoom configuration
   */
  [ComponentTypeEnum.dataZoom]? : IDataZoomTheme;.
  /**
   * scrollbar scrollbar configuration
   */
  [ComponentTypeEnum.scrollBar]? : IScrollBarTheme;.
  /**
   * :: Indicator card component configuration
   */
  [ComponentTypeEnum.indicator]? : IIndicatorTheme;.
  /**
   * :: Player configuration
   */
  [ComponentTypeEnum.player]? : IPlayerTheme;
  /**
   * :: Boxed configurations
   */
  [ComponentTypeEnum.brush]? : IBrushTheme;.
  /**
   * :: Configuration of chart titles
   */
  [ComponentTypeEnum.title]? : ITitleTheme;
  /**
   * :: Map labeling configuration
   */
  [ComponentTypeEnum.mapLabel]? : IMapLabelTheme;.
  /**
   * Omit text configuration
   */
  [ComponentTypeEnum.poptip]?: PopTipAttributes;
}
``

Each of these series types corresponds to a theme configuration `IXxxTheme`. This type is a subset of the component `IXxxSpec` and contains all style configurations for that component. For details, refer to the spec of the corresponding component.

One of the shafts has some public configurations:

- The `IComponentTheme.axis` is the common configuration for all axes, with the lowest priority. Type `IAxisCommonTheme` is defined as follows:
  ```ts
  interface IAxisCommonTheme {
    /** Gridline configuration */
    grid?
    /** Gridline configuration */
    subGrid?
    /** Axis configuration */
    domainLine?: IDomainLine.
    /** Axis labeling configuration */
    label?
    /** Axis header configuration */
    title?
    /** Axis scale configuration */
    tick?
    /** Axis scale configuration */
    subTick?
  }
  ``
  Specific configuration items can be found in the Axis Components spec.
- `IComponentTheme.axisBand` and `IComponentTheme.axisLinear` are common configurations for discrete and continuous axes respectively (not distinguishing between coordinate systems), with higher priority. The type is also `IAxisCommonTheme`.
- `IComponentTheme.axisX` and `IComponentTheme.axisY` are configurations of the two axes of the planar Cartesian coordinate system, respectively, with the highest priority. The type is `ICartesianAxisCommonTheme`. The type definition is as follows:
  ```ts
  interface ICartesianAxisCommonTheme {
    /** Gridline configuration */
    grid?
    /** Gridline configuration */
    subGrid?
    /** Axis configuration */
    domainLine?: ICartesianDomainLine.
    /** Axis labeling configuration */
    label?
    /** Axis header configuration */
    title?: ICartesianTitle.
    /** Axis scale configuration */
    tick?
    /** Axis scale configuration */
    subTick?
    /**
     * :: Axis background configuration
     */
    background?: ICartesianAxisCommonSpec['background'];
  }
  ``
  Specific configuration items can be found in the Axis Components spec.
- `IComponentTheme.axisAngle` and `IComponentTheme.axisRadius` are configurations for the two axes of the planar polar coordinate system, respectively, with the same highest priority. The type is `IPolarAxisCommonTheme`. The type definition is as follows:
  ```ts
  interface IPolarAxisCommonTheme {
    /** Gridline configuration */
    grid?: IPolarGrid.
    /** Subgrid line configuration */
    subGrid?: IPolarGrid.
    /** Axis configuration */
    domainLine?: IDomainLine.
    /** Axis labeling configuration */
    label?
    /** Axis header configuration */
    title?
    /** Axis scale configuration */
    tick?
    /** Axis sub-scale configuration */
    subTick?
  }
  ``
  Specific configuration items can be found in the Axis Components spec.
````
