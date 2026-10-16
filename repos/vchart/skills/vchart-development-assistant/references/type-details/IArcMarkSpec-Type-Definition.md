## Type Definition

```typescript
interface IArcMarkSpec {
  // Arc-specific properties
  startAngle?: number;
  endAngle?: number;
  padAngle?: number;
  outerRadius?: number;
  innerRadius?: number;
  cornerRadius?: number;
  innerPadding?: number;
  outerPadding?: number;
  centerOffset?: number;
  cap?: boolean | [boolean, boolean];
  autoCapConical?: boolean;

  // Inherited from IFillMarkSpec
  fill?: VisualType<string> | IGradient | false | IColorKey;
  fillOpacity?: number;
  background?: IColor | HTMLImageElement | HTMLCanvasElement | null;

  // Inherited from ICommonSpec
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
  [key: string]: any;
}
```

## Related Types

### IFillMarkSpec

```typescript
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

### VisualType

```typescript
type VisualType<T> = ValueType<T> | FunctionType<T> | IVisual<unknown, T>;
```

### IGradient

Union type supporting linear, radial, and conical gradients:

```typescript
type IGradient = IGradientLinear | IGradientRadial | IGradientConical;
```

### IGradientLinear

```typescript
interface IGradientLinear {
  x0?: GradientPropValue<number>;
  y0?: GradientPropValue<number>;
  x1?: GradientPropValue<number>;
  y1?: GradientPropValue<number>;
  stops: GradientStop[];
  gradient: 'linear';
}
```

### IGradientRadial

```typescript
interface IGradientRadial {
  r0?: GradientPropValue<number>;
  x0?: GradientPropValue<number>;
  y0?: GradientPropValue<number>;
  x1?: GradientPropValue<number>;
  y1?: GradientPropValue<number>;
  r1?: GradientPropValue<number>;
  stops: GradientStop[];
  gradient: 'radial';
}
```

### IGradientConical

```typescript
interface IGradientConical {
  x?: GradientPropValue<number>;
  y?: GradientPropValue<number>;
  startAngle?: GradientPropValue<number>;
  endAngle?: GradientPropValue<number>;
  stops: GradientStop[];
  gradient: 'conical';
}
```

### GradientStop

```typescript
type GradientStop = {
  offset: GradientPropValue<number>;
  color?: GradientPropValue<string>;
  opacity?: number;
};
```

### GradientPropValue

```typescript
type GradientPropValue<T> = ValueType<T> | FunctionType<T>;
```

### IColorKey

Theme-based color token reference for consistent color schemes.

### IColor

```typescript
type IColor = string;
```

### TextureType

```typescript
type TextureType = 'circle' | 'dimond' | 'rect' | 'vertical-line' | 'horizontal-line' | 'bias-lr' | 'bias-rl' | 'grid';
```

### IBorder

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

### IMarkHtmlSpec

```typescript
type IMarkHtmlSpec = Partial<IGraphicStyle['html']>;
```

### IGraphicStyle

```typescript
interface IGraphicStyle {
  html?: {
    anchorType?: 'position' | 'boundsLeftTop' | 'boundsRightTop' | 'boundsLeftBottom' | 'boundsRightBottom';
    element?: string | HTMLElement;
    style?: Partial<CSSStyleDeclaration>;
    pointerEvents?: boolean;
    container?: HTMLElement;
  };
  [key: string]: any;
}
```

### Cursor

Type defining available cursor styles for interactive elements.

### ValueType

```typescript
type ValueType<T> = T;
```

### FunctionType

```typescript
type FunctionType<T> = (datum: Datum, context: IModelMarkAttributeContext, source?: DataView) => T;
```

### IVisual

```typescript
type IVisual<D = any, R = any> = IVisualSpecStyle<D, R> | IVisualScale;
```
