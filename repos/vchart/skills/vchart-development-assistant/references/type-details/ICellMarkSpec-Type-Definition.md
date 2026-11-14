# ICellMarkSpec Type Definition

## Overview

```typescript
interface ICellMarkSpec extends ISymbolMarkSpec {
  // Cell-specific properties
  padding?: number | number[] | IPadding; // Cell padding configuration

  // Inherited from ISymbolMarkSpec
  dx?: number; // X offset
  dy?: number; // Y offset
  size?: number | number[]; // Symbol size
  shape?: ShapeType | string; // Shape type
  symbolType?: ShapeType | string; // Symbol type alias
  scaleX?: number; // X-scale factor
  scaleY?: number; // Y-scale factor

  // Inherited from IFillMarkSpec
  fill?: VisualType<string> | IGradient | false | IColorKey; // Fill color
  fillOpacity?: number; // Fill opacity
  background?: IColor | HTMLImageElement | HTMLCanvasElement | null; // Background

  // Inherited from ICommonSpec
  visible?: boolean; // Visibility
  x?: number; // X coordinate
  y?: number; // Y coordinate
  z?: number; // Z coordinate (3D)
  stroke?: string | IGradient | false | (number | boolean)[] | IColorKey | null; // Stroke color
  strokeOpacity?: number; // Stroke opacity
  opacity?: number; // Overall opacity
  lineWidth?: number; // Stroke width
  lineDash?: number[]; // Dash pattern
  lineDashOffset?: number; // Dash offset
  cursor?: Cursor; // Mouse cursor
  zIndex?: number; // Layer index
  angle?: number; // Rotation angle
  anchor?: [number, number]; // Anchor point
  scaleCenter?: [number | string, number | string]; // Scale center

  // 3D properties
  alpha?: number; // X-direction rotation
  beta?: number; // Y-direction rotation
  anchor3d?: [number, number]; // 3D anchor point

  // Interaction properties
  pickMode?: 'accurate' | 'imprecise' | 'custom';
  boundsMode?: 'accurate' | 'imprecise';
  pickStrokeBuffer?: number; // Stroke pick buffer

  // Texture properties
  texture?: TextureType | string; // Texture type
  textureColor?: string; // Texture color
  textureSize?: number; // Texture size
  texturePadding?: number; // Texture padding

  // Border properties
  outerBorder?: IBorder; // Outer border
  innerBorder?: IBorder; // Inner border

  // HTML overlay
  html?: IMarkHtmlSpec; // HTML overlay
}
```

## Padding Configuration

```typescript
interface IPadding {
  top?: number; // Top padding
  bottom?: number; // Bottom padding
  left?: number; // Left padding
  right?: number; // Right padding
}
```

**IPadding 填充配置：**
定义单元格内边距，支持上下左右独立设置。

## Shape Type

```typescript
type ShapeType =
  | 'circle'
  | 'cross'
  | 'diamond'
  | 'square'
  | 'star'
  | 'triangle'
  | 'wye'
  | 'rect'
  | 'line'
  | 'roundrect'
  | 'path';
```

**ShapeType 形状类型：**
定义符号标记支持的基础几何形状。

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
