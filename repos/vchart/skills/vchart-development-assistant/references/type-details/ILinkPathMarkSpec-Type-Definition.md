# ILinkPathMarkSpec Type Definition

## Overview

```typescript
interface ILinkPathMarkSpec extends IFillMarkSpec {
  // Link path-specific properties
  x0?: number; // Start point x coordinate
  y0?: number; // Start point y coordinate
  x1?: number; // End point x coordinate
  y1?: number; // End point y coordinate
  thickness?: number; // Path thickness/width
  curvature?: number; // Path curvature (0-1, default 0.5)
  round?: boolean; // Round all coordinates
  ratio?: number; // Normal style path ratio
  align?: 'start' | 'end' | 'center'; // Alignment
  pathType?: 'line' | 'smooth' | 'polyline'; // Path type
  endArrow?: boolean; // Show end arrow
  startArrow?: boolean; // Show start arrow
  backgroundStyle?: any; // Background line style
  direction?: 'horizontal' | 'vertical' | 'LR' | 'RL' | 'TB' | 'BL' | 'radial'; // Path direction

  // Inherited from IFillMarkSpec
  fill?: VisualType<string> | IGradient | false | IColorKey;
  fillOpacity?: number;
  background?: IColor | HTMLImageElement | HTMLCanvasElement | null;

  // Inherited from ICommonSpec
  visible?: boolean; // Visibility
  x?: number; // X coordinate
  y?: number; // Y coordinate
  z?: number; // Z coordinate (3D)
  stroke?: string | IGradient | false | (number | boolean)[] | IColorKey | null;
  strokeOpacity?: number; // Stroke opacity
  opacity?: number; // Overall opacity
  lineWidth?: number; // Stroke width
  lineDash?: number[]; // Dash pattern
  lineDashOffset?: number; // Dash offset
  cursor?: Cursor; // Mouse cursor
  zIndex?: number; // Layer index
  angle?: number; // Rotation angle
  anchor?: [number, number]; // Anchor point
  scaleX?: number; // X-scale factor
  scaleY?: number; // Y-scale factor
  scaleCenter?: [number | string, number | string]; // Scale center

  // 3D properties
  alpha?: number; // X-direction rotation
  beta?: number; // Y-direction rotation
  anchor3d?: [number, number]; // 3D anchor point

  // Interaction properties
  pickMode?: 'accurate' | 'imprecise' | 'custom';
  boundsMode?: 'accurate' | 'imprecise';
  pickStrokeBuffer?: number; // Stroke pick buffer @since 1.7.3

  // Texture properties
  texture?: TextureType | string; // Texture type
  textureColor?: string; // Texture color
  textureSize?: number; // Texture size
  texturePadding?: number; // Texture padding

  // Border properties
  outerBorder?: IBorder; // Outer border
  innerBorder?: IBorder; // Inner border

  // HTML overlay
  html?: IMarkHtmlSpec; // HTML overlay @since 1.10.0
}
```

## Path Type

```typescript
type PathType = 'line' | 'smooth' | 'polyline';
```

**PathType 路径类型：**

- `'line'`: 直线路径
- `'smooth'`: 平滑路径
- `'polyline'`: 多段线路径

## Path Alignment

```typescript
type PathAlign = 'start' | 'end' | 'center';
```

**PathAlign 路径对齐方式：**

- `'start'`: 起点对齐
- `'end'`: 终点对齐
- `'center'`: 中心对齐

## Path Direction

```typescript
type PathDirection = 'horizontal' | 'vertical' | 'LR' | 'RL' | 'TB' | 'BL' | 'radial';
```

**PathDirection 路径方向：**

- `'horizontal'`: 水平方向
- `'vertical'`: 垂直方向
- `'LR'`: 从左到右
- `'RL'`: 从右到左
- `'TB'`: 从上到下
- `'BL'`: 从下到左
- `'radial'`: 径向方向

## TextureType

```typescript
type TextureType = 'circle' | 'dimond' | 'rect' | 'vertical-line' | 'horizontal-line' | 'bias-lr' | 'bias-rl' | 'grid';
```

## Border Configuration

```typescript
interface IBorder {
  /** Distance from shape edge */
  distance: number | string;

  /** Border color */
  stroke?: string | IGradient;

  /** Border opacity */
  strokeOpacity?: number;

  /** Border width */
  lineWidth?: number;

  /** Border dash pattern */
  lineDash?: number[];

  /** Border dash offset */
  lineDashOffset?: number;
}
```

## Visual Type System

### Visual Mapping Types

```typescript
type VisualType<T> = ValueType<T> | FunctionType<T> | IVisual<unknown, T>;

type ValueType<T> = T;
type FunctionType<T> = (datum: Datum, context: IModelMarkAttributeContext, source?: DataView) => T;

type IVisual<D, R> = IVisualSpecStyle<D, R> | IVisualScale;

interface IVisualSpecStyle<D, T> extends IVisualSpecBase<D, T> {
  /** Data field for mapping */
  field?: string;
}

interface IVisualScale {
  /** Scale ID reference */
  scale: string;

  /** Data field for mapping */
  field?: string;

  /** Domain change strategy @default 'none' */
  changeDomain?: 'none' | 'replace' | 'expand';
}
```

### Gradient Types

```typescript
type IGradient = IGradientLinear | IGradientRadial | IGradientConical;

interface IGradientLinear {
  gradient: 'linear';
  x0?: GradientPropValue<number>; // Start x (0-1)
  y0?: GradientPropValue<number>; // Start y (0-1)
  x1?: GradientPropValue<number>; // End x (0-1)
  y1?: GradientPropValue<number>; // End y (0-1)
  stops: GradientStop[];
}

interface IGradientRadial {
  gradient: 'radial';
  r0?: GradientPropValue<number>; // Start radius
  x0?: GradientPropValue<number>; // Start x
  y0?: GradientPropValue<number>; // Start y
  x1?: GradientPropValue<number>; // End x
  y1?: GradientPropValue<number>; // End y
  r1?: GradientPropValue<number>; // End radius
  stops: GradientStop[];
}

interface IGradientConical {
  gradient: 'conical';
  x?: GradientPropValue<number>; // Center x
  y?: GradientPropValue<number>; // Center y
  startAngle?: GradientPropValue<number>; // Start angle
  endAngle?: GradientPropValue<number>; // End angle
  stops: GradientStop[];
}

type GradientStop = {
  offset: GradientPropValue<number>; // 0-1 offset
  color?: GradientPropValue<string>; // Color
  opacity?: number; // Opacity
};

type GradientPropValue<T> = ValueType<T> | FunctionType<T>;
```

## Dependency Type Definitions

### Theme and Color Types

```typescript
interface IColorKey {
  // Theme color key interface
}

interface IColor {
  // VRender color interface
}
```

### HTML Overlay Types

```typescript
type IMarkHtmlSpec = Partial<IGraphicStyle['html']>;

interface IGraphicStyle {
  html?: {
    // HTML overlay configuration
  };
}
```

### Cursor Types

```typescript
type Cursor =
  | 'auto'
  | 'default'
  | 'none'
  | 'context-menu'
  | 'help'
  | 'pointer'
  | 'progress'
  | 'wait'
  | 'cell'
  | 'crosshair'
  | 'text'
  | 'vertical-text'
  | 'alias'
  | 'copy'
  | 'move'
  | 'no-drop'
  | 'not-allowed'
  | 'grab'
  | 'grabbing'
  | 'e-resize'
  | 'n-resize'
  | 'ne-resize'
  | 'nw-resize'
  | 's-resize'
  | 'se-resize'
  | 'sw-resize'
  | 'w-resize'
  | 'ew-resize'
  | 'ns-resize'
  | 'nesw-resize'
  | 'nwse-resize'
  | 'col-resize'
  | 'row-resize'
  | 'all-scroll'
  | 'zoom-in'
  | 'zoom-out';
```

### Context Types

```typescript
interface IModelMarkAttributeContext {
  // Mark attribute context for function evaluation
}

interface Datum {
  // Data record interface
  [key: string]: any;
}
```
