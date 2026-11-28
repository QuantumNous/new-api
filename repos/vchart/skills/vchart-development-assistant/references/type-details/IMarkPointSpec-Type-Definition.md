## Overview
`IMarkPointSpec` defines the configuration interface for mark point components in VChart. Mark points are annotation elements that highlight specific data points or positions on charts with customizable symbols, labels, and interactive behaviors.

## Core Interface Structure

```typescript
type IMarkPointSpec = IMarkerSpec & 
  (IMarkPointXYSpec | IMarkPointAngleRadiusSpec | IMarkPointGeoNameSpec | 
   IMarkPointCoordinateSpec | IMarkPointPositionsSpec) & 
  IMarkPointTheme<IMarkerSymbol> & 
  BaseMarkerAnimation<MarkPointAnimationType>
```

## Base Properties (from IMarkerSpec)

### Component Association
```typescript
interface IMarkerSpec {
  // Component association
  regionIndex?: number | number[];           // Associated region index
  regionId?: StringOrNumber | StringOrNumber[]; // Associated region ID
  seriesIndex?: number | number[];           // Associated series index  
  seriesId?: StringOrNumber | StringOrNumber[]; // Associated series ID
  relativeSeriesIndex?: number;              // Marker data series index
  relativeSeriesId?: number | string;        // Marker data series ID
  
  // Component behavior
  visible?: boolean;                         // Component visibility (default: true)
  interactive?: boolean;                     // Component interactivity (default: true)
  autoRange?: boolean;                       // Auto extend axis range (default: false)
  clip?: boolean;                           // Clip overflow content (default: false)
  name?: string;                            // Component name identifier
  coordinateType?: string;                  // Coordinate system type
}
```

## Position Configuration Types

### 1. Cartesian Coordinate System
```typescript
interface IMarkPointXYSpec {
  x: IDataPos | IDataPosCallback;  // X-axis position (value/aggregation/callback/percentage)
  y: IDataPos | IDataPosCallback;  // Y-axis position (value/aggregation/callback/percentage)
}
```

### 2. Polar Coordinate System  
```typescript
interface IMarkPointAngleRadiusSpec {
  angle: IDataPos | IDataPosCallback;   // Angle axis position
  radius: IDataPos | IDataPosCallback;  // Radius axis position
}
```

### 3. Geographic Coordinate System
```typescript
interface IMarkPointGeoNameSpec {
  areaName: string | IDataPosCallback;  // Geographic area name
}
```

### 4. Data Point Based
```typescript
interface IMarkPointCoordinateSpec {
  coordinate: IDataPointSpec | ((seriesData: Datum[], relativeSeries: IMarkerSupportSeries) => IDataPointSpec);
  coordinatesOffset?: OffsetPoint;  // Canvas coordinate offset
}
```

### 5. Canvas Position Based
```typescript
interface IMarkPointPositionsSpec {
  position: MarkerPositionPoint | ((seriesData: Datum[], relativeSeries: IMarkerSupportSeries) => MarkerPositionPoint);
  regionRelative?: boolean;  // Whether relative to region (default: false)
}
```

## Symbol Configuration

```typescript
interface IMarkerSymbol {
  visible: boolean;           // Symbol visibility
  symbolType?: SymbolType;    // Symbol shape (arrow/circle/triangle/etc.)
  size?: number;             // Symbol size
  refX?: number;             // Horizontal offset relative to position
  refY?: number;             // Vertical offset relative to position  
  refAngle?: number;         // Angle offset for rotation
  
  // Style and state configurations
  style?: ISymbolMarkSpec | MarkerStyleCallback<ISymbolMarkSpec>;
  state?: Record<MarkerStateValue, ISymbolMarkSpec | MarkerStateCallback<ISymbolMarkSpec>>;
}
```

## Label Configuration

```typescript
interface IMarkPointLabel {
  visible?: boolean;          // Label visibility
  text?: string | string[] | number | number[] | RichTextContent;
  formatMethod?: IFormatMethod<[markData: Datum[], seriesData: Datum[]]>;
  
  // Layout properties
  minWidth?: number;          // Minimum width (default: 30px)
  maxWidth?: number;          // Maximum width for text wrapping
  autoRotate?: boolean;       // Auto rotation based on position
  confine?: boolean;          // Keep label within visible area
  dx?: number;               // Horizontal offset
  dy?: number;               // Vertical offset
  
  // Background configuration
  labelBackground?: {
    visible?: boolean;
    padding?: IPadding | number[] | number;
    customShape?: (text, attrs, path) => ICustomPath2D;
    style?: IRectMarkSpec;
  };
  
  // Text decoration
  shape?: {
    visible?: boolean;
    style: ISymbolMarkSpec;  // Symbol before text
  };
  space?: number;            // Space between shape and text
  
  // Style and state configurations
  style?: IComposedTextMarkSpec | MarkerStyleCallback<IComposedTextMarkSpec>;
  state?: Record<MarkerStateValue, IComposedTextMarkSpec>;
}
```

## Animation Configuration

```typescript
interface BaseMarkerAnimation<T> {
  animationEnter?: T;      // Enter animation
  animationUpdate?: T;     // Update animation  
  animationExit?: T;       // Exit animation
}
```

## Helper Types

### Data Position Types
```typescript
type IDataPos = StringOrNumber | IAggrType;
type IAggrType = 'sum' | 'average' | 'min' | 'max' | 'variance' | 'standardDeviation' | 'median';
type IDataPosCallback = (relativeSeriesData, startRelativeSeriesData, endRelativeSeriesData, 
                        relativeSeries, startRelativeSeries, endRelativeSeries) => StringOrNumber;
```

### Position Types
```typescript
interface MarkerPositionPoint {
  x: StringOrNumber;  // X coordinate (pixel value or percentage)
  y: StringOrNumber;  // Y coordinate (pixel value or percentage)  
}

interface OffsetPoint {
  x?: number | string;  // X offset (pixels or percentage)
  y?: number | string;  // Y offset (pixels or percentage)
}
```

## Usage Examples

### Basic Cartesian Point
```typescript
const markPoint: IMarkPointSpec = {
  x: 'average',
  y: 100,
  symbol: {
    visible: true,
    symbolType: 'circle',
    size: 12,
    style: { fill: 'red' }
  }
};
```

### Data-driven Point with Label
```typescript
const markPoint: IMarkPointSpec = {
  coordinate: { x: 'Q1', y: 'max' },
  symbol: { visible: true, size: 10 },
  label: {
    visible: true,
    text: 'Peak Value',
    position: 'top',
    style: { fontSize: 12, fill: 'black' }
  }
};
```

### Polar Coordinate Point
```typescript
const markPoint: IMarkPointSpec = {
  angle: 45,
  radius: 'average',
  symbol: {
    visible: true,
    symbolType: 'triangle',
    style: { fill: 'blue', stroke: 'navy' }
  }
};
```
