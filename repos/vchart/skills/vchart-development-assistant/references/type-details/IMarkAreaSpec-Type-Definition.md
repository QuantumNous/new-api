## Core Interface Structure

```typescript
type IMarkAreaSpec = IMarkerSpec &
  (
    | IMarkAreaXSpec
    | IMarkAreaYSpec
    | IMarkAreaXYSpec
    | IMarkAreaAngleSpec
    | IMarkAreaRadiusSpec
    | IMarkAreaAngleRadiusSpec
    | IMarkAreaCoordinateSpec
    | IMarkerPositionsSpec
  ) &
  IMarkAreaTheme &
  BaseMarkerAnimation<CommonMarkAreaAnimationType>;
```

## Base Properties (from IMarkerSpec)

### Component Association

```typescript
interface IMarkerSpec {
  // Component association
  regionIndex?: number | number[]; // Associated region index
  regionId?: StringOrNumber | StringOrNumber[]; // Associated region ID
  seriesIndex?: number | number[]; // Associated series index
  seriesId?: StringOrNumber | StringOrNumber[]; // Associated series ID
  relativeSeriesIndex?: number; // Marker data series index
  relativeSeriesId?: number | string; // Marker data series ID

  // Component behavior
  visible?: boolean; // Component visibility (default: true)
  interactive?: boolean; // Component interactivity (default: true)
  autoRange?: boolean; // Auto extend axis range (default: false)
  clip?: boolean; // Clip overflow content (default: false)
  name?: string; // Component name identifier
  coordinateType?: string; // Coordinate system type
}
```

## Area Configuration Types

### 1. X-Axis Range Area

```typescript
interface IMarkAreaXSpec extends IMarkerCrossSeriesSpec {
  x: IDataPos | IDataPosCallback; // Start X position (value/aggregation/callback/percentage)
  x1: IDataPos | IDataPosCallback; // End X position (forms range with x)
}
```

### 2. Y-Axis Range Area

```typescript
interface IMarkAreaYSpec extends IMarkerCrossSeriesSpec {
  y: IDataPos | IDataPosCallback; // Start Y position (value/aggregation/callback/percentage)
  y1: IDataPos | IDataPosCallback; // End Y position (forms range with y)
}
```

### 3. Rectangular Area (X-Y Range)

```typescript
interface IMarkAreaXYSpec extends IMarkerCrossSeriesSpec {
  x: IDataPos | IDataPosCallback; // Start X position
  x1: IDataPos | IDataPosCallback; // End X position
  y: IDataPos | IDataPosCallback; // Start Y position
  y1: IDataPos | IDataPosCallback; // End Y position
}
```

### 4. Polar Coordinate Areas

#### Angle Range Area

```typescript
interface IMarkAreaAngleSpec extends IMarkerCrossSeriesSpec {
  angle: IDataPos | IDataPosCallback; // Start angle position
  angle1: IDataPos | IDataPosCallback; // End angle position
}
```

#### Radius Range Area

```typescript
interface IMarkAreaRadiusSpec extends IMarkerCrossSeriesSpec {
  radius: IDataPos | IDataPosCallback; // Start radius position
  radius1: IDataPos | IDataPosCallback; // End radius position
}
```

#### Angle-Radius Range Area

```typescript
interface IMarkAreaAngleRadiusSpec extends IMarkerCrossSeriesSpec {
  angle: IDataPos | IDataPosCallback; // Start angle position
  angle1: IDataPos | IDataPosCallback; // End angle position
  radius: IDataPos | IDataPosCallback; // Start radius position
  radius1: IDataPos | IDataPosCallback; // End radius position
}
```

### 5. Data Point Based Area

```typescript
interface IMarkAreaCoordinateSpec {
  coordinates: IDataPointSpec[] | ((seriesData: Datum[], relativeSeries: IMarkerSupportSeries) => IDataPointSpec[]);
  coordinatesOffset?: OffsetPoint[]; // Canvas coordinate offsets for each point
}
```

### 6. Canvas Position Based Area

```typescript
interface IMarkerPositionsSpec {
  positions:
    | MarkerPositionPoint[]
    | ((seriesData: Datum[], relativeSeries: IMarkerSupportSeries) => MarkerPositionPoint[]);
  regionRelative?: boolean; // Whether relative to region (default: false)
}
```

## Cross-Series Configuration

```typescript
interface IMarkerCrossSeriesSpec {
  startRelativeSeriesIndex?: number; // Start point series index
  endRelativeSeriesIndex?: number; // End point series index
  startRelativeSeriesId?: string; // Start point series ID
  endRelativeSeriesId?: string; // End point series ID
  specifiedDataSeriesIndex?: 'all' | number | number[]; // Data processing series index
  specifiedDataSeriesId?: 'all' | string | string[]; // Data processing series ID
}
```

## Area Styling Configuration

```typescript
interface IMarkAreaTheme {
  area?: Partial<IMarkerState<IPolygonMarkSpec | IArcMarkSpec>>; // Area fill and border styling
  label?: IMarkAreaLabel | IMarkAreaLabel[]; // Label configuration (supports multiple labels since 1.13.9)
}
```

### Area Style Properties

```typescript
interface IPolygonMarkSpec {
  fill?: string; // Fill color
  fillOpacity?: number; // Fill opacity
  stroke?: string; // Border color
  strokeWidth?: number; // Border width
  strokeOpacity?: number; // Border opacity
  strokeDasharray?: number[]; // Border dash pattern
  // ... more styling properties
}

interface IArcMarkSpec {
  fill?: string; // Fill color
  stroke?: string; // Border color
  strokeWidth?: number; // Border width
  innerRadius?: number; // Inner radius (for polar areas)
  outerRadius?: number; // Outer radius (for polar areas)
  startAngle?: number; // Start angle
  endAngle?: number; // End angle
  // ... more styling properties
}
```

### Label Configuration

```typescript
interface IMarkAreaLabel extends IMarkerLabelWithoutRefSpec {
  position?: keyof typeof IMarkAreaLabelPosition | IMarkCommonArcLabelPosition;
}

interface IMarkerLabelWithoutRefSpec {
  visible?: boolean; // Label visibility
  text?: string | string[] | number | number[] | RichTextContent;
  formatMethod?: IFormatMethod<[markData: Datum[], seriesData: Datum[]]>;

  // Layout properties
  minWidth?: number; // Minimum width (default: 30px)
  maxWidth?: number; // Maximum width for text wrapping
  autoRotate?: boolean; // Auto rotation based on area orientation
  confine?: boolean; // Keep label within visible area
  dx?: number; // Horizontal offset
  dy?: number; // Vertical offset

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
    style: ISymbolMarkSpec; // Symbol before text
  };
  space?: number; // Space between shape and text

  // Style and state configurations
  style?: IComposedTextMarkSpec | MarkerStyleCallback<IComposedTextMarkSpec>;
  state?: Record<MarkerStateValue, IComposedTextMarkSpec>;
}
```

## Animation Configuration

```typescript
interface BaseMarkerAnimation<T> {
  animationEnter?: T; // Enter animation
  animationUpdate?: T; // Update animation
  animationExit?: T; // Exit animation
}
```

## Helper Types

### Data Position Types

```typescript
type IDataPos = StringOrNumber | IAggrType;
type IAggrType = 'sum' | 'average' | 'min' | 'max' | 'variance' | 'standardDeviation' | 'median';
type IDataPosCallback = (
  relativeSeriesData,
  startRelativeSeriesData,
  endRelativeSeriesData,
  relativeSeries,
  startRelativeSeries,
  endRelativeSeries
) => StringOrNumber;
```

### Position Types

```typescript
interface MarkerPositionPoint {
  x: StringOrNumber; // X coordinate (pixel value or percentage)
  y: StringOrNumber; // Y coordinate (pixel value or percentage)
}

interface OffsetPoint {
  x?: number | string; // X offset (pixels or percentage)
  y?: number | string; // Y offset (pixels or percentage)
}
```

### State Configuration

```typescript
type IMarkerState<T> = {
  style?: T | MarkerStyleCallback<T>;
  state?: Record<MarkerStateValue, T | MarkerStateCallback<T>>;
};

type MarkerStateValue = 'hover' | 'hover_reverse' | 'selected' | 'selected_reverse';
```

## Usage Examples

### X-Axis Range Area

```typescript
const xRangeArea: IMarkAreaSpec = {
  x: 10,
  x1: 50,
  area: {
    style: {
      fill: 'rgba(255, 0, 0, 0.3)',
      stroke: 'red',
      strokeWidth: 2
    }
  },
  label: {
    visible: true,
    text: 'Target Range',
    position: 'middle'
  }
};
```

### Y-Axis Range Area with Aggregation

```typescript
const yRangeArea: IMarkAreaSpec = {
  y: 'min',
  y1: 'max',
  area: {
    style: { fill: 'rgba(0, 255, 0, 0.2)' },
    state: {
      hover: { fill: 'rgba(0, 255, 0, 0.4)' }
    }
  }
};
```

### Rectangular Area

```typescript
const rectArea: IMarkAreaSpec = {
  x: 10,
  x1: 30,
  y: 20,
  y1: 40,
  area: {
    style: {
      fill: 'rgba(0, 0, 255, 0.3)',
      stroke: 'blue',
      strokeDasharray: [5, 5]
    }
  },
  label: {
    visible: true,
    text: 'Key Region',
    position: 'center'
  }
};
```

### Polar Area

```typescript
const polarArea: IMarkAreaSpec = {
  angle: 0,
  angle1: 90,
  radius: 50,
  radius1: 100,
  area: {
    style: {
      fill: 'rgba(255, 255, 0, 0.3)',
      stroke: 'orange'
    }
  }
};
```

### Data-driven Area

```typescript
const dataArea: IMarkAreaSpec = {
  coordinates: [
    { x: 'Q1', y: 'min' },
    { x: 'Q2', y: 'max' },
    { x: 'Q3', y: 'average' },
    { x: 'Q4', y: 'min' }
  ],
  area: {
    style: { fill: 'rgba(128, 128, 128, 0.2)' }
  }
};
```
