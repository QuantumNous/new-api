# ILineLikeLabelSpec Type Definition

## Overview

```typescript
type ILineLikeLabelSpec = Omit<ILabelSpec, 'position'> & {
  // Enhanced position configuration
  position?: Functional<
    'top' | 'bottom' | 'left' | 'right' | 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'center'
  >; // Enhanced positioning @since 1.6.0

  // Inherited from ILabelSpec (excluding position)
  zIndex?: number; // Label layer level
  visible?: boolean; // Visibility @default false
  interactive?: boolean; // Interaction support @default false
  textType?: 'text' | 'rich'; // Text type @deprecated @since 1.7.0
  formatMethod?: IFormatMethod<[text: string | string[], datum?: Datum, ctx?: ILabelFormatMethodContext]>; // Format function @since 1.10.0
  formatter?: string | string[]; // String template @since 1.7.0
  offset?: number; // Distance from data element
  labelLayout?: 'series' | 'region'; // Layout scope
  style?: ConvertToMarkStyleSpec<IComposedTextMarkSpec>; // Label style
  state?: LabelStateStyle<Partial<IComposedTextMarkSpec>>; // Interactive state styles
  overlap?: BaseLabelAttrs['overlap'] & OverlapExtension; // Overlap prevention
  smartInvert?: BaseLabelAttrs['smartInvert']; // Smart color inversion
  support3d?: boolean; // 3D support
  syncState?: boolean; // Sync with data element state @since 1.9.0
  showRelatedMarkTooltip?: boolean; // Show related mark tooltip @since 1.13.5
  stackDataFilterType?: 'min' | 'max'; // Stack data filter @since 1.12.0
  dataFilter?: BaseLabelAttrs['dataFilter']; // Custom data filter @since 1.3.0
  customLayoutFunc?: BaseLabelAttrs['customLayoutFunc']; // Custom layout @since 1.3.0
  customOverlapFunc?: BaseLabelAttrs['customOverlapFunc']; // Custom overlap @since 1.3.0
  onAfterOverlapping?: BaseLabelAttrs['onAfterOverlapping']; // After overlap callback @since 1.13.5

  // Animation properties
  animation?: BaseLabelAttrs['animation'];
  animationEnter?: BaseLabelAttrs['animationEnter'];
  animationUpdate?: BaseLabelAttrs['animationUpdate'];
  animationExit?: BaseLabelAttrs['animationExit'];
};
```

## Position Types

```typescript
type PositionType =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-right'
  | 'top-left'
  | 'bottom-right'
  | 'bottom-left'
  | 'center';
```

**PositionType 标签位置类型：**

- `'top'`: 数据点上方
- `'bottom'`: 数据点下方
- `'left'`: 数据点左侧
- `'right'`: 数据点右侧
- `'top-right'`: 右上角对角位置
- `'top-left'`: 左上角对角位置
- `'bottom-right'`: 右下角对角位置
- `'bottom-left'`: 左下角对角位置
- `'center'`: 数据点中心

## Functional Configuration

```typescript
type Functional<T> = T | ((datum: any, ctx: any) => T);
```

**Functional 函数式配置：**
支持静态值或函数形式的动态配置，函数接收数据项和上下文作为参数。

## Format Method Types

```typescript
type IFormatMethod<T extends any[]> = (
  ...args: T
) => string | { type: 'rich'; text: IRichTextCharacter[] } | { type: 'text'; text: string };

interface ILabelFormatMethodContext {
  series?: ISeries;
}
```

## State Style Configuration

```typescript
type LabelStateStyle<T> = {
  hover?: T; // Hover state style
  hover_reverse?: T; // Non-hover state style
  selected?: T; // Selected state style
  selected_reverse?: T; // Non-selected state style
};
```

## Overlap Extension

```typescript
interface OverlapExtension {
  padding?: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  }; // Overlap prevention area padding @since 1.13.7
}
```

## Text Mark Style

```typescript
interface IComposedTextMarkSpec extends ITextMarkSpec {
  // Extended text mark specification with composition support
}

interface ITextMarkSpec {
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  fill?: string;
  stroke?: string;
  textAlign?: string;
  textBaseline?: string;
  // Additional text style properties
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

interface BaseLabelAttrs {
  overlap?: OverlapConfig;
  smartInvert?: SmartInvertConfig;
  dataFilter?: DataFilterFunction;
  customLayoutFunc?: CustomLayoutFunction;
  customOverlapFunc?: CustomOverlapFunction;
  onAfterOverlapping?: AfterOverlappingCallback;
  animation?: AnimationConfig;
  animationEnter?: AnimationConfig;
  animationUpdate?: AnimationConfig;
  animationExit?: AnimationConfig;
}
```
