## Overview

`IMarkLineSpec` is the configuration type for mark lines (auxiliary reference lines) in VChart, used to display trend lines, average lines, and other reference lines on charts.

```typescript
export type IMarkLineSpec =
  | (IMarkerSpec & CartesianMarkLineSpecs & IMarkLineTheme & BaseMarkerAnimation)
  | (IStepMarkLineSpec & BaseMarkerAnimation);
```

## Basic Structure

### IMarkerSpec - Base Configuration

Common configuration for all marker components (flattened from IComponentSpec & ILayoutItemSpec):

```typescript
interface IMarkerSpec {
  // Component association
  regionIndex?: number | number[];
  regionId?: StringOrNumber | StringOrNumber[];
  seriesIndex?: number | number[];
  seriesId?: StringOrNumber | StringOrNumber[];
  
  // Layout configuration
  layoutType?: ILayoutType;
  layoutLevel?: number;
  alignSelf?: 'start' | 'end' | 'middle';
  orient?: IOrientType;
  padding?: ILayoutPaddingSpec;
  noOuterPadding?: boolean;
  width?: ILayoutNumber;
  maxWidth?: ILayoutNumber;
  minWidth?: ILayoutNumber;
  height?: ILayoutNumber;
  maxHeight?: ILayoutNumber;
  minHeight?: ILayoutNumber;
  offsetX?: ILayoutNumber;
  offsetY?: ILayoutNumber;
  zIndex?: number;
  clip?: boolean;
  left?: ILayoutNumber;
  right?: ILayoutNumber;
  top?: ILayoutNumber;
  bottom?: ILayoutNumber;
  center?: boolean;
  
  // Model specification
  id?: StringOrNumber;
  
  // Marker specific properties
  relativeSeriesIndex?: number;
  relativeSeriesId?: number | string;
  visible?: boolean;
  interactive?: boolean;
  autoRange?: boolean;
  name?: string;
  coordinateType?: string;
}
```

## Cartesian Coordinate System Mark Lines

### Single Axis Lines

#### IMarkLineXSpec - Vertical Line (X-axis)
```typescript
interface IMarkLineXSpec extends IMarkerCrossSeriesSpec {
  /**
   * X-axis position for vertical reference line
   * Supports: value | aggregation | callback | percentage ('15%')
   */
  x: IDataPos | IDataPosCallback;
}
```

#### IMarkLineYSpec - Horizontal Line (Y-axis)
```typescript
interface IMarkLineYSpec extends IMarkerCrossSeriesSpec {
  /**
   * Y-axis position for horizontal reference line
   * Supports: value | aggregation | callback | percentage ('15%')
   */
  y: IDataPos | IDataPosCallback;
}
```

### Two-Point Lines

```typescript
interface IMarkLineXYSpec extends IMarkerCrossSeriesSpec {
  x: IDataPos | IDataPosCallback;   // Start point x
  y: IDataPos | IDataPosCallback;   // Start point y
  x1: IDataPos | IDataPosCallback;  // End point x
  y1: IDataPos | IDataPosCallback;  // End point y
}
```

## Polar Coordinate System Mark Lines

### Single Axis Lines

#### IMarkLineAngleSpec - Angle Line
```typescript
interface IMarkLineAngleSpec extends IMarkerCrossSeriesSpec {
  /**
   * Angle axis position in polar coordinate system
   */
  angle: IDataPos | IDataPosCallback;
}
```

#### IMarkLineRadiusSpec - Radius Line
```typescript
interface IMarkLineRadiusSpec extends IMarkerCrossSeriesSpec {
  /**
   * Radius axis position in polar coordinate system
   */
  radius: IDataPos | IDataPosCallback;
}
```

### Two-Point Polar Lines

```typescript
interface IMarkLineAngRadSpec extends IMarkerCrossSeriesSpec {
  angle: IDataPos | IDataPosCallback;   // Start angle
  angle1: IDataPos | IDataPosCallback;  // End angle
  radius: IDataPos | IDataPosCallback;  // Start radius
  radius1: IDataPos | IDataPosCallback; // End radius
}
```

## Data-Based Mark Lines

### IMarkLineCoordinateSpec - Data Point Line
```typescript
interface IMarkLineCoordinateSpec {
  /**
   * Data points for reference line
   * Supports callback function since v1.12.0
   */
  coordinates: IDataPointSpec[] | ((seriesData: Datum[], relativeSeries: IMarkerSupportSeries) => IDataPointSpec[]);
  
  /**
   * Offset for each coordinate point
   * @since 1.7.3
   */
  coordinatesOffset?: OffsetPoint[];
  
  /**
   * Data processing method
   */
  process?: {
    x: IAggrType;
  } | {
    y: IAggrType;
  } | {
    xy: IRegressType;
  };
}
```

## Step Mark Lines

### IStepMarkLineSpec - Step Line
```typescript
interface IStepMarkLineSpec extends IMarkerSpec {
  type: 'type-step';
  
  /**
   * Connection direction for step line
   */
  connectDirection: 'top' | 'bottom' | 'left' | 'right';
  
  /**
   * Extension distance in connection direction
   * number: pixel value | string: percentage ('30%')
   */
  expandDistance?: number | string;
  
  /**
   * Label configuration
   */
  label?: IMarkerLabelSpec;
  
  /**
   * Line configuration
   */
  line?: {
    multiSegment?: boolean;
    mainSegmentIndex?: number;
    style?: ILineMarkSpec | ILineMarkSpec[];
    state?: Record<MarkerStateValue, ILineMarkSpec | ILineMarkSpec[] | MarkerStateCallback>;
  };
}
```

## Cross-Series Configuration

### IMarkerCrossSeriesSpec - Series Association
```typescript
interface IMarkerCrossSeriesSpec {
  /**
   * Start point associated series index
   */
  startRelativeSeriesIndex?: number;
  
  /**
   * End point associated series index
   */
  endRelativeSeriesIndex?: number;
  
  /**
   * Start point associated series ID
   */
  startRelativeSeriesId?: string;
  
  /**
   * End point associated series ID
   */
  endRelativeSeriesId?: string;
  
  /**
   * Specified data series index for processing
   * @since 1.11.0
   */
  specifiedDataSeriesIndex?: 'all' | number | number[];
  
  /**
   * Specified data series ID for processing
   * @since 1.11.0
   */
  specifiedDataSeriesId?: 'all' | string | string[];
}
```

## Dependency Types

### Position Types
```typescript
type IDataPos = StringOrNumber | IAggrType;
type IDataPosCallback = (
  relativeSeriesData: Datum[],
  startRelativeSeriesData: Datum[],
  endRelativeSeriesData: Datum[],
  relativeSeries: IMarkerSupportSeries,
  startRelativeSeries: IMarkerSupportSeries,
  endRelativeSeries: IMarkerSupportSeries
) => StringOrNumber;

type IAggrType = 'sum' | 'average' | 'min' | 'max' | 'variance' | 'standardDeviation' | 'median';
```

### Data Point Specification
```typescript
interface IDataPointSpec {
  [key: string]: IDataPos | IDataPosCallback;
  refRelativeSeriesIndex?: number;
  refRelativeSeriesId?: StringOrNumber;
  xFieldIndex?: number;
  xFieldDim?: string;
  yFieldIndex?: number;
  yFieldDim?: string;
  angleFieldIndex?: number;
  angleFieldDim?: string;
  radiusFieldIndex?: number;
  radiusFieldDim?: string;
}
```

### Offset Configuration
```typescript
interface OffsetPoint {
  /**
   * X direction offset: pixel value or percentage
   */
  x?: number | string;
  
  /**
   * Y direction offset: pixel value or percentage
   */
  y?: number | string;
}
```

## Usage Examples

### Basic Vertical Line
```typescript
const verticalLine: IMarkLineSpec = {
  x: 100, // Fixed position at x=100
  label: {
    visible: true,
    text: 'Target Line'
  },
  line: {
    style: {
      stroke: '#ff0000',
      lineWidth: 2,
      lineDash: [4, 4]
    }
  }
};
```

### Average Line with Aggregation
```typescript
const averageLine: IMarkLineSpec = {
  y: 'average', // Average value of y-axis data
  label: {
    visible: true,
    text: 'Average',
    position: 'end'
  },
  line: {
    style: {
      stroke: '#1890ff',
      lineWidth: 1
    }
  }
};
```

### Data Point Reference Line
```typescript
const dataPointLine: IMarkLineSpec = {
  coordinates: [
    { x: 'min', y: 'min' },
    { x: 'max', y: 'max' }
  ],
  label: {
    visible: true,
    text: 'Trend Line'
  },
  line: {
    style: {
      stroke: '#52c41a',
      lineWidth: 2
    }
  }
};
```

### Step Line Configuration
```typescript
const stepLine: IStepMarkLineSpec = {
  type: 'type-step',
  connectDirection: 'top',
  expandDistance: '20%',
  coordinates: [
    { x: 10, y: 20 },
    { x: 90, y: 80 }
  ],
  label: {
    visible: true,
    text: 'Step Connection'
  },
  line: {
    style: {
      stroke: '#722ed1',
      lineWidth: 2
    }
  }
};
```

### Polar Coordinate Line
```typescript
const polarLine: IMarkLineSpec = {
  angle: 45, // 45 degree angle line
  label: {
    visible: true,
    text: '45° Reference'
  },
  line: {
    style: {
      stroke: '#fa8c16',
      lineWidth: 1,
      lineDash: [2, 2]
    }
  }
};
```
