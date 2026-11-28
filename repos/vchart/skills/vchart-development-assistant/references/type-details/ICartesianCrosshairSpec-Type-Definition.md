## Overview

`ICartesianCrosshairSpec` is the configuration type for the crosshair component in VChart's Cartesian coordinate system, used to display crosshair auxiliary lines and labels when the mouse hovers or clicks, helping users accurately read data values.

```typescript
export interface ICartesianCrosshairSpec extends ICommonCrosshairSpec {
  /**
   * Crosshair configuration for x-axis in Cartesian coordinate system
   */
  xField?: ICrosshairCategoryFieldSpec;
  /**
   * Crosshair configuration for y-axis in Cartesian coordinate system
   */
  yField?: ICrosshairCategoryFieldSpec;
}
```

## Basic Structure

### ICommonCrosshairSpec - Common Configuration

Common configuration supported by all crosshair components:

```typescript
export interface ICommonCrosshairSpec extends IComponentSpec {
  /**
   * Whether to keep sync with tooltip, default is false
   * @since 1.11.1
   */
  followTooltip?: boolean | Partial<ITooltipActiveTypeAsKeys<boolean, boolean, boolean>>;
  /**
   * Trigger mode
   * @default 'hover'
   */
  trigger?: CrossHairTrigger;
  /**
   * Trigger mode to hide crosshair
   */
  triggerOff?: CrossHairTrigger | 'none' | number;
  /**
   * Lock after click, only click can update position or unlock
   * @since 1.9.0
   */
  lockAfterClick?: boolean;
  /**
   * Display layer level for crosshair text
   */
  labelZIndex?: number;
  /**
   * Display layer level for crosshair auxiliary graphics
   */
  gridZIndex?: number;
}
```

## Axis Field Configuration

### ICrosshairCategoryFieldSpec - Category Field Configuration

Configuration for crosshair on x-axis and y-axis:

```typescript
export interface ICrosshairCategoryFieldSpec extends ICrosshairDataBindSpec {
  /**
   * Whether visible
   */
  visible: boolean;
  /**
   * Crosshair auxiliary graphics configuration
   */
  line?: ICrosshairLineSpec | Omit<ICrosshairRectSpec, 'width'>;
  /**
   * Crosshair text configuration
   */
  label?: ICrosshairLabelSpec;
}
```

### ICrosshairDataBindSpec - Data Binding Configuration

```typescript
export interface ICrosshairDataBindSpec {
  /**
   * Declare the axis index bound to crosshair. If not declared, it will bind to all axes corresponding to the crosshair position by default
   */
  bindingAxesIndex?: number[];
  /**
   * Crosshair initialization display information. The crosshair component can be displayed by default when the chart is drawn through this configuration
   */
  defaultSelect?: {
    /**
     * Declare the axis index to display data
     */
    axisIndex: number;
    /**
     * Declare the data to display
     */
    datum: StringOrNumber;
  };
}
```

## Auxiliary Graphics Configuration

### ICrosshairLineSpec - Line Configuration

```typescript
export interface ICrosshairLineSpec {
  /**
   * Whether to display auxiliary graphics
   */
  visible?: boolean;
  /**
   * Set auxiliary graphics type to 'line'
   */
  type?: 'line';
  /**
   * Line width
   * @default 2
   */
  width?: number;
  /**
   * Whether smooth in polar coordinate system
   */
  smooth?: boolean;
  /**
   * Style configuration for auxiliary graphics
   */
  style?: ICrosshairLineStyle;
}
```

### ICrosshairRectSpec - Rectangle Configuration

```typescript
export interface ICrosshairRectSpec {
  /**
   * Whether to display auxiliary graphics
   */
  visible?: boolean;
  /**
   * Set auxiliary graphics type to 'rect'
   */
  type?: 'rect';
  /**
   * Width configuration
   * @default '100%'
   */
  width?: number | string | ICrosshairRectWidthCallback;
  /**
   * Style configuration for auxiliary graphics
   */
  style?: ICrosshairRectStyle;
}
```

## Label Configuration

### ICrosshairLabelSpec - Label Configuration

```typescript
export interface ICrosshairLabelSpec {
  /**
   * Whether crosshair auxiliary label is displayed
   */
  visible?: boolean;
  /**
   * Label text formatting method
   */
  formatMethod?: (text: StringOrNumber | string[]) => string | string[];
  /**
   * Formatting template
   * @since 1.10.0
   */
  formatter?: string | string[];
  /**
   * Text style configuration
   */
  style?: Partial<ITextMarkSpec>;
  /**
   * Text background related configuration
   */
  labelBackground?: ICrosshairLabelBackgroundSpec;
  /**
   * Whether text rotates with axis label angle, currently only supported in Cartesian coordinate system
   * @since 1.13.12
   */
  syncAxisLabelAngle?: boolean;
}
```

### ICrosshairLabelBackgroundSpec - Label Background Configuration

```typescript
export interface ICrosshairLabelBackgroundSpec {
  /**
   * Whether to display background, default is true
   */
  visible?: boolean;
  /**
   * Minimum width in pixels
   * @default 30
   */
  minWidth?: number;
  /**
   * Maximum width in pixels. Text will be automatically ellipsized when exceeding maximum width
   */
  maxWidth?: number;
  /**
   * Internal padding
   */
  padding?: IPadding | number | number[];
  /**
   * Style configuration for label background
   */
  style?: Partial<IRectMarkSpec>;
}
```

## Dependency Type Definitions

### Trigger Types
```typescript
export type CrossHairTrigger = 'click' | 'hover' | ['click', 'hover'];
```

### Tooltip Sync Configuration
```typescript
export interface ITooltipActiveTypeAsKeys<T, K, U> {
  /**
   * Configuration for mark tooltip
   */
  mark?: T;
  /**
   * Configuration for dimension tooltip
   */
  dimension?: K;
  /**
   * Configuration for group tooltip
   */
  group?: U;
}
```

### Style Types
```typescript
export type ICrosshairLineStyle = Pick<
  ILineMarkSpec,
  'stroke' | 'strokeOpacity' | 'opacity' | 'lineDash' | 'lineWidth'
>;

export type ICrosshairRectStyle = ICrosshairLineStyle & 
  Pick<IRectMarkSpec, 'fill' | 'fillOpacity' | 'cornerRadius'>;

export type ICrosshairRectWidthCallback = (
  axisSize: { width: number; height: number }, 
  axis: IAxis
) => number;
```

### Basic Style Types
```typescript
interface ILineMarkSpec {
  stroke?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
  opacity?: number;
  lineDash?: number[];
  lineWidth?: number;
  // ... more style properties
}

interface IRectMarkSpec {
  fill?: string;
  fillOpacity?: number;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
  // ... more style properties
}

interface ITextMarkSpec {
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  fill?: string;
  textAlign?: string;
  textBaseline?: string;
  // ... more style properties
}

type IPadding = {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
};

type StringOrNumber = string | number;
```

## Usage Examples

### Basic Crosshair Configuration

```typescript
const basicCrosshair: ICartesianCrosshairSpec = {
  xField: {
    visible: true,
    line: {
      visible: true,
      type: 'line',
      style: {
        stroke: '#999',
        lineWidth: 1,
        lineDash: [4, 4]
      }
    },
    label: {
      visible: true,
      style: {
        fontSize: 12,
        fill: '#333'
      }
    }
  },
  yField: {
    visible: true,
    line: {
      visible: true,
      type: 'line',
      style: {
        stroke: '#999',
        lineWidth: 1,
        lineDash: [4, 4]
      }
    },
    label: {
      visible: true,
      style: {
        fontSize: 12,
        fill: '#333'
      }
    }
  }
};
```

### Advanced Crosshair with Background and Formatting

```typescript
const advancedCrosshair: ICartesianCrosshairSpec = {
  trigger: 'hover',
  lockAfterClick: false,
  followTooltip: true,
  labelZIndex: 1000,
  gridZIndex: 100,
  
  xField: {
    visible: true,
    bindingAxesIndex: [0],
    line: {
      visible: true,
      type: 'line',
      width: 2,
      style: {
        stroke: '#ff4d4f',
        strokeOpacity: 0.8,
        lineDash: [2, 2]
      }
    },
    label: {
      visible: true,
      formatMethod: (text) => `X: ${text}`,
      style: {
        fontSize: 12,
        fill: '#fff',
        fontWeight: 'bold'
      },
      labelBackground: {
        visible: true,
        padding: [4, 8],
        style: {
          fill: '#ff4d4f',
          stroke: '#d9363e',
          strokeWidth: 1,
          cornerRadius: 4
        }
      }
    }
  },
  
  yField: {
    visible: true,
    bindingAxesIndex: [0],
    line: {
      visible: true,
      type: 'line',
      width: 2,
      style: {
        stroke: '#1890ff',
        strokeOpacity: 0.8,
        lineDash: [2, 2]
      }
    },
    label: {
      visible: true,
      formatMethod: (text) => `Y: ${Number(text).toFixed(2)}`,
      style: {
        fontSize: 12,
        fill: '#fff',
        fontWeight: 'bold'
      },
      labelBackground: {
        visible: true,
        padding: [4, 8],
        style: {
          fill: '#1890ff',
          stroke: '#096dd9',
          strokeWidth: 1,
          cornerRadius: 4
        }
      }
    }
  }
};
```

### Rectangle Area Highlight Crosshair

```typescript
const rectCrosshair: ICartesianCrosshairSpec = {
  trigger: ['hover', 'click'],
  triggerOff: 'none',
  
  xField: {
    visible: true,
    line: {
      visible: true,
      type: 'rect',
      width: '100%',
      style: {
        fill: 'rgba(24, 144, 255, 0.1)',
        stroke: '#1890ff',
        strokeWidth: 1
      }
    },
    label: {
      visible: true,
      formatter: '{value}',
      syncAxisLabelAngle: true,
      style: {
        fontSize: 11,
        fill: '#1890ff'
      },
      labelBackground: {
        visible: true,
        minWidth: 40,
        padding: 6,
        style: {
          fill: 'rgba(24, 144, 255, 0.1)',
          stroke: '#1890ff'
        }
      }
    }
  },
  
  yField: {
    visible: true,
    line: {
      visible: true,
      type: 'line',
      style: {
        stroke: '#1890ff',
        lineWidth: 1,
        opacity: 0.8
      }
    },
    label: {
      visible: true,
      formatMethod: (text) => `${Number(text).toLocaleString()}`,
      style: {
        fontSize: 11,
        fill: '#1890ff'
      }
    }
  }
};
```

### Default Display and Axis Binding Configuration

```typescript
const defaultCrosshair: ICartesianCrosshairSpec = {
  xField: {
    visible: true,
    bindingAxesIndex: [0, 1], // Bind to the 0th and 1st x-axis
    defaultSelect: {
      axisIndex: 0,
      datum: '2023-06'  // Default display crosshair for June 2023
    },
    line: {
      visible: true,
      style: {
        stroke: '#52c41a',
        lineWidth: 2
      }
    },
    label: {
      visible: true,
      formatMethod: (text) => new Date(text).toLocaleDateString('zh-CN'),
      style: {
        fontSize: 12,
        fill: '#52c41a'
      }
    }
  },
  
  yField: {
    visible: true,
    bindingAxesIndex: [0], // Bind to the 0th y-axis
    defaultSelect: {
      axisIndex: 0,
      datum: 1000  // Default display crosshair for value 1000
    },
    line: {
      visible: true,
      style: {
        stroke: '#52c41a',
        lineWidth: 2
      }
    },
    label: {
      visible: true,
      formatMethod: (text) => `${Number(text).toFixed(2)}万`,
      style: {
        fontSize: 12,
        fill: '#52c41a'
      }
    }
  }
};
```
