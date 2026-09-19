## Core Interface Structure

```typescript
interface IPlayer extends IPlayerTheme {
  type?: PlayerType; // Player type (default: 'continuous')
  auto?: boolean; // Auto-play mode (default: true)
  loop?: boolean; // Loop playback (default: false)
  interval?: number; // Play interval in ms (default: 1000)
  totalDuration?: number; // Total duration in ms (mutually exclusive with interval)
  direction?: DirectionType; // Play direction (default: 'default')
  alternate?: boolean; // Alternate direction (default: false)
  specs?: Partial<Omit<IChartSpec, 'player'>>[]; // Chart specs for each frame
}
```

## Player Theme Configuration (Inherited)

```typescript
interface IPlayerTheme extends ILayoutItemSpec {
  visible?: boolean; // Component visibility (default: true)
  dx?: number; // X-axis offset (default: 0)
  dy?: number; // Y-axis offset (default: 0)
  width?: number; // Component width
  height?: number; // Component height
  position?: 'start' | 'middle' | 'end'; // Alignment position
  orient?: OrientType; // Component orientation (default: 'bottom')
  slider?: IPlayerSlider; // Slider configuration
  controller?: IPlayerController; // Controller buttons configuration
}
```

## Player Slider Configuration

```typescript
interface IPlayerSlider {
  visible?: boolean; // Slider visibility (default: true)
  space?: number; // Spacing from previous element
  dx?: number; // X-axis offset (default: 0)
  dy?: number; // Y-axis offset (default: 0)
  railStyle?: IRectMarkSpec; // Rail track styling
  trackStyle?: IRectMarkSpec; // Active track styling
  handlerStyle?: ISymbolMarkSpec; // Handler styling
}
```

## Player Controller Configuration

```typescript
interface IPlayerController {
  visible?: boolean; // Controller visibility (default: true)
  start?: IControllerButton; // Start/play button
  pause?: IControllerButton; // Pause button
  backward?: IControllerButton; // Backward button
  forward?: IControllerButton; // Forward button
}

type IControllerButton = Partial<ControllerLayout & BaseGraphicAttributes<ISymbolMarkSpec>>;
```

## Supporting Type Definitions

### Player Types

```typescript
type PlayerType = 'continuous' | 'discrete';
```

### Direction Types

```typescript
type DirectionType = 'default' | 'reverse';
```

### Orientation Types

```typescript
type OrientType = 'left' | 'right' | 'top' | 'bottom';
```

### Player Field Configuration

```typescript
interface IPlayerField {
  playerField?: string; // Field name for player data
}
```

## Complete Interface Definition

```typescript
interface IPlayer {
  // Layout properties (from ILayoutItemSpec)
  layoutType?: 'region-relative' | 'absolute' | 'normal';
  layoutLevel?: number;
  layoutBindRegionID?: number | number[];
  orient?: 'left' | 'right' | 'top' | 'bottom';
  alignSelf?: 'start' | 'end' | 'middle';
  width?: number | string | ((chartViewRect: any) => number);
  height?: number | string | ((chartViewRect: any) => number);
  maxWidth?: number | string | ((chartViewRect: any) => number);
  minWidth?: number | string | ((chartViewRect: any) => number);
  maxHeight?: number | string | ((chartViewRect: any) => number);
  minHeight?: number | string | ((chartViewRect: any) => number);
  padding?:
    | number
    | number[]
    | {
        left?: number | string | ((chartViewRect: any) => number);
        right?: number | string | ((chartViewRect: any) => number);
        top?: number | string | ((chartViewRect: any) => number);
        bottom?: number | string | ((chartViewRect: any) => number);
      };
  offsetX?: number | string | ((chartViewRect: any) => number);
  offsetY?: number | string | ((chartViewRect: any) => number);
  left?: number | string | ((chartViewRect: any) => number);
  right?: number | string | ((chartViewRect: any) => number);
  top?: number | string | ((chartViewRect: any) => number);
  bottom?: number | string | ((chartViewRect: any) => number);
  center?: boolean;
  zIndex?: number;
  clip?: boolean;

  // Player theme properties
  visible?: boolean;
  dx?: number;
  dy?: number;
  position?: 'start' | 'middle' | 'end';

  // Player functionality
  type?: 'continuous' | 'discrete';
  auto?: boolean;
  loop?: boolean;
  interval?: number;
  totalDuration?: number;
  direction?: 'default' | 'reverse';
  alternate?: boolean;
  specs?: Partial<Omit<IChartSpec, 'player'>>[];

  // Slider configuration
  slider?: {
    visible?: boolean;
    space?: number;
    dx?: number;
    dy?: number;
    railStyle?: {
      fill?: string;
      stroke?: string;
      strokeWidth?: number;
      cornerRadius?: number;
      width?: number;
      height?: number;
      // ... other IRectMarkSpec properties
    };
    trackStyle?: {
      fill?: string;
      stroke?: string;
      strokeWidth?: number;
      cornerRadius?: number;
      width?: number;
      height?: number;
      // ... other IRectMarkSpec properties
    };
    handlerStyle?: {
      fill?: string;
      stroke?: string;
      strokeWidth?: number;
      size?: number;
      symbolType?: string;
      // ... other ISymbolMarkSpec properties
    };
  };

  // Controller configuration
  controller?: {
    visible?: boolean;
    start?: {
      style?: {
        fill?: string;
        stroke?: string;
        strokeWidth?: number;
        size?: number;
        symbolType?: string;
        // ... other ISymbolMarkSpec properties
      };
      space?: number;
      position?: 'start' | 'middle' | 'end';
    };
    pause?: {
      style?: {
        fill?: string;
        stroke?: string;
        strokeWidth?: number;
        size?: number;
        symbolType?: string;
        // ... other ISymbolMarkSpec properties
      };
      space?: number;
      position?: 'start' | 'middle' | 'end';
    };
    backward?: {
      style?: {
        fill?: string;
        stroke?: string;
        strokeWidth?: number;
        size?: number;
        symbolType?: string;
        // ... other ISymbolMarkSpec properties
      };
      space?: number;
      position?: 'start' | 'middle' | 'end';
    };
    forward?: {
      style?: {
        fill?: string;
        stroke?: string;
        strokeWidth?: number;
        size?: number;
        symbolType?: string;
        // ... other ISymbolMarkSpec properties
      };
      space?: number;
      position?: 'start' | 'middle' | 'end';
    };
  };
}
```

## Usage Examples

### Basic Continuous Player

```typescript
const basicPlayer: IPlayer = {
  type: 'continuous',
  auto: true,
  loop: true,
  interval: 2000
};
```

### Discrete Player with Custom Styling

```typescript
const discretePlayer: IPlayer = {
  type: 'discrete',
  auto: false,
  loop: false,
  direction: 'default',
  orient: 'bottom',
  position: 'middle',
  slider: {
    visible: true,
    railStyle: {
      fill: '#e8e8e8',
      height: 6,
      cornerRadius: 3
    },
    trackStyle: {
      fill: '#007acc',
      height: 6,
      cornerRadius: 3
    },
    handlerStyle: {
      fill: '#007acc',
      stroke: '#fff',
      strokeWidth: 2,
      size: 12,
      symbolType: 'circle'
    }
  }
};
```

### Player with Custom Controller

```typescript
const customControllerPlayer: IPlayer = {
  type: 'continuous',
  auto: true,
  interval: 1500,
  controller: {
    visible: true,
    start: {
      style: {
        fill: '#28a745',
        size: 20,
        symbolType: 'triangleRight'
      },
      space: 8
    },
    pause: {
      style: {
        fill: '#ffc107',
        size: 20,
        symbolType: 'rect'
      },
      space: 8
    },
    backward: {
      style: {
        fill: '#6c757d',
        size: 16,
        symbolType: 'triangleLeft'
      },
      space: 8
    },
    forward: {
      style: {
        fill: '#6c757d',
        size: 16,
        symbolType: 'triangleRight'
      },
      space: 8
    }
  }
};
```

### Time-Based Player with Duration

```typescript
const durationPlayer: IPlayer = {
  type: 'continuous',
  auto: true,
  loop: true,
  totalDuration: 10000, // 10 seconds total
  direction: 'default',
  alternate: true
};
```

### Positioned Player with Layout

```typescript
const positionedPlayer: IPlayer = {
  type: 'discrete',
  orient: 'top',
  position: 'end',
  width: 400,
  height: 60,
  padding: [10, 20],
  auto: false,
  slider: {
    visible: true,
    space: 20
  }
};
```

### Player with Chart Specs

```typescript
const multiSpecPlayer: IPlayer = {
  type: 'discrete',
  auto: true,
  interval: 3000,
  specs: [
    {
      data: { values: data2020 },
      title: { text: 'Data for 2020' }
    },
    {
      data: { values: data2021 },
      title: { text: 'Data for 2021' }
    },
    {
      data: { values: data2022 },
      title: { text: 'Data for 2022' }
    }
  ]
};
```

## Chart Integration Examples

### Bar Chart with Time Player

```typescript
const animatedBarChart = {
  type: 'bar',
  data: { values: timeSeriesData },
  xField: 'category',
  yField: 'value',
  player: {
    type: 'continuous',
    auto: true,
    interval: 1000,
    loop: true,
    orient: 'bottom',
    slider: {
      railStyle: {
        fill: '#f0f0f0'
      },
      trackStyle: {
        fill: '#007acc'
      }
    }
  }
};
```

### Line Chart with Discrete Player

```typescript
const timelineChart = {
  type: 'line',
  data: { values: yearlyData },
  xField: 'month',
  yField: 'sales',
  seriesField: 'year',
  player: {
    type: 'discrete',
    auto: false,
    direction: 'default',
    controller: {
      visible: true,
      start: {
        style: { fill: '#28a745' }
      },
      pause: {
        style: { fill: '#dc3545' }
      }
    }
  }
};
```

### Scatter Plot with Alternating Player

```typescript
const scatterAnimation = {
  type: 'scatter',
  data: { values: populationData },
  xField: 'gdp',
  yField: 'lifeExpectancy',
  sizeField: 'population',
  player: {
    type: 'continuous',
    auto: true,
    interval: 2000,
    direction: 'default',
    alternate: true,
    loop: true
  }
};
```

### Dashboard with Custom Player Layout

```typescript
const dashboardWithPlayer = {
  type: 'common',
  layout: {
    type: 'grid',
    col: 1,
    row: 2,
    elements: [
      {
        modelId: 'chart-region',
        col: 0,
        row: 0
      },
      {
        modelId: 'player',
        col: 0,
        row: 1
      }
    ]
  },
  region: {
    id: 'chart-region'
  },
  player: {
    type: 'discrete',
    orient: 'bottom',
    width: '100%',
    height: 80,
    padding: 20
  }
};
```
