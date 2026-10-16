# IArcLabelSpec Type Definition

## Overview

```typescript
type IArcLabelSpec = Omit<ILabelSpec, 'position'> & {
  // Arc label positioning
  position?: 'outside' | 'inside' | 'inside-center'; // Label position relative to arc

  // Display rules
  showRule?: 'all' | 'max' | 'min' | 'minAndMax' | 'headAndTail'; // Label content display rules
  coverEnable?: boolean; // Allow label overlapping
  rotate?: boolean; // Allow label rotation

  // Spacing configuration
  spaceWidth?: number; // Gap between text and guide line
  layoutArcGap?: number; // Gap between arc sector labels
  centerOffset?: number; // Center point offset distance

  // Style configuration
  style?: ITextMarkSpec; // Label text style
  line?: IArcLabelLineSpec; // Guide line configuration
  layout?: IArcLabelLayoutSpec; // Layout configuration

  // Inherited from ILabelSpec
  formatMethod?: IFormatMethod<[text: string | string[], datum?: Datum]>; // Label format function
  visible?: boolean; // Label visibility
  zIndex?: number; // Layer index
  interactive?: boolean; // Interaction capability
  state?: IMarkStateFullSpec<ITextMarkSpec>; // State-based styles
};
```

## Guide Line Configuration

```typescript
interface IArcLabelLineSpec extends Omit<IMarkSpec<ILineMarkSpec>, 'customShape'> {
  visible?: boolean; // Guide line visibility @default true
  line1MinLength?: number; // Line1 segment minimum length @default 20
  line2MinLength?: number; // Line2 segment minimum length @default 10
  smooth?: boolean; // Smooth guide line curves @default false @since 1.4.0

  // Custom guide line path function @since 1.11.11
  customShape?: (
    text: ITextGraphicAttribute,
    attrs: Partial<ILineGraphicAttribute>,
    path: ICustomPath2D
  ) => ICustomPath2D;
}
```

## Layout Configuration

```typescript
interface IArcLabelLayoutSpec {
  textAlign?: ArcLabelAlignType; // Label alignment method @default 'arc'
  align?: ArcLabelAlignType; // @deprecated Use textAlign instead
  strategy?: ArcLabelStrategyType; // Label layout strategy @default 'priority'
  tangentConstraint?: boolean; // Enable tangent constraint @default true
}
```

## Arc Label Types

```typescript
type ArcLabelPosition = 'outside' | 'inside' | 'inside-center';
type ArcLabelShowRule = 'all' | 'max' | 'min' | 'minAndMax' | 'headAndTail';
type ArcLabelAlignType = 'arc' | 'labelLine' | 'edge';
type ArcLabelStrategyType = 'priority' | 'vertical' | 'none';
```

## Format Method Type

```typescript
type IFormatMethod<T extends any[]> = (
  ...args: T
) => ReturnType<ITextFormatMethod<T>> | ReturnType<IRichTextFormatMethod<T>>;

type ITextFormatMethod<T extends any[]> = (
  ...args: T
) => ITextMarkSpec['text'] | { type: 'text'; text: ITextMarkSpec['text'] };

type IRichTextFormatMethod<T extends any[]> = (...args: T) =>
  | {
      type: 'rich';
      text: IRichTextCharacter[];
    }
  | IRichTextCharacter[];

interface IRichTextCharacter {
  text: string; // Text content
  fill?: string; // Text color
  fontSize?: number; // Font size
  fontFamily?: string; // Font family
  fontWeight?: FontWeight; // Font weight
  fontStyle?: FontStyle; // Font style
  textDecoration?: 'none' | 'underline' | 'line-through'; // Text decoration
  script?: 'normal' | 'sub' | 'super'; // Text script
}
```

````

## Format Method Type

```typescript
type IFormatMethod<T extends any[]> = (
  ...args: T
) => ReturnType<ITextFormatMethod<T>> | ReturnType<IRichTextFormatMethod<T>>;

type ITextFormatMethod<T extends any[]> = (
  ...args: T
) => ITextMarkSpec['text'] | { type: 'text'; text: ITextMarkSpec['text'] };

type IRichTextFormatMethod<T extends any[]> = (...args: T) =>
  | {
      type: 'rich';
      text: IRichTextCharacter[];
    }
  | IRichTextCharacter[];

interface IRichTextCharacter {
  text: string; // Text content
  fill?: string; // Text color
  fontSize?: number; // Font size
  fontFamily?: string; // Font family
  fontWeight?: FontWeight; // Font weight
  fontStyle?: FontStyle; // Font style
  textDecoration?: 'none' | 'underline' | 'line-through'; // Text decoration
  script?: 'normal' | 'sub' | 'super'; // Text script
}
````

**IFormatMethod 格式化方法：**
接收文本和数据参数，返回格式化后的文本内容或富文本配置。

## Arc Label Position Type

```typescript
type ArcLabelPosition = 'outside' | 'inside' | 'inside-center';
```

**ArcLabelPosition 弧形标签位置：**

- `'outside'`: 标签位于扇形外部
- `'inside'`: 标签位于扇形内部
- `'inside-center'`: 标签位于扇形中心区域

## Show Rule Type

```typescript
type ArcLabelShowRule = 'all' | 'max' | 'min' | 'minAndMax' | 'headAndTail';
```

**ArcLabelShowRule 标签显示规则：**

- `'all'`: 显示所有标签
- `'max'`: 仅显示最大值标签
- `'min'`: 仅显示最小值标签
- `'minAndMax'`: 显示最大和最小值标签
- `'headAndTail'`: 显示首尾标签

## Text Mark Specification

```typescript
interface ITextMarkSpec extends IFillMarkSpec {
  // Text content
  text?: string | number | string[] | number[]; // Text content
  dx?: number; // X offset
  dy?: number; // Y offset

  // Typography
  fontSize?: number | ITokenKey; // Font size
  textAlign?: TextAlign; // Horizontal alignment
  textBaseline?: TextBaseLine; // Vertical alignment
  fontFamily?: string; // Font family
  fontWeight?: FontWeight; // Font weight
  fontStyle?: FontStyle; // Font style

  // Text processing
  maxLineWidth?: number; // Maximum line width
  ellipsis?: string; // Ellipsis character
  suffixPosition?: 'start' | 'end' | 'middle'; // Suffix position
  lineHeight?: number | string | ITokenKey; // Line height
  direction?: 'horizontal' | 'vertical'; // Text direction
  wordBreak?: 'break-word' | 'break-all' | 'keep-all'; // Word breaking
  heightLimit?: number; // Height constraint
  lineClamp?: number; // Line clamping
  whiteSpace?: 'normal' | 'no-wrap'; // White space handling

  // Decorations
  underline?: boolean; // Underline style
  underlineDash?: number[]; // Underline dash pattern
  underlineOffset?: number; // Underline offset
  lineThrough?: boolean; // Strike-through style
}
```

## Typography Types

```typescript
type TextAlign = 'left' | 'center' | 'right' | 'start' | 'end';
type TextBaseLine = 'top' | 'hanging' | 'middle' | 'alphabetic' | 'ideographic' | 'bottom';
type FontWeight = 'normal' | 'bold' | 'lighter' | 'bolder' | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
type FontStyle = 'normal' | 'italic' | 'oblique' | string;
```

## Guide Line Configuration

```typescript
interface IArcLabelLineSpec extends Omit<IMarkSpec<ILineMarkSpec>, 'customShape'> {
  visible?: boolean; // Guide line visibility @default true
  line1MinLength?: number; // Line1 segment minimum length @default 20
  line2MinLength?: number; // Line2 segment minimum length @default 10
  smooth?: boolean; // Smooth guide line curves @default false @since 1.4.0

  // Custom guide line path function @since 1.11.11
  customShape?: (
    text: ITextGraphicAttribute,
    attrs: Partial<ILineGraphicAttribute>,
    path: ICustomPath2D
  ) => ICustomPath2D;

  // Inherited from IMarkSpec<ILineMarkSpec>
  id?: string | number; // Mark identifier
  interactive?: boolean; // Interaction capability
  zIndex?: number; // Layer order
  style?: ConvertToMarkStyleSpec<ILineMarkSpec>; // Line style
  state?: IMarkStateFullSpec<ILineMarkSpec>; // State configurations
}
```

**IArcLabelLineSpec 引导线配置：**
定义弧形标签引导线的样式和行为，包括线段长度、平滑度和自定义路径等。

## Layout Configuration

```typescript
interface IArcLabelLayoutSpec {
  textAlign?: ArcLabelAlignType; // Label alignment method @default 'arc'
  align?: ArcLabelAlignType; // @deprecated Use textAlign instead
  strategy?: ArcLabelStrategyType; // Label layout strategy @default 'priority'
  tangentConstraint?: boolean; // Enable tangent constraint @default true
}
```

**IArcLabelLayoutSpec 布局配置：**
控制弧形标签的对齐方式、布局策略和切线约束等高级布局选项。

## Arc Label Alignment Type

```typescript
type ArcLabelAlignType = 'arc' | 'labelLine' | 'edge';
```

**ArcLabelAlignType 弧形标签对齐：**

- `'arc'`: 与弧形曲率对齐
- `'labelLine'`: 与引导线方向对齐
- `'edge'`: 与扇形边缘对齐

## Arc Label Strategy Type

```typescript
type ArcLabelStrategyType = 'priority' | 'vertical' | 'none';
```

**ArcLabelStrategyType 布局策略：**

- `'priority'`: 基于优先级的布局，包含重叠解决
- `'vertical'`: 垂直对齐优化
- `'none'`: 无自动布局调整

## Mark Specification Types

```typescript
interface IMarkSpec<T extends ICommonSpec = ICommonSpec> {
  id?: string | number; // Mark identifier
  interactive?: boolean; // Interaction capability
  zIndex?: number; // Layer order
  visible?: boolean; // Visibility state
  style?: ConvertToMarkStyleSpec<T>; // Visual styles
  state?: IMarkStateFullSpec<T>; // State configurations
  support3d?: boolean; // 3D rendering support
  customShape?: (datum: any[], attrs: any, path: ICustomPath2D) => ICustomPath2D; // Custom geometry
}

interface ILineMarkSpec extends ILineLikeMarkSpec {
  lineCap?: LineStrokeCap; // Line cap style
  lineJoin?: LineStrokeJoin; // Line join style
  miterLimit?: number; // Miter limit
  strokeBoundsBuffer?: number; // Stroke bounds buffer
}

interface ILineLikeMarkSpec extends IFillMarkSpec {
  curveType?: InterpolateType; // Interpolation type
  defined?: boolean; // Point validity flag
}

interface IFillMarkSpec extends ICommonSpec {
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
}
```

## State Management Types

```typescript
type IMarkStateFullSpec<T> = {
  hover?: IMarkStateSpec<T> | IMarkStateStyleSpec<T>; // Hover state
  hover_reverse?: IMarkStateSpec<T> | IMarkStateStyleSpec<T>; // Non-hover state
  selected?: IMarkStateSpec<T> | IMarkStateStyleSpec<T>; // Selected state
  selected_reverse?: IMarkStateSpec<T> | IMarkStateStyleSpec<T>; // Non-selected state
};

type IMarkStateSpec<T> = {
  style?: ConvertToMarkStyleSpec<T>; // State style
  filter?: IMarkStateFilter; // State filter
  level?: StateLevel; // State level
};

type IMarkStateStyleSpec<T> = ConvertToMarkStyleSpec<T>;

type ConvertToMarkStyleSpec<T extends Record<string, any>> = {
  [key in keyof T]: VisualType<T[key]>;
};
```

## Line Style Types

```typescript
type LineStrokeCap = 'butt' | 'round' | 'square';
type LineStrokeJoin = 'arcs' | 'bevel' | 'miter' | 'miter-clip' | 'round';

type InterpolateType =
  | 'basis'
  | 'bundle'
  | 'cardinal'
  | 'catmull-rom'
  | 'linear'
  | 'monotone-x'
  | 'monotone-y'
  | 'natural'
  | 'step'
  | 'step-after'
  | 'step-before';
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

interface ITokenKey {
  // Token theme key interface
}
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

interface ITextGraphicAttribute {
  // Text rendering attributes from @visactor/vrender-core
}

interface ILineGraphicAttribute {
  // Line rendering attributes from @visactor/vrender-core
}

interface ICustomPath2D {
  // Path construction interface from @visactor/vrender-core
}

interface ICommonSpec {
  // Common mark specification interface
}
```
