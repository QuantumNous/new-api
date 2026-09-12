## ITheme 配置规范

ITheme 定义了 VChart 中主题系统的完整配置接口，支持全局样式、色彩方案、图元样式、系列样式和组件样式的统一管理。

## 核心接口结构

```typescript
export interface ITheme {
  // 主题信息
  name?: string;
  description?: string;
  type?: 'light' | 'dark';
  
  // 图表层级样式
  background?: IColor | IColorKey;
  padding?: ILayoutPaddingSpec;
  fontFamily?: string | ITokenKey;
  token?: TokenMap;
  
  // 色板配置
  colorScheme?: IThemeColorScheme;
  
  // 图元样式配置
  mark?: IGlobalMarkThemeByType;
  markByName?: IGlobalMarkThemeByName;
  
  // 系列样式配置
  series?: ISeriesTheme;
  animationThreshold?: number;
  
  // 组件样式配置
  component?: IComponentTheme;
  
  // 图表类型特定配置
  chart?: Record<ChartType, Omit<ITheme, 'name' | 'type' | 'description'>>;
}
```

## 主题基础信息

定义主题的标识和类型信息：

```typescript
interface IThemeBasicInfo {
  /** 主题命名 */
  name?: string;
  
  /** 主题描述 */
  description?: string;
  
  /**
   * 主题类别：亮色或者暗色
   * 该配置用于指定该主题需要 merge 的是内置的亮色主题还是暗色主题
   */
  type?: 'light' | 'dark';
}
```

## 图表全局样式

定义图表层级的全局样式属性：

```typescript
interface IThemeGlobalStyle {
  /** 图表背景色 */
  background?: IColor | IColorKey;
  
  /** 图表内边距 */
  padding?: ILayoutPaddingSpec;
  
  /** 图表字体配置 */
  fontFamily?: string | ITokenKey;
  
  /**
   * 用户自定义的语义化 token，可以在主题中以 ITokenKey 的形式引用并作为常量赋值
   * @since 1.10.0
   */
  token?: TokenMap;
}
```

## 色彩方案配置

定义全局和系列特定的色彩方案：

```typescript
export type IThemeColorScheme = {
  /** 必选的默认色板 */
  default: ColorScheme;
} & Partial<Record<SeriesTypeEnum, ColorScheme>> &
  Partial<Record<SeriesTypeForThemeEnum, ColorScheme>>;

export type ColorScheme = Array<string> | ProgressiveDataScheme<string> | IColorSchemeStruct;

export type IColorSchemeStruct = {
  /** 数据色板 */
  dataScheme: Array<DataSchemeItem> | ProgressiveDataScheme<DataSchemeItem>;
  
  /** 语义色板 */
  palette?: {
    /** 主色调（可选） */
    bandColor?: ColorSchemeItem;
    /** 背景颜色（可选） */
    backgroundColor?: ColorSchemeItem;
    /** 其他的语义化色值 */
    [key: string]: ColorSchemeItem;
  };
};
```

## 图元样式配置

### 按类型索引的图元样式
```typescript
export interface IGlobalMarkThemeByType {
  [MarkTypeEnum.line]?: Partial<IMarkTheme<ILineMarkSpec>>;
  [MarkTypeEnum.symbol]?: Partial<IMarkTheme<ISymbolMarkSpec>>;
  [MarkTypeEnum.area]?: Partial<IMarkTheme<IAreaMarkSpec>>;
  [MarkTypeEnum.rect]?: Partial<IMarkTheme<IRectMarkSpec>>;
  [MarkTypeEnum.arc]?: Partial<IMarkTheme<IArcMarkSpec>>;
  [MarkTypeEnum.text]?: Partial<IMarkTheme<ITextMarkSpec>>;
  [MarkTypeEnum.path]?: Partial<IMarkTheme<IPathMarkSpec>>;
}
```

### 按名称索引的图元样式
```typescript
export interface IGlobalMarkThemeByName {
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

## 系列样式配置

定义各种图表系列的主题样式：

```typescript
export interface ISeriesTheme {
  [SeriesTypeEnum.bar]?: IBarSeriesTheme;
  [SeriesTypeEnum.line]?: ILineSeriesTheme;
  [SeriesTypeEnum.area]?: IAreaSeriesTheme;
  [SeriesTypeEnum.pie]?: IPieSeriesTheme;
  [SeriesTypeEnum.scatter]?: IScatterSeriesTheme;
  [SeriesTypeEnum.radar]?: IRadarSeriesTheme;
  [SeriesTypeEnum.rose]?: IRoseSeriesTheme;
  [SeriesTypeEnum.funnel]?: IFunnelSeriesTheme;
  [SeriesTypeEnum.gauge]?: IGaugeSeriesTheme;
  [SeriesTypeEnum.sankey]?: ISankeySeriesTheme;
  [SeriesTypeEnum.treemap]?: ITreemapSeriesTheme;
  [SeriesTypeEnum.wordCloud]?: IWordCloudSeriesTheme;
  [SeriesTypeEnum.heatmap]?: IHeatmapSeriesTheme;
  // ... 更多系列类型
}
```

## 组件样式配置

定义各种图表组件的主题样式：

```typescript
export interface IComponentTheme {
  /** 通用坐标轴配置 */
  axis?: IAxisCommonTheme;
  /** 离散轴的通用配置 */
  axisBand?: IAxisCommonTheme;
  /** 连续轴的通用配置 */
  axisLinear?: IAxisCommonTheme;
  /** 笛卡尔坐标系下 x 轴的配置 */
  axisX?: ICartesianAxisCommonTheme;
  /** 笛卡尔坐标系下 y 轴配置 */
  axisY?: ICartesianAxisCommonTheme;
  
  /** 离散图例配置 */
  [ComponentTypeEnum.discreteLegend]?: IDiscreteLegendTheme;
  /** 连续颜色图例配置 */
  [ComponentTypeEnum.colorLegend]?: IColorLegendTheme;
  /** 连续尺寸图例配置 */
  [ComponentTypeEnum.sizeLegend]?: ISizeLegendTheme;
  
  /** tooltip 组件配置 */
  [ComponentTypeEnum.tooltip]?: ITooltipTheme<string | IColorKey>;
  /** crosshair 配置 */
  [ComponentTypeEnum.crosshair]?: ICrosshairTheme;
  /** dataZoom 配置 */
  [ComponentTypeEnum.dataZoom]?: IDataZoomTheme;
  /** scrollbar 滚动条配置 */
  [ComponentTypeEnum.scrollBar]?: IScrollBarTheme;
  /** 框选配置 */
  [ComponentTypeEnum.brush]?: IBrushTheme;
  /** 图表标题配置 */
  [ComponentTypeEnum.title]?: ITitleTheme;
  /** 播放器配置 */
  [ComponentTypeEnum.player]?: IPlayerTheme;
  
  [key: string]: any;
}
```

## 支持类型定义

### 颜色引用类型
```typescript
export interface IColorKey {
  /** 颜色type声明 */
  type: 'palette';
  /** 颜色 token */
  key: string;
  /** 明度系数（可选，0~1） */
  l?: number;
  /** 透明度系数（可选，0~1） */
  a?: number;
  /** 默认色值，在没有取到 key 对应的色值时返回 */
  default?: ColorSchemeItem;
}
```

### Token 引用类型
```typescript
export interface ITokenKey<T = any> {
  /** type 声明 */
  type: 'token';
  /** token key */
  key: string;
  /** 默认值，在没有取到 key 对应的值时返回 */
  default?: T;
}

export type TokenMap = Record<string, any>;
```

### 图元主题类型
```typescript
export type IMarkTheme<T> = {
  /** mark 层 是否显示配置 */
  visible?: boolean;
  /** 默认样式设置 */
  style?: T;
  /** 不同状态下的样式配置 */
  state?: IMarkStateTheme<T>;
  /** 可交互的开关 */
  interactive?: boolean;
};

export interface IMarkStateTheme<T> extends Record<string, T> {
  /** 图元在正常状态下的主题样式设置 */
  normal?: T;
  /** 图元在 hover 状态下的主题样式设置 */
  hover?: T;
  /** 图元在 未被hover 状态下的主题样式设置 */
  hover_reverse?: T;
  /** 图元在 选中状态下的主题样式设置 */
  selected?: T;
  /** 图元在 未被选中 状态下的主题样式设置 */
  selected_reverse?: T;
}
```

### 图表类型枚举
```typescript
export const enum ChartTypeEnum {
  common = 'common',
  area = 'area',
  line = 'line',
  bar = 'bar',
  pie = 'pie',
  radar = 'radar',
  scatter = 'scatter',
  funnel = 'funnel',
  gauge = 'gauge',
  sankey = 'sankey',
  treemap = 'treemap',
  heatmap = 'heatmap',
  wordCloud = 'wordCloud'
  // ... 更多图表类型
}

export type ChartType = keyof typeof ChartTypeEnum | string;
```

## 完整类型定义

```typescript
export interface ITheme {
  // 主题基础信息
  name?: string;
  description?: string;
  type?: 'light' | 'dark';
  
  // 全局样式
  background?: IColor | IColorKey;
  padding?: ILayoutPaddingSpec;
  fontFamily?: string | ITokenKey;
  token?: TokenMap;
  
  // 色彩方案
  colorScheme?: IThemeColorScheme;
  
  // 图元样式 (按类型)
  mark?: {
    line?: Partial<IMarkTheme<ILineMarkSpec>>;
    symbol?: Partial<IMarkTheme<ISymbolMarkSpec>>;
    area?: Partial<IMarkTheme<IAreaMarkSpec>>;
    rect?: Partial<IMarkTheme<IRectMarkSpec>>;
    arc?: Partial<IMarkTheme<IArcMarkSpec>>;
    text?: Partial<IMarkTheme<ITextMarkSpec>>;
    path?: Partial<IMarkTheme<IPathMarkSpec>>;
  };
  
  // 图元样式 (按名称, 优先级更高)
  markByName?: {
    line?: Partial<IMarkTheme<ILineMarkSpec>>;
    point?: Partial<IMarkTheme<ISymbolMarkSpec>>;
    area?: Partial<IMarkTheme<IAreaMarkSpec>>;
    bar?: Partial<IMarkTheme<IRectMarkSpec>>;
    label?: Partial<IMarkTheme<ITextMarkSpec>>;
    [markName: string]: Partial<IMarkTheme<any>>;
  };
  
  // 系列样式
  series?: ISeriesTheme;
  animationThreshold?: number;
  
  // 组件样式
  component?: IComponentTheme;
  
  // 图表类型特定配置
  chart?: Record<ChartType, Omit<ITheme, 'name' | 'type' | 'description'>>;
}
```

## 使用示例

### 基础主题配置
```typescript
const basicTheme: ITheme = {
  name: 'custom-theme',
  type: 'light',
  background: '#ffffff',
  padding: { top: 20, right: 20, bottom: 20, left: 20 },
  fontFamily: 'Arial, sans-serif'
};
```

### 色彩方案配置
```typescript
const colorTheme: ITheme = {
  name: 'color-theme',
  colorScheme: {
    default: ['#5B8FF9', '#5AD8A6', '#5D7092', '#F6BD16', '#E8684A'],
    bar: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728'],
    line: {
      dataScheme: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'],
      palette: {
        bandColor: '#f0f0f0',
        backgroundColor: '#ffffff'
      }
    }
  }
};
```

### 图元样式配置
```typescript
const markTheme: ITheme = {
  name: 'mark-theme',
  mark: {
    line: {
      style: {
        lineWidth: 2,
        stroke: '#333333'
      },
      state: {
        hover: {
          lineWidth: 3,
          stroke: '#ff0000'
        }
      }
    }
  },
  markByName: {
    point: {
      style: {
        size: 8,
        fill: '#5B8FF9'
      }
    }
  }
};
```

### 组件样式配置
```typescript
const componentTheme: ITheme = {
  name: 'component-theme',
  component: {
    axis: {
      domainLine: {
        visible: true,
        style: {
          stroke: '#d0d7de'
        }
      },
      tick: {
        visible: true,
        style: {
          stroke: '#d0d7de'
        }
      },
      label: {
        style: {
          fontSize: 12,
          fill: '#656d76'
        }
      }
    },
    tooltip: {
      panel: {
        backgroundColor: 'rgba(8, 28, 48, 0.95)',
        border: {
          color: '#CFCFCF',
          width: 0,
          radius: 2
        }
      }
    }
  }
};
```

### Token 和颜色引用
```typescript
const tokenTheme: ITheme = {
  name: 'token-theme',
  token: {
    primaryColor: '#1890ff',
    fontSize: 14,
    borderRadius: 4
  },
  background: {
    type: 'palette',
    key: 'backgroundColor',
    default: '#ffffff'
  },
  fontFamily: {
    type: 'token',
    key: 'fontFamily',
    default: 'Arial'
  }
};
```

