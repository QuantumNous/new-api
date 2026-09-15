## Overview

`ICartesianAxisSpec` is a union type for Cartesian coordinate system axes in VChart, containing five axis types:

```typescript
export type ICartesianAxisSpec =
  | ICartesianLinearAxisSpec    // Linear axis
  | ICartesianBandAxisSpec      // Band/Category axis  
  | ICartesianTimeAxisSpec      // Time axis
  | ICartesianLogAxisSpec       // Logarithmic axis
  | ICartesianSymlogAxisSpec;   // Symmetric logarithmic axis
```

## Base Structure

All axis types are based on `ICartesianAxisCommonSpec`:

```typescript
type ICartesianAxisCommonSpec = ICommonAxisSpec & {
  // Core configuration
  hideWhenEmpty?: boolean;           // Hide axis when bound series collect no axis data
  grid?: IGrid;                    // Grid line configuration
  subGrid?: IGrid;                 // Sub grid line configuration
  domainLine?: ICartesianDomainLine; // Axis line configuration
  label?: ICartesianLabel;         // Axis label configuration
  title?: ICartesianTitle;         // Axis title configuration
  autoIndent?: boolean;            // Auto indent
  background?: BackgroundConfig;   // Background configuration
  mode?: '2d' | '3d';             // 2D/3D mode
  depth?: number;                  // Z-axis depth
  unit?: ICartesianAxisUnit;       // Axis unit
  hasDimensionTooltip?: boolean;   // Dimension tooltip
} & (ICartesianVertical | ICartesianHorizontal | ICartesianZ);
```

## Runtime Visibility

`hideWhenEmpty` is a cartesian-axis-only opt-in flag that works together with the existing `visible` property.

```typescript
type ICartesianAxisCommonSpec = ICommonAxisSpec & {
  hideWhenEmpty?: boolean; // @default false
};
```

Behavior notes:
- If `visible` is `false`, the axis stays hidden regardless of `hideWhenEmpty`.
- If `hideWhenEmpty` is `true`, the axis hides when its bound series do not collect any axis data.
- When later data updates make the bound series non-empty, the axis shows again automatically.

## Orientation Configuration

### Vertical Axis
```typescript
type ICartesianVertical = {
  orient: 'left' | 'right';
  innerOffset?: { top?: number; bottom?: number; };
};
```

### Horizontal Axis
```typescript
type ICartesianHorizontal = {
  orient: 'top' | 'bottom';
  innerOffset?: { left?: number; right?: number; };
};
```

### Z轴
```typescript
type ICartesianZ = {
  orient: 'z';
};
```

## Axis Type Specific Configuration

### 1. Linear Axis (ICartesianLinearAxisSpec)

```typescript
type ICartesianLinearAxisSpec = ICartesianAxisCommonSpec & ILinearAxisSpec & {
  sync?: ILinearAxisSync; // Axis synchronization configuration
};

interface ILinearAxisSpec {
  min?: number;           // Minimum value
  max?: number;           // Maximum value
  softMin?: number | ((domain: number[]) => number);
  softMax?: number | ((domain: number[]) => number);
  nice?: boolean;         // Round values @default true
  niceType?: 'tickCountFirst' | 'accurateFirst';
  zero?: boolean;         // Include zero @default true
  expand?: { min?: number; max?: number; }; // Range expansion
  tooltipFilterRange?: number | [number, number] | Function;
  breaks?: ILinearAxisBreakSpec[]; // Axis breaks
}

interface ILinearAxisSync {
  axisId: StringOrNumber;  // Reference axis ID
  zeroAlign?: boolean;     // Zero alignment
  tickAlign?: boolean;     // Tick alignment
}
```

### 2. Band Axis (ICartesianBandAxisSpec)

```typescript
type ICartesianBandAxisSpec = ICartesianAxisCommonSpec & IBandAxisSpec & {
  bandSize?: number;         // Band width setting
  maxBandSize?: number;      // Maximum band width
  minBandSize?: number;      // Minimum band width
  bandSizeLevel?: number;    // Scale level
  bandSizeExtend?: {         // Extension configuration
    gap?: number | string;
    extend?: number;
  };
  autoRegionSize?: boolean;  // Auto calculate region size
};

interface IBandAxisSpec {
  trimPadding?: boolean;        // Remove padding at both ends
  bandPadding?: number | number[];     // Inner and outer padding
  paddingInner?: number | number[];    // Inner padding @default 0.1
  paddingOuter?: number | number[];    // Outer padding @default 0.3
  domain?: StringOrNumber[];           // Value range
  bandPosition?: number;               // Position offset @default 0.5
  showAllGroupLayers?: boolean;        // Show all group layers
  layers?: IBandAxisLayer[];           // Layer configuration
}
```

### 3. Time Axis (ICartesianTimeAxisSpec)

```typescript
type ICartesianTimeAxisSpec = Omit<ICartesianAxisCommonSpec, 'inverse'> & {
  layers?: ITimeLayerType[]; // Time layer configuration
};

interface ITimeLayerType {
  timeFormat?: string;        // Time format @default '%Y%m%d'
  timeFormatMode?: 'utc' | 'local'; // Time mode @default 'local'
}
```

### 4. Logarithmic Axis (ICartesianLogAxisSpec)

```typescript
type ICartesianLogAxisSpec = ICartesianLinearAxisSpec & {
  base?: number; // Base number @default 10
};
```

### 5. Symmetric Logarithmic Axis (ICartesianSymlogAxisSpec)

```typescript
type ICartesianSymlogAxisSpec = ICartesianLinearAxisSpec & {
  constant?: number; // Constant @default 10
};
```

## Core Sub-configurations

### Grid Lines (IGrid)
```typescript
interface IGrid {
  visible?: boolean;
  alternateColor?: string | string[];  // Fill colors
  alignWithLabel?: boolean;            // Align with labels @default true
  style?: IRuleMarkSpec | StyleCallback<IRuleMarkSpec>;
  zIndex?: number;                     // Draw order @default 50
}
```

### Tick Lines (ITick)
```typescript
interface ITick extends ITickCalculationCfg {
  visible?: boolean;
  tickSize?: number;                   // Length @default 4
  inside?: boolean;                    // Direction @default false
  alignWithLabel?: boolean;            // Align with labels @default true
  style?: IRuleMarkSpec | StyleCallback<IRuleMarkSpec>;
  state?: AxisItemStateStyle<IRuleMarkSpec>;          // Interactive state styles
  dataFilter?: (data: any[], context: { vchart: any }) => any[]; // Data filter
}
```

### Labels (ICartesianLabel)
```typescript
type ICartesianLabel = ILabel & {
  flush?: boolean;                     // First/last shrink @default false
  lastVisible?: boolean | null;        // Last label visibility
  firstVisible?: boolean | null;       // First label visibility
  containerAlign?: 'left' | 'right' | 'center' | 'top' | 'bottom' | 'middle';
};

interface ILabel {
  visible?: boolean;
  formatMethod?: IFormatMethod;        // Format function
  formatter?: string | string[];       // Format template
  space?: number;                      // Space from tick
  inside?: boolean;                    // Direction @default false
  minGap?: number;                     // Minimum gap (sampling)
  style?: ITextMarkSpec | StyleCallback<ITextMarkSpec>;
  state?: AxisItemStateStyle<ITextMarkSpec>;
}
```

### Axis Line (ICartesianDomainLine)
```typescript
type ICartesianDomainLine = IDomainLine & {
  onZero?: boolean;                    // On zero tick
  onZeroAxisIndex?: number;            // Specified axis index
  onZeroAxisId?: StringOrNumber;       // Specified axis ID
  startSymbol?: any;                   // Start symbol
  endSymbol?: any;                     // End symbol
};

interface IDomainLine {
  visible?: boolean;
  style?: IRuleMarkSpec;
  state?: AxisItemStateStyle<IRuleMarkSpec>;
}
```

### Title (ICartesianTitle)
```typescript
type ICartesianTitle = ITitle & {
  autoRotate?: boolean;                // Auto rotation @default true
  inside?: boolean;                    // Direction @default false
};

interface ITitle {
  visible?: boolean;
  text?: string | number | Array;      // Title content
  position?: 'start' | 'middle' | 'end'; // Position
  space?: number;                      // Distance from axis
  padding?: number | number[];         // Padding
  angle?: number;                      // Rotation angle
  style?: ITextMarkSpec;
  state?: AxisItemStateStyle<ITextMarkSpec>;
  background?: {                       // Background configuration
    visible?: boolean;
    style?: IRectMarkSpec;
    state?: AxisItemStateStyle<IRectMarkSpec>;
  };
  shape?: {                            // Shape configuration
    visible?: boolean;
    space?: number;
    style?: any;
    state?: AxisItemStateStyle<any>;
  };
}
```

## Dependency Type Definitions

### Interactive State Styles
```typescript
// From @visactor/vrender-components
type AxisItemStateStyle<T> = {
  hover?: T;
  hover_reverse?: T;
  selected?: T;
  selected_reverse?: T;
};
```

### Axis Break Configuration
```typescript
interface ILinearAxisBreakSpec {
  /** Break range */
  range: [number, number][];
  /** Gap between break marks, number for pixels, string for percentage @default 6 */
  gap?: number | string;
  /** Break range calculation type @since 1.12.12 */
  scopeType?: 'count' | 'length';
}
```

### Band Axis Layer Configuration
```typescript
interface IBandAxisLayer {
  /** Visibility @default true */
  visible?: boolean;
  /** Tick step */
  tickStep?: number;
  /** Expected tick count @default 5 */
  tickCount?: number | ((option: ITickCallbackOption) => number);
  /** Force tick count */
  forceTickCount?: number;
}
```

### Tick Calculation Configuration
```typescript
interface ITickCalculationCfg {
  /** Tick step */
  tickStep?: number;
  /** Expected continuous axis tick count @default 5 */
  tickCount?: number | ((option: ITickCallbackOption) => number);
  /** Force tick count */
  forceTickCount?: number;
  /** Tick generation algorithm @default 'average' */
  tickMode?: 'average' | 'd3' | CustomTicksFunc;
  /** Avoid decimal ticks @default false */
  noDecimals?: boolean;
}
```

### Style Callback Types
```typescript
type StyleCallback<T> = (datum: any, index: number) => T;
type IFormatMethod<T extends any[]> = (...args: T) => string | { type: 'rich'; text: any };
```

### Basic Mark Style Types
```typescript
// Simplified style type definitions, actual types are more complex
interface IRuleMarkSpec {
  stroke?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
  lineDash?: number[];
  // ... more style attributes
}

interface ITextMarkSpec {
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  fill?: string;
  textAlign?: string;
  textBaseline?: string;
  // ... more style attributes
}

interface IRectMarkSpec {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  // ... more style attributes
}
```

## Usage Examples

### Linear Axis
```typescript
const linearAxis: ICartesianLinearAxisSpec = {
  orient: 'bottom',
  type: 'linear',
  min: 0,
  max: 100,
  hideWhenEmpty: true,
  nice: true,
  grid: { visible: true },
  label: { formatMethod: text => `${text}%` },
  tick: {
    visible: true,
    tickCount: 10,
    state: {
      hover: { stroke: '#ff0000' }
    }
  }
};
```

### Band Axis
```typescript
const bandAxis: ICartesianBandAxisSpec = {
  orient: 'bottom',
  type: 'band',
  paddingInner: 0.1,
  paddingOuter: 0.3,
  bandSize: 20,
  showAllGroupLayers: true,
  layers: [
    { visible: true, tickCount: 5 }
  ],
  label: { 
    visible: true,
    state: {
      hover: { fill: '#ff0000' }
    }
  }
};
```

### Time Axis
```typescript
const timeAxis: ICartesianTimeAxisSpec = {
  orient: 'bottom',
  type: 'time',
  layers: [
    { 
      timeFormat: '%Y-%m-%d',
      timeFormatMode: 'local',
      tickCount: 7
    }
  ],
  label: {
    visible: true,
    formatMethod: (text) => new Date(text).toLocaleDateString()
  }
};
```

### Linear Axis with Breaks
```typescript
const breakAxis: ICartesianLinearAxisSpec = {
  orient: 'left',
  type: 'linear',
  breaks: [
    {
      range: [[100, 900]],
      gap: 10,
      scopeType: 'length'
    }
  ],
  grid: { visible: true }
};
```
