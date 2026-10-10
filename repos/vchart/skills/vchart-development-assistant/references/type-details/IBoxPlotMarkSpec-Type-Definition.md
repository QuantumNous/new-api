## Overview

`IBoxPlotMarkSpec` is a box plot mark specification interface in VChart, extending `ICommonSpec` with box plot specific properties:

```typescript
export interface IBoxPlotMarkSpec extends ICommonSpec {
  /** Box stroke width */
  lineWidth?: number;

  /** Box width */
  boxWidth?: number;

  /** Shaft width for min/max values */
  shaftWidth?: number;

  /** Shaft shape type */
  shaftShape?: BoxPlotShaftShape;

  /** Box fill color, no fill if empty */
  boxFill?: string;

  /** Shaft fill opacity, only effective when shaftType=bar */
  shaftFillOpacity?: number;

  /** Minimum value accessor */
  min?: (datum: Datum) => number;

  /** 25% quartile accessor */
  q1?: (datum: Datum) => number;

  /** Median value accessor */
  median?: (datum: Datum) => number;

  /** 75% quartile accessor */
  q3?: (datum: Datum) => number;

  /** Maximum value accessor */
  max?: (datum: Datum) => number;
}
```

This interface provides comprehensive configuration for box plot marks including box dimensions, shaft styling, and statistical value accessors.

## Base Structure

`IBoxPlotMarkSpec` extends `ICommonSpec` and includes box plot specific configurations:

```typescript
interface IBoxPlotMarkSpec extends ICommonSpec {
  // Box plot specific properties
  lineWidth?: number; // Box stroke width
  boxWidth?: number; // Box width
  shaftWidth?: number; // Shaft width for min/max values
  shaftShape?: BoxPlotShaftShape; // Shaft shape type
  boxFill?: string; // Box fill color
  shaftFillOpacity?: number; // Shaft fill opacity

  // Statistical value accessors
  min?: (datum: Datum) => number; // Minimum value
  q1?: (datum: Datum) => number; // 25% quartile
  median?: (datum: Datum) => number; // Median value
  q3?: (datum: Datum) => number; // 75% quartile
  max?: (datum: Datum) => number; // Maximum value

  // Inherited from ICommonSpec
  visible?: boolean; // Visibility
  x?: number; // X coordinate
  y?: number; // Y coordinate
  z?: number; // Z coordinate (3D)
  stroke?: string | IGradient | false | (number | boolean)[] | IColorKey | null;
  strokeOpacity?: number; // Stroke opacity
  opacity?: number; // Overall opacity
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

### Texture Configuration (Inherited from ICommonSpec)

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

## Dependency Type Definitions

### Box Plot Shaft Shape

```typescript
type BoxPlotShaftShape = 'line' | 'bar';
```

### Theme and Color Types

```typescript
interface IColorKey {
  // Theme color key interface
}

interface IGradient {
  // Gradient configuration interface
}
```

### Data and Context Types

```typescript
interface Datum {
  // Data record interface
  [key: string]: any;
}

interface IModelMarkAttributeContext {
  // Mark attribute context for function evaluation
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
