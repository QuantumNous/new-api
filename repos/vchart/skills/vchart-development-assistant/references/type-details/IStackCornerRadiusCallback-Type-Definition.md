## IStackCornerRadiusCallback 配置规范

```typescript
export type IStackCornerRadiusCallback = (
  attr: IRectGraphicAttribute,
  datum: Datum,
  ctx: ISeriesMarkAttributeContext
) => number | number[];
```

## 函数参数说明

### 图形属性参数 (IRectGraphicAttribute)

包含矩形图元的完整图形属性信息：

```typescript
// IRectGraphicAttribute 来自 @visactor/vrender-core
interface IRectGraphicAttribute {
  // 位置属性
  x?: number;
  y?: number;
  z?: number;

  // 尺寸属性
  width?: number;
  height?: number;

  // 圆角属性
  cornerRadius?: number | number[];

  // 填充样式
  fill?: string | IGradient;
  fillOpacity?: number;

  // 描边样式
  stroke?: string | IGradient;
  strokeOpacity?: number;
  lineWidth?: number;
  lineDash?: number[];
  lineDashOffset?: number;
  lineCap?: 'butt' | 'round' | 'square';
  lineJoin?: 'arcs' | 'bevel' | 'miter' | 'miter-clip' | 'round';

  // 显示属性
  visible?: boolean;
  opacity?: number;
  zIndex?: number;

  // 变换属性
  scaleX?: number;
  scaleY?: number;
  angle?: number;

  // 其他渲染属性
  blur?: number;
  shadowBlur?: number;
  shadowColor?: string;
  shadowOffsetX?: number;
  shadowOffsetY?: number;

  [key: string]: any;
}
```

### 数据参数 (Datum)

当前数据项的完整数据对象：

```typescript
export type Datum = Record<string, any>;

// 典型的柱图数据结构示例
interface TypicalBarDatum {
  // 分类字段
  category?: string | number;
  // 数值字段
  value?: number;
  // 系列字段
  series?: string | number;
  // 堆叠字段
  stack?: string | number;
  // 其他自定义字段
  [key: string]: any;
}
```

### 上下文参数 (ISeriesMarkAttributeContext)

系列图元属性上下文，提供尺度和颜色等辅助信息：

```typescript
export interface ISeriesMarkAttributeContext extends IModelMarkAttributeContext {
  /** 通用的默认属性值获取，比如color，如果有散点图有sizeScale，则可以获取 size */
  globalScale: (scaleKey: string, value: string | number) => unknown;

  /** 传入seriesField值，获取对应的颜色。如果传入 null，返回的是当前系列对应的第一个颜色值 */
  seriesColor: (seriesValue?: string | number) => string;

  /** 获取当前的 region */
  getRegion: () => IRegion;
}

export interface IModelMarkAttributeContext {
  [key: string]: unknown;
}
```

## 返回值类型

回调函数支持两种返回值类型：

### 统一圆角

```typescript
type UniformCornerRadius = number;
// 示例：所有角使用相同圆角值
return 8; // 所有角 8px 圆角
```

### 分别设置圆角

```typescript
type IndividualCornerRadius = number[];
// 数组顺序：[上左, 上右, 下右, 下左]
return [8, 8, 0, 0]; // 上方圆角 8px，下方直角
```

## 动画参数类型 (IBarAnimationParams)

用于堆叠柱图动画的辅助参数类型：

```typescript
export interface IBarAnimationParams {
  /** x轴字段 */
  xField: string;
  /** y轴字段 */
  yField: string;
  /** 方向类型 */
  direction: DirectionType;
  /** 生长起始点计算函数 */
  growFrom: () => number;
}

export type DirectionType = 'vertical' | 'horizontal';
```

## 完整类型定义

```typescript
export type IStackCornerRadiusCallback = (
  // 矩形图形属性
  attr: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    cornerRadius?: number | number[];
    fill?: string | IGradient;
    fillOpacity?: number;
    stroke?: string | IGradient;
    strokeOpacity?: number;
    lineWidth?: number;
    visible?: boolean;
    opacity?: number;
    zIndex?: number;
    scaleX?: number;
    scaleY?: number;
    angle?: number;
    [key: string]: any;
  },

  // 数据对象
  datum: Record<string, any>,

  // 系列上下文
  ctx: {
    globalScale: (scaleKey: string, value: string | number) => unknown;
    seriesColor: (seriesValue?: string | number) => string;
    getRegion: () => IRegion;
    [key: string]: unknown;
  }
) => number | number[];
```

## 使用示例

### 基于数据值的动态圆角

```typescript
const dynamicCornerRadius: IStackCornerRadiusCallback = (attr, datum, ctx) => {
  const value = datum.value as number;

  // 根据数值大小决定圆角
  if (value > 100) {
    return 12; // 大值使用较大圆角
  } else if (value > 50) {
    return 8; // 中值使用中等圆角
  } else {
    return 4; // 小值使用较小圆角
  }
};
```

### 基于位置的条件圆角

```typescript
const positionBasedRadius: IStackCornerRadiusCallback = (attr, datum, ctx) => {
  const isTop = datum.isTopOfStack as boolean;
  const isBottom = datum.isBottomOfStack as boolean;

  // 堆叠顶部和底部使用不同圆角
  if (isTop && isBottom) {
    return [8, 8, 8, 8]; // 单独柱子，四角圆角
  } else if (isTop) {
    return [8, 8, 0, 0]; // 堆叠顶部，上方圆角
  } else if (isBottom) {
    return [0, 0, 8, 8]; // 堆叠底部，下方圆角
  } else {
    return 0; // 中间部分，无圆角
  }
};
```

### 基于系列的差异化圆角

```typescript
const seriesBasedRadius: IStackCornerRadiusCallback = (attr, datum, ctx) => {
  const seriesValue = datum.series as string;
  const color = ctx.seriesColor(seriesValue);

  // 根据系列颜色亮度调整圆角
  const brightness = getBrightness(color);

  if (brightness > 150) {
    return 12; // 亮色系列使用大圆角
  } else {
    return 6; // 暗色系列使用小圆角
  }
};
```

### 基于图形尺寸的自适应圆角

```typescript
const sizeAdaptiveRadius: IStackCornerRadiusCallback = (attr, datum, ctx) => {
  const width = attr.width || 0;
  const height = attr.height || 0;

  // 基于柱子尺寸计算圆角
  const minSize = Math.min(width, height);
  const radius = Math.min(minSize * 0.2, 16); // 最大不超过16px

  return Math.max(radius, 2); // 最小2px圆角
};
```

### 复杂条件的圆角配置

```typescript
const complexRadius: IStackCornerRadiusCallback = (attr, datum, ctx) => {
  const value = datum.value as number;
  const category = datum.category as string;
  const isHighlight = datum.highlight as boolean;

  // 高亮状态的特殊处理
  if (isHighlight) {
    return [16, 16, 4, 4];
  }

  // 不同分类使用不同圆角策略
  switch (category) {
    case 'premium':
      return value > 200 ? [12, 12, 0, 0] : [8, 8, 0, 0];
    case 'standard':
      return value > 100 ? 8 : 4;
    case 'basic':
      return 2;
    default:
      return 0;
  }
};
```

### 基于区域位置的圆角

```typescript
const regionBasedRadius: IStackCornerRadiusCallback = (attr, datum, ctx) => {
  const region = ctx.getRegion();
  const regionWidth = region.getLayoutRect().width;
  const regionHeight = region.getLayoutRect().height;

  // 根据图表区域大小调整圆角
  if (regionWidth > 800 && regionHeight > 600) {
    return 16; // 大图表使用大圆角
  } else if (regionWidth > 400 && regionHeight > 300) {
    return 8; // 中图表使用中圆角
  } else {
    return 4; // 小图表使用小圆角
  }
};
```
