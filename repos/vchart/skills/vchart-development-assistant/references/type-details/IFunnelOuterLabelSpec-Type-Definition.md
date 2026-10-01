# IFunnelOuterLabelSpec Type Definition

## Overview

```typescript
interface IFunnelOuterLabelSpec extends IMarkSpec<IComposedTextMarkSpec> {
  // Label formatting and positioning
  formatMethod?: IFormatMethod<[text: string | string[], datum?: Datum]>; // Label format function
  position?: 'left' | 'right' | 'top' | 'bottom'; // Label position layout
  spaceWidth?: number; // Gap between text and guide line
  alignLabel?: boolean; // Text alignment control
  style?: ITextMarkSpec; // Text style configuration

  // Guide line configuration
  line?: {
    minLength?: number; // Minimum line length @since 1.12.7
  } & IMarkSpec<IRuleMarkSpec>; // Line mark specification

  // Inherited from IMarkSpec<IComposedTextMarkSpec>
  id?: string | number; // User-defined ID
  interactive?: boolean; // Interaction response
  zIndex?: number; // Layer index
  visible?: boolean; // Visibility control
  support3d?: boolean; // 3D support
  customShape?: (datum: any[], attrs: any, path: ICustomPath2D) => ICustomPath2D; // Custom shape
  style?: ConvertToMarkStyleSpec<IComposedTextMarkSpec>; // Default style
  state?: IMarkStateFullSpec<IComposedTextMarkSpec>; // State-based styles
  stateSort?: (stateA: string, stateB: string) => number; // State sorting @since 1.9.0
}
```

## Position Type

```typescript
type FunnelLabelPosition = 'left' | 'right' | 'top' | 'bottom';
```

**FunnelLabelPosition 标签位置：**

- `'left'`: 左侧布局
- `'right'`: 右侧布局
- `'top'`: 顶部布局
- `'bottom'`: 底部布局

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
```

**IFormatMethod 格式化方法：**
接收文本和数据参数，返回格式化后的文本内容或富文本配置。

## Mark Specification Type

```typescript
type IMarkSpec<T extends ICommonSpec = ICommonSpec> = {
  id?: string | number; // Mark identifier
  interactive?: boolean; // Interaction capability
  zIndex?: number; // Layer order
  visible?: boolean; // Visibility state
  style?: ConvertToMarkStyleSpec<T>; // Visual styles
  state?: IMarkStateFullSpec<T>; // State configurations
  stateSort?: (stateA: string, stateB: string) => number; // State priority
  support3d?: boolean; // 3D rendering support
  customShape?: (datum: any[], attrs: any, path: ICustomPath2D) => ICustomPath2D; // Custom geometry
} & IMarkProgressiveConfig;
```

**IMarkSpec 图形标记规范：**
定义图形元素的基础配置，包括样式、状态、交互等属性。

## Text Mark Specification

```typescript
type IComposedTextMarkSpec = ITextMarkSpec | IRichTextMarkSpec;

interface ITextMarkSpec extends IFillMarkSpec {
  text?: string | number | string[] | number[]; // Text content
  dx?: number; // X offset
  dy?: number; // Y offset
  fontSize?: number | ITokenKey; // Font size
  textAlign?: TextAlign; // Horizontal alignment
  textBaseline?: TextBaseLine; // Vertical alignment
  fontFamily?: string; // Font family
  fontWeight?: FontWeight; // Font weight
  fontStyle?: FontStyle; // Font style
  maxLineWidth?: number; // Maximum line width
  ellipsis?: string; // Ellipsis character
  suffixPosition?: 'start' | 'end' | 'middle'; // Suffix position
  underline?: boolean; // Underline style
  underlineDash?: number[]; // Underline dash pattern
  underlineOffset?: number; // Underline offset
  lineThrough?: boolean; // Strike-through style
  lineHeight?: number | string | ITokenKey; // Line height
  direction?: 'horizontal' | 'vertical'; // Text direction
  wordBreak?: 'break-word' | 'break-all' | 'keep-all'; // Word breaking
  heightLimit?: number; // Height constraint
  lineClamp?: number; // Line clamping
  whiteSpace?: 'normal' | 'no-wrap'; // White space handling
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
