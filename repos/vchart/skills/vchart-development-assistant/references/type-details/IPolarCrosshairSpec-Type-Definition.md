## IPolarCrosshairSpec Type Definition

### Core Interface

`IPolarCrosshairSpec` defines the configuration interface for crosshair components in polar coordinate systems, extending common crosshair functionality with polar-specific field configurations for category and value axes.

```typescript
interface IPolarCrosshairSpec extends ICommonCrosshairSpec {
  categoryField?: ICrosshairCategoryFieldSpec;
  valueField?: ICrosshairValueFieldSpec;
}
```

### Type Structure

#### Common Crosshair Properties

```typescript
interface ICommonCrosshairSpec extends IComponentSpec {
  followTooltip?: boolean | Partial<ITooltipActiveTypeAsKeys<boolean, boolean, boolean>>;
  trigger?: CrossHairTrigger;
  triggerOff?: CrossHairTrigger | 'none' | number;
  lockAfterClick?: boolean;
  labelZIndex?: number;
  gridZIndex?: number;
}

// Supporting types for common properties
type CrossHairTrigger = 'click' | 'hover' | ['click', 'hover'];

interface ITooltipActiveTypeAsKeys<T, K, U> {
  mark?: T; // Mark tooltip configuration
  dimension?: K; // Dimension tooltip configuration
  group?: U; // Group tooltip configuration
}
```

#### Polar Field Specifications

```typescript
// Category field configuration for polar coordinates
interface ICrosshairCategoryFieldSpec extends ICrosshairDataBindSpec {
  visible: boolean; // Required visibility
  line?: ICrosshairLineSpec | Omit<ICrosshairRectSpec, 'width'>; // Line or rect graphics
  label?: ICrosshairLabelSpec; // Label configuration
}

// Value field configuration for polar coordinates
interface ICrosshairValueFieldSpec extends ICrosshairDataBindSpec {
  visible: boolean; // Required visibility
  line?: ICrosshairLineSpec; // Line graphics only
  label?: ICrosshairLabelSpec; // Label configuration
}
```

### Field Configuration Types

#### Data Binding Specification

```typescript
interface ICrosshairDataBindSpec {
  bindingAxesIndex?: number[]; // Bound axis indices
  defaultSelect?: {
    axisIndex: number; // Target axis index
    datum: StringOrNumber; // Default selected data
  };
}
```

#### Line Graphics Configuration

```typescript
interface ICrosshairLineSpec {
  visible?: boolean; // Show/hide line
  type?: 'line'; // Graphics type (literal)
  width?: number; // Line width (default: 2)
  smooth?: boolean; // Smooth curve in polar coordinates
  style?: ICrosshairLineStyle; // Line visual styles
}

// Line style properties
type ICrosshairLineStyle = Pick<ILineMarkSpec, 'stroke' | 'strokeOpacity' | 'opacity' | 'lineDash' | 'lineWidth'>;
```

#### Rectangle Graphics Configuration

```typescript
interface ICrosshairRectSpec {
  visible?: boolean; // Show/hide rectangle
  type?: 'rect'; // Graphics type (literal)
  width?: number | string | ICrosshairRectWidthCallback; // Width configuration
  style?: ICrosshairRectStyle; // Rectangle visual styles
}

// Rectangle style properties (extends line styles)
type ICrosshairRectStyle = ICrosshairLineStyle & Pick<IRectMarkSpec, 'fill' | 'fillOpacity' | 'cornerRadius'>;

// Dynamic width calculation callback
type ICrosshairRectWidthCallback = (axisSize: { width: number; height: number }, axis: IAxis) => number;
```

#### Label Configuration

```typescript
interface ICrosshairLabelSpec {
  visible?: boolean; // Show/hide labels
  formatMethod?: (text: StringOrNumber | string[]) => string | string[]; // Format function
  formatter?: string | string[]; // Format template
  style?: Partial<ITextMarkSpec>; // Text styles
  labelBackground?: ICrosshairLabelBackgroundSpec; // Background config
  syncAxisLabelAngle?: boolean; // Angle sync (Cartesian only)
}

// Label background configuration
interface ICrosshairLabelBackgroundSpec {
  visible?: boolean; // Show background (default: true)
  minWidth?: number; // Minimum width (default: 30)
  maxWidth?: number; // Maximum width (auto-ellipsis)
  padding?: IPadding | number | number[]; // Internal padding
  style?: Partial<IRectMarkSpec>; // Background visual styles
}
```

### Tooltip Integration

#### Follow Tooltip Configuration

```typescript
// Boolean mode: simple sync with tooltip
const simpleSync: IPolarCrosshairSpec = {
  followTooltip: true // Show crosshair when any tooltip appears
};

// Granular control mode: selective tooltip sync
const selectiveSync: IPolarCrosshairSpec = {
  followTooltip: {
    mark: true, // Show crosshair with mark tooltip
    dimension: false, // Hide crosshair with dimension tooltip
    group: true // Show crosshair with group tooltip
  }
};

// Disabled mode: independent operation
const independentMode: IPolarCrosshairSpec = {
  followTooltip: false // Crosshair operates independently
};
```

#### Tooltip Type Mapping

```typescript
// Tooltip active type configuration
interface ITooltipActiveTypeAsKeys<T, K, U> {
  mark?: T; // Mark-based tooltip (specific data points)
  dimension?: K; // Dimension-based tooltip (axis-aligned data)
  group?: U; // Group-based tooltip (series/category data)
}

// Usage in crosshair configuration
const tooltipIntegration: IPolarCrosshairSpec = {
  followTooltip: {
    mark: true, // Follow mark tooltips
    dimension: true, // Follow dimension tooltips
    group: false // Ignore group tooltips
  }
};
```

### Trigger Configuration

#### Trigger Types

```typescript
// Single trigger modes
const hoverOnly: IPolarCrosshairSpec = {
  trigger: 'hover' // Default behavior
};

const clickOnly: IPolarCrosshairSpec = {
  trigger: 'click' // Click to show/update
};

// Multiple trigger modes
const multiTrigger: IPolarCrosshairSpec = {
  trigger: ['click', 'hover'] // Both click and hover
};
```

#### Trigger Control

```typescript
// Auto-hide configuration
const autoHide: IPolarCrosshairSpec = {
  trigger: 'hover',
  triggerOff: 'hover' // Hide on hover out
};

// Manual control
const manualControl: IPolarCrosshairSpec = {
  trigger: 'click',
  triggerOff: 'none', // Never auto-hide
  lockAfterClick: true // Lock position after click
};

// Delayed hide
const delayedHide: IPolarCrosshairSpec = {
  trigger: 'hover',
  triggerOff: 1000 // Hide after 1000ms
};
```

### Polar Field Configuration

#### Category Field Setup

```typescript
// Basic category field crosshair
const categoryField: IPolarCrosshairSpec = {
  categoryField: {
    visible: true,
    line: {
      visible: true,
      type: 'line',
      width: 2,
      smooth: true, // Smooth curve in polar coordinates
      style: {
        stroke: '#666',
        strokeOpacity: 0.8,
        lineDash: [4, 4]
      }
    },
    label: {
      visible: true,
      formatMethod: text => `Category: ${text}`,
      style: {
        fontSize: 12,
        fill: '#333'
      }
    }
  }
};
```

#### Value Field Setup

```typescript
// Basic value field crosshair
const valueField: IPolarCrosshairSpec = {
  valueField: {
    visible: true,
    line: {
      visible: true,
      width: 1,
      style: {
        stroke: '#999',
        strokeOpacity: 0.6
      }
    },
    label: {
      visible: true,
      formatter: '{value:.2f}',
      labelBackground: {
        visible: true,
        padding: [4, 8],
        style: {
          fill: 'rgba(0,0,0,0.8)',
          cornerRadius: 4
        }
      }
    }
  }
};
```

#### Combined Configuration

```typescript
// Complete polar crosshair setup
const polarCrosshair: IPolarCrosshairSpec = {
  // Common properties
  trigger: 'hover',
  followTooltip: true,
  labelZIndex: 1000,
  gridZIndex: 50,

  // Category field (angular)
  categoryField: {
    visible: true,
    bindingAxesIndex: [0], // Bind to first angular axis
    line: {
      visible: true,
      smooth: true,
      style: {
        stroke: '#3366cc',
        strokeOpacity: 0.7,
        lineWidth: 2
      }
    },
    label: {
      visible: true,
      formatMethod: text => `${text}`,
      style: {
        fontSize: 11,
        fill: '#333',
        fontWeight: 'bold'
      }
    }
  },

  // Value field (radial)
  valueField: {
    visible: true,
    bindingAxesIndex: [1], // Bind to first radial axis
    line: {
      visible: true,
      style: {
        stroke: '#dc3912',
        strokeOpacity: 0.6,
        lineDash: [2, 2]
      }
    },
    label: {
      visible: true,
      formatter: '{value:.1f}',
      labelBackground: {
        visible: true,
        minWidth: 40,
        padding: 6,
        style: {
          fill: 'rgba(220, 57, 18, 0.9)',
          cornerRadius: 3
        }
      }
    }
  }
};
```

### Axis Binding

#### Single Axis Binding

```typescript
// Bind to specific axis by index
const singleAxisBinding: IPolarCrosshairSpec = {
  categoryField: {
    visible: true,
    bindingAxesIndex: [0], // Only bind to first category axis
    line: { visible: true }
  }
};
```

#### Multiple Axes Binding

```typescript
// Bind to multiple axes
const multiAxisBinding: IPolarCrosshairSpec = {
  valueField: {
    visible: true,
    bindingAxesIndex: [0, 1], // Bind to first and second value axes
    line: { visible: true }
  }
};
```

#### Default Selection

```typescript
// Initialize with default position
const defaultSelection: IPolarCrosshairSpec = {
  categoryField: {
    visible: true,
    defaultSelect: {
      axisIndex: 0,
      datum: 'Q1' // Default to Q1 category
    },
    line: { visible: true }
  },
  valueField: {
    visible: true,
    defaultSelect: {
      axisIndex: 1,
      datum: 75 // Default to value 75
    }
  }
};
```
