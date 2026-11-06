## Core Interface Structure

```typescript
interface IScrollBarSpec extends IDataFilterComponentSpec, IScrollBarStyle {
  filterMode?: IFilterMode; // Data filter mode (default: 'axis')
  round?: boolean; // Rounded slider corners
  innerPadding?: number | number[] | IPadding; // Scroll bar inner padding
  range?: [number, number]; // Current visible range [0, 1]
  limitRange?: [number, number]; // Scroll limit range [0, 1]
}
```

## Data Filter Component Base (Inherited)

```typescript
interface IDataFilterComponentSpec extends Omit<IComponentSpec, 'width' | 'height'> {
  visible?: boolean; // Component visibility (default: true)
  orient?: IOrientType; // Component orientation (default: 'left')
  width?: 'auto' | number; // Component width (default: 'auto')
  height?: 'auto' | number; // Component height (default: 'auto')
  field?: string; // Associated mapping field
  axisId?: string; // Associated axis ID
  axisIndex?: number; // Associated axis index
  regionIndex?: number | number[]; // Associated region indices
  start?: number; // Start position ratio [0, 1] (default: 0)
  end?: number; // End position ratio [0, 1] (default: 1)
  startValue?: number | string; // Start data value
  endValue?: number | string; // End data value
  valueField?: string; // Data filter field
  rangeMode?: [string, string]; // Configuration mode matching
  autoIndent?: boolean; // Auto indentation
  auto?: boolean; // Auto mode (component auto-hide)
  zoomLock?: boolean; // Lock selection area size (default: false)
  minSpan?: number; // Minimum window size [0, 1] (default: 0)
  maxSpan?: number; // Maximum window size [0, 1] (default: 1)
  minValueSpan?: number; // Minimum data value span
  maxValueSpan?: number; // Maximum data value span
  delayType?: IDelayType; // Event trigger delay type
  delayTime?: number; // Event trigger delay time (default: 30)
  roamZoom?: IRoamZoomSpec | boolean; // Roam zoom mode (default: false)
  roamDrag?: IRoamDragSpec | boolean; // Roam drag mode
  roamScroll?: IRoamScrollSpec | boolean; // Roam scroll mode
  realTime?: boolean; // Real-time view updates (default: true)
}
```

## Scroll Bar Style Configuration

```typescript
interface IScrollBarStyle {
  rail?: Omit<IRectMarkSpec, 'width' | 'height'>; // Rail track styling
  slider?: Omit<IRectMarkSpec, 'width' | 'height'>; // Slider styling
}
```

## Supporting Type Definitions

### Filter Mode

```typescript
type IFilterMode = 'filter' | 'axis';
```

### Padding Configuration

```typescript
interface IPadding {
  top?: number; // Top padding
  bottom?: number; // Bottom padding
  left?: number; // Left padding
  right?: number; // Right padding
}
```

### Orientation Types

```typescript
type IOrientType = 'left' | 'top' | 'right' | 'bottom' | 'z';
```

## Complete Interface Definition

```typescript
interface IScrollBarSpec {
  // Component base properties
  regionIndex?: number | number[];
  regionId?: string | number | (string | number)[];
  seriesIndex?: number | number[];
  seriesId?: string | number | (string | number)[];

  // Basic configuration
  visible?: boolean;
  orient?: 'left' | 'top' | 'right' | 'bottom' | 'z';
  width?: 'auto' | number;
  height?: 'auto' | number;

  // Data association
  field?: string;
  axisId?: string;
  axisIndex?: number;
  valueField?: string;

  // Range configuration
  start?: number;
  end?: number;
  startValue?: number | string;
  endValue?: number | string;
  rangeMode?: [string, string];
  range?: [number, number];
  limitRange?: [number, number];

  // Behavior configuration
  filterMode?: 'filter' | 'axis';
  autoIndent?: boolean;
  auto?: boolean;
  zoomLock?: boolean;
  realTime?: boolean;

  // Span constraints
  minSpan?: number;
  maxSpan?: number;
  minValueSpan?: number;
  maxValueSpan?: number;

  // Timing configuration
  delayType?: 'throttle' | 'debounce';
  delayTime?: number;

  // Roam modes
  roamZoom?: boolean | IRoamZoomSpec;
  roamDrag?: boolean | IRoamDragSpec;
  roamScroll?: boolean | IRoamScrollSpec;

  // Scroll bar specific
  round?: boolean;
  innerPadding?:
    | number
    | number[]
    | {
        top?: number;
        bottom?: number;
        left?: number;
        right?: number;
      };

  // Rail styling
  rail?: {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    strokeOpacity?: number;
    fillOpacity?: number;
    cornerRadius?: number;
    // ... other IRectMarkSpec properties (excluding width/height)
  };

  // Slider styling
  slider?: {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    strokeOpacity?: number;
    fillOpacity?: number;
    cornerRadius?: number;
    // ... other IRectMarkSpec properties (excluding width/height)
  };
}
```

## Usage Examples

### Basic Scroll Bar Configuration

```typescript
const basicScrollBar: IScrollBarSpec = {
  visible: true,
  orient: 'bottom',
  height: 16,
  range: [0.2, 0.8]
};
```

### Styled Scroll Bar with Custom Appearance

```typescript
const styledScrollBar: IScrollBarSpec = {
  visible: true,
  orient: 'bottom',
  height: 20,
  round: true,
  innerPadding: [2, 4],
  rail: {
    fill: '#f1f3f4',
    stroke: '#dadce0',
    strokeWidth: 1,
    cornerRadius: 8
  },
  slider: {
    fill: '#4285f4',
    stroke: '#1a73e8',
    strokeWidth: 1,
    cornerRadius: 8,
    fillOpacity: 0.8
  }
};
```

### Scroll Bar with Range Limits

```typescript
const limitedScrollBar: IScrollBarSpec = {
  visible: true,
  orient: 'right',
  width: 18,
  range: [0.3, 0.7],
  limitRange: [0.1, 0.9],
  filterMode: 'axis',
  round: true
};
```

### Horizontal Time-Based Scroll Bar

```typescript
const timeScrollBar: IScrollBarSpec = {
  visible: true,
  orient: 'bottom',
  height: 24,
  axisIndex: 0,
  field: 'timestamp',
  start: 0.1,
  end: 0.6,
  innerPadding: { top: 4, bottom: 4, left: 8, right: 8 },
  realTime: true
};
```

### Vertical Data Scroll Bar

```typescript
const verticalScrollBar: IScrollBarSpec = {
  visible: true,
  orient: 'left',
  width: 16,
  filterMode: 'filter',
  minSpan: 0.05,
  maxSpan: 0.8,
  rail: {
    fill: '#e8eaed',
    cornerRadius: 4
  },
  slider: {
    fill: '#5f6368',
    cornerRadius: 4
  }
};
```

### Auto-Hide Scroll Bar

```typescript
const autoScrollBar: IScrollBarSpec = {
  visible: true,
  auto: true,
  orient: 'bottom',
  height: 12,
  round: true,
  delayType: 'throttle',
  delayTime: 100,
  rail: {
    fill: 'transparent'
  },
  slider: {
    fill: 'rgba(0, 0, 0, 0.3)'
  }
};
```

### Multi-Padding Scroll Bar

```typescript
const paddedScrollBar: IScrollBarSpec = {
  visible: true,
  orient: 'bottom',
  height: 28,
  innerPadding: [6, 12, 6, 12], // [top, right, bottom, left]
  round: true,
  range: [0, 0.5]
};
```

## Chart Integration Examples

### Line Chart with Horizontal Scroll Bar

```typescript
const lineChartWithScrollBar = {
  type: 'line',
  data: { values: timeSeriesData },
  xField: 'date',
  yField: 'value',
  scrollBar: [
    {
      orient: 'bottom',
      height: 20,
      round: true,
      range: [0.2, 0.8],
      rail: {
        fill: '#f0f0f0'
      },
      slider: {
        fill: '#007acc'
      }
    }
  ]
};
```

### Bar Chart with Vertical Scroll Bar

```typescript
const barChartWithScrollBar = {
  type: 'bar',
  data: { values: categoryData },
  xField: 'category',
  yField: 'value',
  scrollBar: [
    {
      orient: 'right',
      width: 16,
      filterMode: 'axis',
      limitRange: [0, 0.7]
    }
  ]
};
```

### Large Dataset with Performance Scroll Bar

```typescript
const performanceScrollBar = {
  type: 'line',
  data: { values: largeDataset },
  xField: 'x',
  yField: 'y',
  scrollBar: [
    {
      orient: 'bottom',
      height: 18,
      realTime: false,
      delayType: 'debounce',
      delayTime: 200,
      range: [0, 0.1] // Show only 10% initially
    }
  ]
};
```

### Dual Scroll Bar Configuration

```typescript
const dualScrollBarChart = {
  type: 'scatter',
  data: { values: data },
  xField: 'x',
  yField: 'y',
  scrollBar: [
    {
      orient: 'bottom',
      axisIndex: 0,
      height: 16,
      range: [0.2, 0.8]
    },
    {
      orient: 'right',
      axisIndex: 1,
      width: 16,
      range: [0.1, 0.9]
    }
  ]
};
```
