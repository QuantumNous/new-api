## Overview

`IExtensionMarkSpec` is an interface for defining series extension marks in VChart, extending `ICustomMarkSpec` and supporting all mark types except 'group':

```typescript
export interface IExtensionMarkSpec<T extends Exclude<EnableMarkType, 'group'>> extends ICustomMarkSpec<T>
```

## Base Structure

`IExtensionMarkSpec` extends `ICustomMarkSpec` which combines multiple specifications:

```typescript
interface ICustomMarkSpec<T extends EnableMarkType>
  extends IModelSpec,
    IMarkSpec<IBuildinMarkSpec[T]>,
    IAnimationSpec<string, string> {
  // Core configuration
  type: T; // Mark type (required)
  name?: string; // Mark name for event filtering @since 1.12.5
  dataIndex?: number; // Associated data index @default Same as series data
  dataKey?: string | ((datum: any) => string); // Data-Mark binding key @support since 1.9.5
  dataId?: StringOrNumber; // Associated data ID
  componentType?: string; // Component type specification @support since 1.9.0
  animation?: boolean; // Animation enable @since 1.11.0
  parent?: string; // Parent element ID @since 1.13.0
}
```

## Core Configuration

### Extension Mark Specific Properties

```typescript
interface IExtensionMarkSpec<T> {
  /** Associated data index @default Same as series data */
  dataIndex?: number;

  /** Data-Mark binding key. If consistent with series data, can be omitted @support since 1.9.5 */
  dataKey?: string | ((datum: any) => string);

  /** Associated data ID */
  dataId?: StringOrNumber;

  /** Component type specification @support since 1.9.0 */
  componentType?: string;
}
```

### Basic Configuration (from IMarkSpec)

```typescript
interface IMarkSpec<T> {
  /** User-defined ID */
  id?: StringOrNumber;

  /** Interactive response */
  interactive?: boolean;

  /** Layer order */
  zIndex?: number;

  /** Visibility */
  visible?: boolean;

  /** Default style */
  style?: ConvertToMarkStyleSpec<T>;

  /** State-based style configuration */
  state?: IMarkStateFullSpec<T>;

  /** State sorting method @since 1.9.0 */
  stateSort?: (stateA: string, stateB: string) => number;

  /** 3D perspective support */
  support3d?: boolean;

  /** Custom shape function */
  customShape?: (datum: any[], attrs: any, path: ICustomPath2D) => ICustomPath2D;
}
```

## State Configuration

### State Styles

```typescript
interface IMarkStateFullSpec<T> {
  /** Normal state style */
  normal?: IMarkStateSpec<T> | IMarkStateStyleSpec<T>;

  /** Hover state style */
  hover?: IMarkStateSpec<T> | IMarkStateStyleSpec<T>;

  /** Non-hover state style */
  hover_reverse?: IMarkStateSpec<T> | IMarkStateStyleSpec<T>;

  /** Selected state style */
  selected?: IMarkStateSpec<T> | IMarkStateStyleSpec<T>;

  /** Non-selected state style */
  selected_reverse?: IMarkStateSpec<T> | IMarkStateStyleSpec<T>;
}
```

### State Specification

```typescript
interface IMarkStateSpec<T> {
  /** Filter criteria */
  filter?: IMarkStateFilter;

  /** State priority level */
  level?: number | undefined;

  /** State style */
  style: ConvertToMarkStyleSpec<T>;
}

type IMarkStateStyleSpec<T> = ConvertToMarkStyleSpec<T>;
```

### State Filters

```typescript
type IMarkStateFilter =
  | {
      /** Dimension filtering */
      fields: { [key in string]: { type: 'ordinal' | 'linear'; domain: StringOrNumber[] } };
    }
  | {
      /** Data filtering */
      datums: Datum[];
      datumKeys: string[];
    }
  | {
      /** Item filtering */
      items: IGraphic[];
    }
  | ((
      datum: Datum,
      options: {
        mark?: IMark;
        type?: string;
        renderNode?: IGraphic;
      }
    ) => boolean);
```

## Supported Mark Types

EnableMarkType (excluding 'group'):

```typescript
type IBuildinMarkSpec = {
  symbol: ISymbolMarkSpec; // Symbol marks
  rule: IRuleMarkSpec; // Rule/line marks
  line: ILineMarkSpec; // Line marks
  text: ITextMarkSpec; // Text marks
  rect: IRectMarkSpec; // Rectangle marks
  image: IImageMarkSpec; // Image marks
  path: IPathMarkSpec; // Path marks
  area: IAreaMarkSpec; // Area marks
  arc: IArcMarkSpec; // Arc marks
  polygon: IPolygonMarkSpec; // Polygon marks
  boxPlot: IBoxPlotMarkSpec; // Box plot marks
  linkPath: ILinkPathMarkSpec; // Link path marks
  ripple: IRippleMarkSpec; // Ripple marks
};

type EnableMarkType = keyof IBuildinMarkSpec;
```

## Dependency Type Definitions

### Basic Types

```typescript
type StringOrNumber = string | number;
type Datum = Record<string, any>;

interface IGraphic {
  // VRender graphic element interface
}

interface IMark {
  // VChart mark interface
}
```

### Style Conversion

```typescript
type ConvertToMarkStyleSpec<T> = {
  // Converts mark specification to style specification
  // Specific implementation depends on mark type T
};
```

### Animation and Model Specs

```typescript
interface IAnimationSpec<T, K> {
  // Animation configuration interface
}

interface IModelSpec {
  // Model specification interface
}

interface IMarkProgressiveConfig {
  // Progressive rendering configuration
}
```
