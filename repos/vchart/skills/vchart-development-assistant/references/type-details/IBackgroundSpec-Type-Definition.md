## IBackgroundSpec 配置规范

IBackgroundSpec 定义了 VChart 中背景样式的配置接口，支持纯色背景和复杂的图形样式背景两种类型。

## 核心接口结构

```typescript
export type IBackgroundSpec = IColor | ConvertToMarkStyleSpec<IGroupMarkSpec>;
```

## 背景类型说明

IBackgroundSpec 支持两种主要的背景配置方式：

### 简单颜色背景
```typescript
type SimpleBackground = IColor;
```

### 复杂图形背景
```typescript
type ComplexBackground = ConvertToMarkStyleSpec<IGroupMarkSpec>;
```

## 简单颜色背景 (IColor)

使用 VRender 的颜色类型，支持多种颜色格式：

```typescript
// IColor 来自 @visactor/vrender-core
type IColor = string | ILinearGradient | IRadialGradient | IConicalGradient;

// 支持的颜色格式示例：
type ColorFormats = 
  | '#ff0000'           // 十六进制
  | 'red'               // 颜色名称
  | 'rgb(255, 0, 0)'    // RGB
  | 'rgba(255, 0, 0, 0.5)' // RGBA
  | 'hsl(0, 100%, 50%)' // HSL
  | ILinearGradient     // 线性渐变
  | IRadialGradient     // 径向渐变
  | IConicalGradient;   // 圆锥渐变
```

## 复杂图形背景 (ConvertToMarkStyleSpec<IGroupMarkSpec>)

### 样式转换类型
```typescript
export type ConvertToMarkStyleSpec<T extends Record<string, any>> = {
  [key in keyof T]: VisualType<T[key]>;
};

export type VisualType<T> = ValueType<T> | FunctionType<T> | IVisual<unknown, T>;
export type ValueType<T> = T;
export type FunctionType<T> = (datum: Datum, context: IModelMarkAttributeContext, source?: DataView) => T;
```

### IGroupMarkSpec 基础接口
```typescript
export interface IGroupMarkSpec extends IFillMarkSpec {
  /** 是否开启裁剪 */
  clip?: boolean;
  /** 宽度 */
  width?: number;
  /** 高度 */
  height?: number;
  /**
   * 圆角配置
   * 1. 如果传入数值，则统一为四个角设置圆角
   * 2. 如果传入数组，则分别为 [上左, 上右, 下右, 下左]
   */
  cornerRadius?: number | number[];
}
```

### IFillMarkSpec 填充样式
```typescript
export interface IFillMarkSpec extends ICommonSpec {
  // 阴影效果
  shadowBlur?: number; // 阴影模糊半径
  shadowColor?: string; // 阴影颜色
  shadowOffsetX?: number; // 阴影 X 偏移
  shadowOffsetY?: number; // 阴影 Y 偏移

  // 填充属性
  fill?: VisualType<string> | IGradient | false | IColorKey; // 图形的填充颜色
  fillOpacity?: number; // 填充的透明度

  // 背景属性
  background?: IColor | HTMLImageElement | HTMLCanvasElement | null; // 背景填充
  backgroundMode?: 'repeat' | 'repeatX' | 'repeatY' | 'noRepeat'; // 背景重复模式 @default 'repeat'
  backgroundFit?: 'contain' | 'cover' | 'fill'; // 背景适应模式 @default 'cover'
  backgroundKeepAspectRatio?: boolean; // 保持背景宽高比 @default false
  backgroundScale?: number; // 背景缩放因子 @default 1
  backgroundOffsetX?: number; // 背景 X 偏移 @default 0
  backgroundOffsetY?: number; // 背景 Y 偏移 @default 0
  backgroundClip?: boolean; // 启用背景裁剪 @default true
  backgroundCornerRadius?: number; // 背景圆角半径 @default 0
  backgroundOpacity?: number; // 背景透明度 @default 1
  /**
   * 图形的背景色，支持纯色、image元素、canvas元素
   */
  background?: IColor | HTMLImageElement | HTMLCanvasElement | null;
}
```

### ICommonSpec 通用样式
```typescript
export interface ICommonSpec {
  // 位置属性
  x?: VisualType<number>;
  y?: VisualType<number>;
  z?: VisualType<number>;
  
  // 描边属性
  stroke?: VisualType<string> | IGradient | false;
  strokeOpacity?: VisualType<number>;
  lineWidth?: VisualType<number>;
  lineDash?: VisualType<number[]>;
  lineDashOffset?: VisualType<number>;
  lineCap?: VisualType<'butt' | 'round' | 'square'>;
  lineJoin?: VisualType<'arcs' | 'bevel' | 'miter' | 'miter-clip' | 'round'>;
  
  // 显示属性
  visible?: VisualType<boolean>;
  opacity?: VisualType<number>;
  zIndex?: VisualType<number>;
  
  // 变换属性
  scaleX?: VisualType<number>;
  scaleY?: VisualType<number>;
  angle?: VisualType<number>;
  
  // 边框属性
  outerBorder?: IBorder;
  innerBorder?: IBorder;
  
  // 纹理属性
  texture?: TextureType | string;
  textureColor?: string;
  textureSize?: number;
  texturePadding?: number;
}
```

## 完整类型定义

```typescript
export type IBackgroundSpec = IColor | {
  // 基础位置
  x?: VisualType<number>;
  y?: VisualType<number>;
  z?: VisualType<number>;
  
  // 尺寸和形状
  width?: VisualType<number>;
  height?: VisualType<number>;
  cornerRadius?: VisualType<number | number[]>;
  clip?: VisualType<boolean>;
  
  // 填充样式
  fill?: VisualType<string> | IGradient | false | IColorKey;
  fillOpacity?: VisualType<number>;
  background?: VisualType<IColor | HTMLImageElement | HTMLCanvasElement | null>;
  
  // 描边样式
  stroke?: VisualType<string> | IGradient | false;
  strokeOpacity?: VisualType<number>;
  lineWidth?: VisualType<number>;
  lineDash?: VisualType<number[]>;
  lineDashOffset?: VisualType<number>;
  lineCap?: VisualType<'butt' | 'round' | 'square'>;
  lineJoin?: VisualType<'arcs' | 'bevel' | 'miter' | 'miter-clip' | 'round'>;
  
  // 显示控制
  visible?: VisualType<boolean>;
  opacity?: VisualType<number>;
  zIndex?: VisualType<number>;
  
  // 变换属性
  scaleX?: VisualType<number>;
  scaleY?: VisualType<number>;
  angle?: VisualType<number>;
  
  // 边框效果
  outerBorder?: IBorder;
  innerBorder?: IBorder;
  
  // 纹理效果
  texture?: TextureType | string;
  textureColor?: string;
  textureSize?: number;
  texturePadding?: number;
};
```

## 支持类型定义

### 边框配置
```typescript
export interface IBorder {
  /** 边框离图形边缘的距离 */
  distance: number | string;
  /** 边框的颜色 */
  stroke?: string | IGradient;
  /** 边框的透明度 */
  strokeOpacity?: number;
  /** 边框线的宽度 */
  lineWidth?: number;
  /** 给边框配置虚线模式 */
  lineDash?: number[];
  /** 设置边框的虚线偏移量 */
  lineDashOffset?: number;
}
```

### 纹理类型
```typescript
export type TextureType =
  | 'circle'
  | 'dimond'
  | 'rect'
  | 'vertical-line'
  | 'horizontal-line'
  | 'bias-line'
  | 'bias-rl-line'
  | 'grid';
```

### 渐变类型
```typescript
// 线性渐变
interface ILinearGradient {
  gradient: 'linear';
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  stops: Array<{ offset: number; color: string; }>;
}

// 径向渐变
interface IRadialGradient {
  gradient: 'radial';
  x0: number;
  y0: number;
  r0: number;
  x1: number;
  y1: number;
  r1: number;
  stops: Array<{ offset: number; color: string; }>;
}

// 圆锥渐变
interface IConicalGradient {
  gradient: 'conical';
  x: number;
  y: number;
  startAngle: number;
  endAngle: number;
  stops: Array<{ offset: number; color: string; }>;
}
```

## 使用示例

### 简单颜色背景
```typescript
// 纯色背景
const solidBackground: IBackgroundSpec = '#f0f0f0';

// 渐变背景
const gradientBackground: IBackgroundSpec = {
  gradient: 'linear',
  x0: 0,
  y0: 0,
  x1: 0,
  y1: 1,
  stops: [
    { offset: 0, color: '#4facfe' },
    { offset: 1, color: '#00f2fe' }
  ]
};
```

### 复杂图形背景
```typescript
// 基础矩形背景
const rectBackground: IBackgroundSpec = {
  fill: '#ffffff',
  stroke: '#e0e0e0',
  lineWidth: 1,
  cornerRadius: 8,
  fillOpacity: 0.9
};

// 带纹理的背景
const textureBackground: IBackgroundSpec = {
  fill: '#f5f5f5',
  texture: 'grid',
  textureColor: '#cccccc',
  textureSize: 10,
  texturePadding: 2
};

// 带边框效果的背景
const borderBackground: IBackgroundSpec = {
  fill: 'rgba(255, 255, 255, 0.8)',
  outerBorder: {
    distance: 4,
    stroke: '#4facfe',
    lineWidth: 2,
    strokeOpacity: 0.6
  },
  cornerRadius: [8, 8, 0, 0]
};
```

### 动态背景配置
```typescript
// 基于数据的动态背景
const dynamicBackground: IBackgroundSpec = {
  fill: (datum: any) => {
    return datum.value > 100 ? '#ff6b6b' : '#4ecdc4';
  },
  fillOpacity: (datum: any) => {
    return Math.min(datum.value / 200, 1);
  },
  cornerRadius: 4
};

// 响应式背景
const responsiveBackground: IBackgroundSpec = {
  fill: '#ffffff',
  stroke: '#e0e0e0',
  lineWidth: 1,
  width: (datum: any, context: any) => {
    return context.region.getLayoutRect().width;
  },
  height: (datum: any, context: any) => {
    return context.region.getLayoutRect().height;
  }
};
```

### 特殊效果背景
```typescript
// 阴影效果背景
const shadowBackground: IBackgroundSpec = {
  fill: '#ffffff',
  stroke: 'none',
  outerBorder: {
    distance: 0,
    stroke: 'rgba(0, 0, 0, 0.1)',
    lineWidth: 8
  },
  cornerRadius: 12
};

// 多层边框背景
const multiLayerBackground: IBackgroundSpec = {
  fill: '#ffffff',
  outerBorder: {
    distance: 2,
    stroke: '#4facfe',
    lineWidth: 2
  },
  innerBorder: {
    distance: 2,
    stroke: '#e0e0e0',
    lineWidth: 1
  },
  cornerRadius: 6
};
```
