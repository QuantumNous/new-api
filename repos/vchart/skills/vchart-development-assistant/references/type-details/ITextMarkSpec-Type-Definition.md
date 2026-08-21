## Overview

```typescript
interface ITextMarkSpec extends IFillMarkSpec {
  // Text-specific properties
  text?: string | number | string[] | number[]; // Text content
  dx?: number; // X direction offset
  dy?: number; // Y direction offset

  // Typography properties
  fontSize?: number | ITokenKey; // Font size
  textAlign?: TextAlign; // Horizontal alignment
  textBaseline?: TextBaseLine; // Vertical alignment
  fontFamily?: string; // Font family
  fontWeight?: FontWeight; // Font weight
  fontStyle?: FontStyle; // Font style

  // Text overflow and layout
  maxLineWidth?: number; // Maximum line width
  ellipsis?: string; // Ellipsis character
  suffixPosition?: 'start' | 'end' | 'middle'; // Ellipsis position
  lineHeight?: number | string | ITokenKey; // Line height
  direction?: 'horizontal' | 'vertical'; // Layout direction
  wordBreak?: 'break-word' | 'break-all' | 'keep-all'; // Word breaking
  heightLimit?: number; // Height limit
  lineClamp?: number; // Line count limit
  whiteSpace?: 'normal' | 'no-wrap'; // Whitespace handling

  // Text decorations
  underline?: boolean; // Underline decoration
  underlineDash?: number[]; // Underline dash style
  underlineOffset?: number; // Underline offset
  lineThrough?: boolean; // Line-through decoration

  // Interactive features
  poptip?: PopTipAttributes; // PopTip configuration

  // Inherited from IFillMarkSpec
  // Shadow effects
  shadowBlur?: number; // Shadow blur radius
  shadowColor?: string; // Shadow color
  shadowOffsetX?: number; // Shadow X offset
  shadowOffsetY?: number; // Shadow Y offset
  // Fill properties
  fill?: VisualType<string> | IGradient | false | IColorKey; // Fill color
  fillOpacity?: number; // Fill opacity
  // Background properties
  background?: IColor | HTMLImageElement | HTMLCanvasElement | null; // Background fill
  backgroundMode?: 'repeat' | 'repeatX' | 'repeatY' | 'noRepeat'; // Background repeat mode @default 'repeat'
  backgroundFit?: 'contain' | 'cover' | 'fill'; // Background fit mode @default 'cover'
  backgroundKeepAspectRatio?: boolean; // Maintain background aspect ratio @default false
  backgroundScale?: number; // Background scale factor @default 1
  backgroundOffsetX?: number; // Background X offset @default 0
  backgroundOffsetY?: number; // Background Y offset @default 0
  backgroundClip?: boolean; // Enable background clipping @default true
  backgroundCornerRadius?: number; // Background corner radius @default 0
  backgroundOpacity?: number; // Background opacity @default 1

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

## Core Configuration Properties

### TextureType

```typescript
type TextureType = 'circle' | 'dimond' | 'rect' | 'vertical-line' | 'horizontal-line' | 'bias-lr' | 'bias-rl' | 'grid';
```

### Border Configuration (Inherited from ICommonSpec)

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

### Typography Types

```typescript
// 原始类型定义
type TextAlign = TextAlignType;
type TextBaseLine = TextBaselineType;

// 解析后的具体类型
type TextAlignType = 'left' | 'center' | 'right' | 'start' | 'end' | 'justify';
type TextBaselineType = 'top' | 'bottom' | 'middle' | 'alphabetic' | 'hanging' | 'ideographic';

type FontStyle = 'normal' | 'italic' | 'oblique' | string;
type FontWeight = 'normal' | 'bold' | 'lighter' | 'bolder' | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
```

**TextAlignType 文字水平对齐：**

- `'left'`: 左对齐
- `'center'`: 居中对齐
- `'right'`: 右对齐
- `'start'`: 起始对齐（在LTR中等同于左对齐，在RTL中等同于右对齐）
- `'end'`: 结束对齐（在LTR中等同于右对齐，在RTL中等同于左对齐）
- `'justify'`: 两端对齐

**TextBaselineType 文字垂直对齐：**

- `'top'`: 顶部对齐
- `'bottom'`: 底部对齐
- `'middle'`: 中心对齐
- `'alphabetic'`: 字母基线对齐（默认值）
- `'hanging'`: 悬挂基线对齐
- `'ideographic'`: 表意文字基线对齐

### Theme and Token Types

```typescript
interface IColorKey {
  // Theme color key interface
}

interface ITokenKey {
  // Theme token key interface
}

interface IColor {
  // VRender color interface
}
```

### Interactive Types

```typescript
interface PopTipAttributes {
  // PopTip configuration from @visactor/vrender-components
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
