# IImageMarkSpec Type Definition

## Overview

```typescript
interface IImageMarkSpec {
  // Image-specific properties
  cornerRadius?: number | number[];
  width?: number;
  height?: number;
  repeatX?: IRepeatType;
  repeatY?: IRepeatType;
  image?: string | HTMLImageElement | HTMLCanvasElement;

  // From IFillMarkSpec
  fill?: VisualType<string> | IGradient | false | IColorKey;
  fillOpacity?: number;
  background?: IColor | HTMLImageElement | HTMLCanvasElement | null;

  // From ICommonSpec
  visible?: boolean;
  x?: number;
  y?: number;
  z?: number;
  stroke?: string | IGradient | false | (number | boolean)[] | IColorKey | null;
  strokeOpacity?: number;
  opacity?: number;
  lineWidth?: number;
  lineDash?: number[];
  lineDashOffset?: number;
  cursor?: Cursor;
  zIndex?: number;
  angle?: number;
  anchor?: [number, number];
  scaleX?: number;
  scaleY?: number;
  scaleCenter?: [number | string, number | string];
  alpha?: number;
  beta?: number;
  anchor3d?: [number, number];
  pickMode?: 'accurate' | 'imprecise' | 'custom';
  boundsMode?: 'accurate' | 'imprecise';
  pickStrokeBuffer?: number;
  texture?: TextureType | string;
  textureColor?: string;
  textureSize?: number;
  texturePadding?: number;
  outerBorder?: IBorder;
  innerBorder?: IBorder;
  html?: IMarkHtmlSpec;
}
```

## Dependency Types

### Repeat Types

```typescript
type IRepeatType = 'no-repeat' | 'repeat-x' | 'repeat-y' | 'repeat';
```

### Visual Mapping System

```typescript
type VisualType<T> = ValueType<T> | FunctionType<T> | IVisual<unknown, T>;
type ValueType<T> = T;
type FunctionType<T> = (datum: Datum, context: IModelMarkAttributeContext, source?: DataView) => T;

interface IVisual<D, R> {
  type: ScaleType;
  domain: D[];
  range: R[];
  field?: string;
  specified?: { [key: string]: unknown };
  clamp?: boolean;
}
```

### Gradient System

```typescript
type IGradient = IGradientLinear | IGradientRadial | IGradientConical;

interface IGradientLinear {
  gradient: 'linear';
  x0?: GradientPropValue<number>;
  y0?: GradientPropValue<number>;
  x1?: GradientPropValue<number>;
  y1?: GradientPropValue<number>;
  stops: GradientStop[];
}

interface IGradientRadial {
  gradient: 'radial';
  r0?: GradientPropValue<number>;
  x0?: GradientPropValue<number>;
  y0?: GradientPropValue<number>;
  x1?: GradientPropValue<number>;
  y1?: GradientPropValue<number>;
  r1?: GradientPropValue<number>;
  stops: GradientStop[];
}

interface IGradientConical {
  gradient: 'conical';
  x?: GradientPropValue<number>;
  y?: GradientPropValue<number>;
  startAngle?: GradientPropValue<number>;
  endAngle?: GradientPropValue<number>;
  stops: GradientStop[];
}

type GradientPropValue<T> = ValueType<T> | FunctionType<T>;

type GradientStop = {
  offset: GradientPropValue<number>;
  color?: GradientPropValue<string>;
  opacity?: number;
};
```

### Border Configuration

```typescript
interface IBorder {
  distance: number | string;
  stroke?: string | IGradient;
  strokeOpacity?: number;
  lineWidth?: number;
  lineDash?: number[];
  lineDashOffset?: number;
}
```

### Color and Theme Types

```typescript
type IColor = string | IGradient | IColorKey;

interface IColorKey {
  // Color theme key reference
}

interface ITokenKey {
  // Token theme key reference
}
```

### Texture Types

```typescript
type TextureType = 'circle' | 'dimond' | 'rect' | 'vertical-line' | 'horizontal-line' | 'bias-lr' | 'bias-rl' | 'grid';
```

### HTML Integration

```typescript
type IMarkHtmlSpec = Partial<IGraphicStyle['html']>;

interface IGraphicStyle {
  html?: {
    anchorType?: 'top' | 'middle' | 'bottom';
  };
}
```

### Scale and Context Types

```typescript
type ScaleType =
  | 'linear'
  | 'ordinal'
  | 'band'
  | 'point'
  | 'time'
  | 'log'
  | 'pow'
  | 'sqrt'
  | 'symlog'
  | 'threshold'
  | 'quantile'
  | 'quantize';

type Cursor = 'auto' | 'default' | 'pointer' | 'crosshair' | 'move' | 'text' | 'wait' | 'help' | 'not-allowed' | string;

interface Datum {
  [key: string]: any;
}

interface IModelMarkAttributeContext {
  // Mark attribute evaluation context
}
```
