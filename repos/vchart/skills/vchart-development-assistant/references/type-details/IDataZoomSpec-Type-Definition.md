## Overview
`IDataZoomSpec` defines the configuration interface for data zoom components in VChart. It extends data filter functionality with rich styling options, providing interactive data navigation, range selection, and axis zooming capabilities with customizable visual elements.

## Core Interface Structure

```typescript
interface IDataZoomSpec extends IDataZoomStyle, IDataFilterComponentSpec {
  showBackgroundChart?: boolean;        // Show background chart (default: true)
  filterMode?: IFilterMode;             // Data filter mode (default: 'filter')
  valueField?: string;                  // Background trend line field
  startText?: ITextConfiguration;       // Start point text configuration
  endText?: ITextConfiguration;         // End point text configuration
  brushSelect?: boolean;                // Enable brush selection (default: false)
  ignoreBandSize?: boolean;             // Ignore axis bandSize constraints
  tolerance?: number;                   // Background chart node compression rate
}
```

## Data Filter Component Base (Inherited)

```typescript
interface IDataFilterComponentSpec extends Omit<IComponentSpec, 'width' | 'height'> {
  visible?: boolean;                    // Component visibility (default: true)
  orient?: IOrientType;                 // Component orientation (default: 'left')
  width?: 'auto' | number;              // Component width (default: 'auto')
  height?: 'auto' | number;             // Component height (default: 'auto')
  field?: string;                       // Associated mapping field
  axisId?: string;                      // Associated axis ID
  axisIndex?: number;                   // Associated axis index
  regionIndex?: number | number[];      // Associated region indices
  start?: number;                       // Start position ratio [0, 1] (default: 0)
  end?: number;                         // End position ratio [0, 1] (default: 1)
  startValue?: number | string;         // Start data value
  endValue?: number | string;           // End data value
  valueField?: string;                  // Data filter field
  rangeMode?: [string, string];         // Configuration mode matching
  autoIndent?: boolean;                 // Auto indentation
  auto?: boolean;                       // Auto mode (component auto-hide)
  zoomLock?: boolean;                   // Lock selection area size (default: false)
  minSpan?: number;                     // Minimum window size [0, 1] (default: 0)
  maxSpan?: number;                     // Maximum window size [0, 1] (default: 1)
  minValueSpan?: number;                // Minimum data value span
  maxValueSpan?: number;                // Maximum data value span
  delayType?: IDelayType;               // Event trigger delay type
  delayTime?: number;                   // Event trigger delay time (default: 30)
  roamZoom?: IRoamZoomSpec | boolean;   // Roam zoom mode (default: false)
  roamDrag?: IRoamDragSpec | boolean;   // Roam drag mode
  roamScroll?: IRoamScrollSpec | boolean; // Roam scroll mode
  realTime?: boolean;                   // Real-time view updates (default: true)
}
```

## Data Zoom Style Configuration

```typescript
interface IDataZoomStyle {
  showDetail?: 'auto' | boolean;        // Show start/end text ('auto' shows on hover)
  middleHandler?: IMiddleHandlerStyle;   // Middle handler styling
  background?: IBackgroundStyle;        // Background rectangle styling
  startHandler?: ISymbolMarkSpec;       // Start handler styling
  endHandler?: ISymbolMarkSpec;         // End handler styling
  startText?: ITextStyle;               // Start text styling
  endText?: ITextStyle;                 // End text styling
  dragMask?: IRectMarkSpec;             // Drag mask styling
  selectedBackground?: IRectMarkSpec;   // Selected area background styling
  backgroundChart?: IBackgroundChartStyle;        // Background chart styling
  selectedBackgroundChart?: ISelectedBackgroundChartStyle; // Selected background chart styling
}
```

## Style Component Definitions

### Middle Handler Configuration
```typescript
interface IMiddleHandlerStyle {
  visible?: boolean;                    // Middle handler visibility
  icon?: ISymbolMarkSpec;               // Center icon styling
  background?: {
    size?: number;                      // Background size (height for horizontal, width for vertical)
  } & IRectMarkSpec;
}
```

### Background Style Configuration
```typescript
interface IBackgroundStyle extends IRectMarkSpec {
  size?: number;                        // Background size (height for horizontal, width for vertical)
}
```

### Text Configuration
```typescript
interface ITextConfiguration {
  padding?: number;                     // Text outer margin
  style?: ITextMarkSpec;                // Text styling
  formatMethod?: (text: string | number) => string | string[]; // Format function
  formatter?: string | string[];        // Format template
}

interface ITextStyle extends ITextMarkSpec {
  padding?: number;                     // Text outer margin
}
```

### Chart Style Configuration
```typescript
interface IBackgroundChartStyle {
  line?: ILineMarkSpec;                 // Background line styling
  area?: IAreaMarkSpec;                 // Background area styling
}

interface ISelectedBackgroundChartStyle {
  line?: ILineMarkSpec;                 // Selected area line styling
  area?: IAreaMarkSpec;                 // Selected area area styling
}
```

## Supporting Type Definitions

### Filter Mode
```typescript
type IFilterMode = 'filter' | 'axis';
```

### Orientation Types
```typescript
type IOrientType = 'left' | 'top' | 'right' | 'bottom' | 'z';
```

### Delay Types
```typescript
type IDelayType = 'throttle' | 'debounce';
```

## Complete Interface Definition

```typescript
interface IDataZoomSpec {
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
  
  // Behavior configuration
  filterMode?: 'filter' | 'axis';
  autoIndent?: boolean;
  auto?: boolean;
  zoomLock?: boolean;
  brushSelect?: boolean;
  ignoreBandSize?: boolean;
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
  
  // Visual configuration
  showBackgroundChart?: boolean;
  showDetail?: 'auto' | boolean;
  tolerance?: number;
  
  // Handler styling
  middleHandler?: {
    visible?: boolean;
    icon?: {
      fill?: string;
      stroke?: string;
      strokeWidth?: number;
      size?: number;
      symbolType?: string;
      // ... other ISymbolMarkSpec properties
    };
    background?: {
      size?: number;
      fill?: string;
      stroke?: string;
      strokeWidth?: number;
      cornerRadius?: number;
      // ... other IRectMarkSpec properties
    };
  };
  
  // Background styling
  background?: {
    size?: number;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    cornerRadius?: number;
    // ... other IRectMarkSpec properties
  };
  
  // Handler styling
  startHandler?: {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    size?: number;
    symbolType?: string;
    // ... other ISymbolMarkSpec properties
  };
  
  endHandler?: {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    size?: number;
    symbolType?: string;
    // ... other ISymbolMarkSpec properties
  };
  
  // Text configuration
  startText?: {
    padding?: number;
    style?: {
      fontSize?: number;
      fontFamily?: string;
      fontWeight?: string | number;
      fill?: string;
      textAlign?: string;
      textBaseline?: string;
      // ... other ITextMarkSpec properties
    };
    formatMethod?: (text: string | number) => string | string[];
    formatter?: string | string[];
  };
  
  endText?: {
    padding?: number;
    style?: {
      fontSize?: number;
      fontFamily?: string;
      fontWeight?: string | number;
      fill?: string;
      textAlign?: string;
      textBaseline?: string;
      // ... other ITextMarkSpec properties
    };
    formatMethod?: (text: string | number) => string | string[];
    formatter?: string | string[];
  };
  
  // Interaction styling
  dragMask?: {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    fillOpacity?: number;
    // ... other IRectMarkSpec properties
  };
  
  selectedBackground?: {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    fillOpacity?: number;
    // ... other IRectMarkSpec properties
  };
  
  // Chart styling
  backgroundChart?: {
    line?: {
      stroke?: string;
      strokeWidth?: number;
      strokeOpacity?: number;
      lineDash?: number[];
      // ... other ILineMarkSpec properties
    };
    area?: {
      fill?: string;
      fillOpacity?: number;
      stroke?: string;
      strokeWidth?: number;
      // ... other IAreaMarkSpec properties
    };
  };
  
  selectedBackgroundChart?: {
    line?: {
      stroke?: string;
      strokeWidth?: number;
      strokeOpacity?: number;
      lineDash?: number[];
      // ... other ILineMarkSpec properties
    };
    area?: {
      fill?: string;
      fillOpacity?: number;
      stroke?: string;
      strokeWidth?: number;
      // ... other IAreaMarkSpec properties
    };
  };
}
```

## Usage Examples

### Basic Data Zoom Configuration
```typescript
const basicDataZoom: IDataZoomSpec = {
  visible: true,
  orient: 'bottom',
};
```

### Styled Data Zoom with Handlers
```typescript
const styledDataZoom: IDataZoomSpec = {
  visible: true,
  orient: 'bottom',
  height: 80,
  showBackgroundChart: true,
  background: {
    fill: '#f8f9fa',
    stroke: '#dee2e6',
    strokeWidth: 1,
    cornerRadius: 4
  },
  selectedBackground: {
    fill: 'rgba(0, 123, 255, 0.1)',
    stroke: '#007bff',
    strokeWidth: 1
  },
  startHandler: {
    fill: '#007bff',
    stroke: '#fff',
    strokeWidth: 2,
    size: 12,
    symbolType: 'circle'
  },
  endHandler: {
    fill: '#007bff',
    stroke: '#fff',
    strokeWidth: 2,
    size: 12,
    symbolType: 'circle'
  }
};
```

### Data Zoom with Custom Text Formatting
```typescript
const formattedDataZoom: IDataZoomSpec = {
  visible: true,
  orient: 'bottom',
  start: 0.2,
  end: 0.8,
  startText: {
    padding: 5,
    style: {
      fontSize: 12,
      fill: '#666',
      fontWeight: 'bold'
    },
    formatMethod: (value) => `Start: ${value}`,
    formatter: 'Start: {value:.2f}'
  },
  endText: {
    padding: 5,
    style: {
      fontSize: 12,
      fill: '#666',
      fontWeight: 'bold'
    },
    formatMethod: (value) => `End: ${value}`,
    formatter: 'End: {value:.2f}'
  }
};
```