## IMediaQuerySpec 配置规范

IMediaQuerySpec 定义了 VChart 中媒体查询系统的配置接口，支持基于图表尺寸的响应式布局和动态配置调整。

## 核心接口结构

```typescript
export type IMediaQuerySpec = IMediaQueryItem[];

export interface IMediaQueryItem {
  query: IMediaQueryCondition;
  action: IMediaQueryAction | IMediaQueryAction[];
}
```

## 媒体信息接口

定义图表的基础尺寸信息：

```typescript
export interface IMediaInfo {
  /** 图表宽度 */
  width: number;
  /** 图表高度 */
  height: number;
}
```

## 媒体查询条件 (IMediaQueryCondition)

定义媒体查询的触发条件，多个属性之间为"且"关系：

```typescript
export interface IMediaQueryCondition {
  /** 最小图表宽度 */
  minWidth?: number;
  /** 最大图表宽度 */
  maxWidth?: number;
  /** 最小图表高度 */
  minHeight?: number;
  /** 最大图表高度 */
  maxHeight?: number;
  /** 当图表宽度或高度发生变化时触发的回调，由回调指定是否命中查询条件 */
  onResize?: (info: IMediaInfo, vchart: IVChart) => boolean;
}
```

## 媒体查询动作 (IMediaQueryAction)

定义命中查询条件后的执行动作：

```typescript
export interface IMediaQueryAction<T extends Record<string, unknown> = any> {
  /**
   * 需要应用的新 spec
   * - 如果元素过滤器匹配到了某些图表元素，新 spec 将依次合并到这些元素
   * - 如果元素过滤器没有匹配到任何图表元素，新 spec 可能会作为新的图表元素添加到图表（forceAppend 为 true 的情况）
   */
  spec:
    | Partial<T>
    | ((
        filteredModelInfo: IModelSpecInfo<T>[],
        action: IMediaQueryAction<T>,
        query: IMediaQueryCondition
      ) => Partial<T>);
  
  /**
   * 元素过滤器类型
   * @default 'chart'
   */
  filterType?: MediaQueryActionFilterType;
  
  /**
   * 元素过滤器
   * （如果不配置，则匹配 filterType 对应的所有元素）
   */
  filter?: MediaQueryActionFilter<T> | Array<MediaQueryActionFilter<T>>;
  
  /**
   * 元素过滤器匹配不到图表元素时，是否将新 spec 作为新的图表元素添加到图表
   * （filterType 为 'chart' 时该配置失效）
   * @default false
   */
  forceAppend?: boolean;
}
```

## 过滤器类型定义

### 过滤器类型枚举
```typescript
export type MediaQueryActionFilterType =
  | 'region'
  | 'series'
  | 'chart'
  | `${SeriesTypeEnum}`     // 具体 series 类型，如 'bar'、'line'
  | `${ComponentTypeEnum}`  // 具体 component 类型，如 'cartesianAxis-band'
  | keyof IChartSpec;      // 组件 spec key，如 'axes'、'legends'、'crosshair'
```

### 过滤器配置
```typescript
export type MediaQueryActionFilter<T extends Record<string, unknown> = any> =
  | Partial<T>  // 基于 spec 的模糊匹配
  | ((
      modelInfo: IModelSpecInfo<T>,
      action: IMediaQueryAction<T>,
      query: IMediaQueryCondition
    ) => boolean);  // 函数回调匹配
```

## 支持类型定义

### 系列类型枚举
```typescript
export enum SeriesTypeEnum {
  area = 'area',
  line = 'line',
  bar = 'bar',
  rangeColumn = 'rangeColumn',
  rangeArea = 'rangeArea',
  dot = 'dot',
  map = 'map',
  pie = 'pie',
  radar = 'radar',
  rose = 'rose',
  scatter = 'scatter',
  circularProgress = 'circularProgress',
  wordCloud = 'wordCloud',
  funnel = 'funnel',
  linearProgress = 'linearProgress',
  boxPlot = 'boxPlot',
  sankey = 'sankey',
  gauge = 'gauge',
  treemap = 'treemap',
  sunburst = 'sunburst',
  circlePacking = 'circlePacking',
  waterfall = 'waterfall',
  heatmap = 'heatmap',
  correlation = 'correlation',
  liquid = 'liquid',
  venn = 'venn',
  mosaic = 'mosaic',
  pictogram = 'pictogram'
}
```

### 组件类型枚举
```typescript
export enum ComponentTypeEnum {
  cartesianAxis = 'cartesianAxis',
  cartesianBandAxis = 'cartesianAxis-band',
  cartesianLinearAxis = 'cartesianAxis-linear',
  cartesianTimeAxis = 'cartesianAxis-time',
  polarAxis = 'polarAxis',
  polarBandAxis = 'polarAxis-band',
  polarLinearAxis = 'polarAxis-linear',
  crosshair = 'crosshair',
  cartesianCrosshair = 'cartesianCrosshair',
  polarCrosshair = 'polarCrosshair',
  dataZoom = 'dataZoom',
  discreteLegend = 'discreteLegend',
  continuousLegend = 'continuousLegend',
  colorLegend = 'colorLegend',
  sizeLegend = 'sizeLegend',
  markLine = 'markLine',
  markArea = 'markArea',
  markPoint = 'markPoint',
  tooltip = 'tooltip',
  title = 'title',
  player = 'player',
  scrollBar = 'scrollBar',
  brush = 'brush'
}
```

### 模型信息接口
```typescript
export interface IModelSpecInfo<T extends Record<string, unknown> = any> {
  /** model 具体类型 */
  type: string | ComponentTypeEnum | SeriesTypeEnum;
  /** model spec */
  spec: T;
  /** 该 spec 在图表 spec 上的路径 */
  specPath?: Array<string | number>;
  /** 该 spec 在图表 spec info 上的路径 */
  specInfoPath?: Array<string | number>;
  /** model 当前主题 */
  theme?: any;
  /** model 对应的 region 索引 */
  regionIndexes?: number[];
  /** model 对应的 series 索引 */
  seriesIndexes?: number[];
}
```

## 完整类型定义

```typescript
export type IMediaQuerySpec = Array<{
  // 查询条件
  query: {
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
    onResize?: (info: IMediaInfo, vchart: IVChart) => boolean;
  };
  
  // 执行动作
  action: {
    // 新的配置规范
    spec: Partial<any> | ((
      filteredModelInfo: IModelSpecInfo[],
      action: IMediaQueryAction,
      query: IMediaQueryCondition
    ) => Partial<any>);
    
    // 过滤器类型
    filterType?: 'region' | 'series' | 'chart' | 
                 SeriesTypeEnum | ComponentTypeEnum | 
                 keyof IChartSpec;
    
    // 过滤器配置
    filter?: Partial<any> | Array<Partial<any>> | 
             ((modelInfo: IModelSpecInfo, action: IMediaQueryAction, query: IMediaQueryCondition) => boolean) |
             Array<(modelInfo: IModelSpecInfo, action: IMediaQueryAction, query: IMediaQueryCondition) => boolean>;
    
    // 是否强制追加
    forceAppend?: boolean;
  } | Array<{
    spec: Partial<any> | Function;
    filterType?: string;
    filter?: any;
    forceAppend?: boolean;
  }>;
}>;
```

## 使用示例

### 基础响应式配置
```typescript
const mediaQuery: IMediaQuerySpec = [
  {
    query: { maxWidth: 768 },
    action: {
      filterType: 'chart',
      spec: {
        legends: { visible: false },
        title: { text: 'Mobile Chart' }
      }
    }
  }
];
```

### 多条件查询
```typescript
const complexQuery: IMediaQuerySpec = [
  {
    query: {
      minWidth: 1024,
      minHeight: 600
    },
    action: {
      filterType: 'chart',
      spec: {
        layout: { type: 'grid', col: 2 },
        legends: { orient: 'right' }
      }
    }
  },
  {
    query: { maxWidth: 480 },
    action: [
      {
        filterType: 'legends',
        spec: { visible: false }
      },
      {
        filterType: 'title',
        spec: { textStyle: { fontSize: 14 } }
      }
    ]
  }
];
```

### 系列特定配置
```typescript
const seriesQuery: IMediaQuerySpec = [
  {
    query: { maxWidth: 600 },
    action: {
      filterType: 'bar',
      filter: { name: 'sales' },
      spec: {
        barWidth: 0.8,
        label: { visible: false }
      }
    }
  }
];
```

### 动态配置函数
```typescript
const dynamicQuery: IMediaQuerySpec = [
  {
    query: {
      onResize: (info: IMediaInfo) => {
        return info.width / info.height < 1; // 检测竖屏
      }
    },
    action: {
      filterType: 'chart',
      spec: (filteredInfo, action, query) => {
        return {
          layout: { type: 'vertical' },
          legends: { orient: 'bottom' }
        };
      }
    }
  }
];
```

### 组件过滤配置
```typescript
const componentQuery: IMediaQuerySpec = [
  {
    query: { maxWidth: 500 },
    action: {
      filterType: 'cartesianAxis',
      filter: [
        { orient: 'bottom' },
        (modelInfo) => modelInfo.spec.type === 'band'
      ],
      spec: {
        label: { visible: false },
        tick: { visible: false }
      }
    }
  }
];
```

### 强制追加配置
```typescript
const appendQuery: IMediaQuerySpec = [
  {
    query: { minWidth: 1200 },
    action: {
      filterType: 'dataZoom',
      filter: { orient: 'bottom' },
      forceAppend: true,
      spec: {
        type: 'slider',
        orient: 'bottom',
        height: 20
      }
    }
  }
];
```

