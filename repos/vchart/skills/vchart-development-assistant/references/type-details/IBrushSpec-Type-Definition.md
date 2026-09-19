## IBrushSpec 配置规范

IBrushSpec 定义了 VChart 中框选组件的完整配置接口，支持矩形、多边形等多种框选模式，提供数据筛选、样式定制和交互控制功能。

## 核心接口结构

```typescript
export interface IBrushSpec extends IBrushTheme, IBrushDataBindSpec {
  /** 组件 id */
  id?: string;
  /**
   * 组件可见性
   * @default true
   */
  visible?: boolean;
  /**
   * 是否更新图元状态
   * 关闭时, brush 事件不会触发图元状态更新, 优化缩放场景下的性能
   * @default true
   * @since 1.13.13
   */
  updateElementsState?: boolean;
}
```

## 数据绑定配置 (IBrushDataBindSpec)

定义框选组件的数据关联和联动行为：

```typescript
interface IBrushDataBindSpec {
  /** 可刷取的regionIndex */
  regionIndex?: number | number[];
  /** 可刷取的regionId */
  regionId?: string | string[];
  /** 可刷取的seriesIndex（在可刷取的region范围内） */
  seriesIndex?: number | number[];
  /** 可刷取的seriesId（在可刷取的region范围内） */
  seriesId?: string | string[];
  /** 刷取联动的seriesIndex */
  brushLinkSeriesIndex?: number | number[];
  /** 刷取联动的seriesId */
  brushLinkSeriesId?: string | string[];
  
  /**
   * 刷取后是否更新axis/dataZoom范围
   * @default false
   * @since 0.10.0
   */
  zoomAfterBrush?: boolean;
  /**
   * 刷取到空数据时, 是否更新axis/dataZoom范围
   * @default false
   * @since 1.12.2
   */
  zoomWhenEmpty?: boolean;
  
  /** 刷取联动的axisId */
  axisId?: string | string[];
  /** 刷取联动的axisIndex */
  axisIndex?: number | number[];
  
  /**
   * 更新dataZoom范围时, 按百分比进行范围拓展
   * @since 1.10.0
   */
  axisRangeExpand?: number;
}
```

## 主题样式配置 (IBrushTheme)

定义框选组件的视觉样式和交互行为：

```typescript
export interface IBrushTheme {
  /** brush 的框选样式 */
  style?: Partial<IPolygonMarkSpec>;
  
  /** 框选范围内的图元样式 */
  inBrush?: selectedItemStyle;
  /** 框选范围外的图元样式 */
  outOfBrush?: selectedItemStyle;
  
  /**
   * 框选模式
   * @default 'single'
   */
  brushMode?: IBrushMode;
  /**
   * 框选类型
   * @default 'rect'
   */
  brushType?: IBrushType;
  /**
   * 是否可被平移
   * @default true
   */
  brushMoved?: boolean;
  /**
   * brushMode为'single'时，是否单击清除选框
   * @default true
   */
  removeOnClick?: boolean;
  
  /**
   * 事件触发延迟类型
   * @default 'throttle'
   */
  delayType?: IDelayType;
  /**
   * 事件触发延迟时长
   * @default 10
   */
  delayTime?: number;
  /**
   * brush选框的大小阈值
   * @default 5
   * @since 1.2.0
   */
  sizeThreshold?: number;
  /** 不需要被brush操作的mark类型 */
  markTypeFilter?: string[];
  
  /**
   * 自定义brush事件, 触发时机: 框选结束
   * 返回true, 则清空brush
   * @since 1.13.9
   */
  onBrushEnd?: (e: any) => boolean;
}
```

## 支持类型定义

### 框选模式类型
```typescript
export type IBrushMode = 'single' | 'multiple';
export type IBrushType = 'x' | 'y' | 'rect' | 'polygon';
```

### 图元样式类型
```typescript
export type selectedItemStyle = {
  /** 图元的图形类别 */
  symbol?: SymbolType;
  /** 图元的大小 */
  symbolSize?: number;
  /** 图元的颜色 */
  color?: string;
  /** 图元的颜色透明度 */
  colorAlpha?: number;
} & Partial<IPolygonMarkSpec>;
```

### 事件延迟类型
```typescript
export type IDelayType = 'debounce' | 'throttle';
```

### 多边形样式接口
```typescript
export interface IPolygonMarkSpec extends ICommonSpec, IFillMarkSpec {
  /** 顶点坐标 */
  points?: IPoint[];
  /** 圆角配置，支持数组配置，数组的顺序同组成 polygon 的顺序对应 */
  cornerRadius?: number | number[];
  /** x方向的缩放比例，默认为1，即不进行缩放 */
  scaleX?: number;
  /** y方向的缩放比例，默认为1，即不进行缩放 */
  scaleY?: number;
}
```

## 完整类型定义

```typescript
export interface IBrushSpec {
  // 基础配置
  id?: string;
  visible?: boolean;
  updateElementsState?: boolean;
  
  // 数据绑定
  regionIndex?: number | number[];
  regionId?: string | string[];
  seriesIndex?: number | number[];
  seriesId?: string | string[];
  brushLinkSeriesIndex?: number | number[];
  brushLinkSeriesId?: string | string[];
  zoomAfterBrush?: boolean;
  zoomWhenEmpty?: boolean;
  axisId?: string | string[];
  axisIndex?: number | number[];
  axisRangeExpand?: number;
  
  // 样式和交互
  style?: Partial<IPolygonMarkSpec>;
  inBrush?: selectedItemStyle;
  outOfBrush?: selectedItemStyle;
  brushMode?: 'single' | 'multiple';
  brushType?: 'x' | 'y' | 'rect' | 'polygon';
  brushMoved?: boolean;
  removeOnClick?: boolean;
  delayType?: 'debounce' | 'throttle';
  delayTime?: number;
  sizeThreshold?: number;
  markTypeFilter?: string[];
  onBrushEnd?: (e: any) => boolean;
}
```

## 使用示例

### 基础矩形框选
```typescript
const brushSpec: IBrushSpec = {
  brushType: 'rect',
  brushMode: 'single',
  style: {
    fill: 'rgba(0, 0, 255, 0.1)',
    stroke: '#0000ff',
    lineWidth: 2
  },
  inBrush: {
    colorAlpha: 1.0
  },
  outOfBrush: {
    colorAlpha: 0.3
  }
};
```
