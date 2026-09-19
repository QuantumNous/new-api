## Overview
`IHoverSpec` defines the configuration interface for hover interactions in VChart. It extends the base interaction specification to provide detailed control over hover behavior, including target elements, trigger events, and interaction state management.

## Core Type Structure

```typescript
interface IHoverSpec extends IBaseInteractionSpec {
  enable?: boolean;        // Hover interaction toggle (default: true)
  trigger?: Trigger;       // Hover trigger events
  triggerOff?: Trigger;    // Hover end trigger events
}
```

## Base Interaction Specification

```typescript
interface IBaseInteractionSpec {
  markIds?: StringOrNumber[];     // Target mark IDs for interaction
  markNames?: StringOrNumber[];   // Target mark names for interaction
}
```

## Trigger Event Configuration

```typescript
type Trigger = EventType | EventType[];

type EventType = 
  // Pointer events
  | 'pointerdown' | 'pointerup' | 'pointerupoutside' | 'pointertap'
  | 'pointerover' | 'pointermove' | 'pointerenter' | 'pointerleave' | 'pointerout'
  
  // Mouse events
  | 'mousedown' | 'mouseup' | 'mouseupoutside' | 'rightdown' | 'rightup' | 'rightupoutside'
  | 'click' | 'dblclick' | 'mousemove' | 'mouseover' | 'mouseout'
  | 'mouseenter' | 'mouseleave' | 'wheel'
  
  // Touch events  
  | 'touchstart' | 'touchend' | 'touchendoutside' | 'touchmove' | 'touchcancel' | 'tap'
  
  // Drag events
  | 'dragstart' | 'drag' | 'dragenter' | 'dragleave' | 'dragover' | 'dragend' | 'drop'
  
  // Gesture events
  | 'pan';
```

## Complete Interface Definition

```typescript
interface IHoverSpec {
  // Base interaction properties
  markIds?: StringOrNumber[];     // Specific mark IDs to target
  markNames?: StringOrNumber[];   // Specific mark names to target
  
  // Hover-specific properties
  enable?: boolean;               // Enable/disable hover interaction (default: true)
  trigger?: EventType | EventType[];      // Events that trigger hover state
  triggerOff?: EventType | EventType[];   // Events that end hover state
}
```

## Property Descriptions

### Target Configuration
```typescript
markIds?: StringOrNumber[];     // Array of mark IDs that should respond to hover
markNames?: StringOrNumber[];   // Array of mark names that should respond to hover
```

### Interaction Control
```typescript
enable?: boolean;               // Controls whether hover interaction is active
                               // Default: true (hover is enabled by default)
```

### Event Configuration
```typescript
trigger?: EventType | EventType[];    // Events that activate hover state
                                      // Default: ['pointerover', 'mouseenter']

triggerOff?: EventType | EventType[];  // Events that deactivate hover state  
                                       // Default: ['pointerout', 'mouseleave']
```

## Usage Examples

### Basic Hover Configuration
```typescript
// Enable hover with default settings
const basicHover: IHoverSpec = {
  enable: true
};

// Disable hover interaction
const disabledHover: IHoverSpec = {
  enable: false
};
```

### Custom Trigger Events
```typescript
// Single trigger event
const clickHover: IHoverSpec = {
  enable: true,
  trigger: 'click',
  triggerOff: 'dblclick'
};

// Multiple trigger events
const multiTriggerHover: IHoverSpec = {
  enable: true,
  trigger: ['mouseenter', 'pointerover'],
  triggerOff: ['mouseleave', 'pointerout']
};
```

### Target-Specific Hover
```typescript
// Target specific mark IDs
const markIdHover: IHoverSpec = {
  enable: true,
  markIds: ['series-0', 'series-1'],
  trigger: 'mouseover',
  triggerOff: 'mouseout'
};

// Target specific mark names
const markNameHover: IHoverSpec = {
  enable: true,
  markNames: ['point', 'line'],
  trigger: 'mouseenter',
  triggerOff: 'mouseleave'
};
```

### Touch-Optimized Hover
```typescript
// Touch device configuration
const touchHover: IHoverSpec = {
  enable: true,
  trigger: ['touchstart', 'tap'],
  triggerOff: ['touchend', 'touchcancel']
};
```

### Advanced Event Configuration
```typescript
// Complex event handling
const advancedHover: IHoverSpec = {
  enable: true,
  markNames: ['bar', 'point'],
  trigger: ['pointerenter', 'mouseenter', 'touchstart'],
  triggerOff: ['pointerleave', 'mouseleave', 'touchend']
};
```

### Chart Integration Examples

#### Line Chart with Hover
```typescript
const lineChart = {
  type: 'line',
  data: { values: data },
  xField: 'x',
  yField: 'y',
  hover: {
    enable: true,
    markNames: ['point', 'line'],
    trigger: 'mouseover',
    triggerOff: 'mouseout'
  }
};
```

#### Bar Chart with Custom Hover
```typescript
const barChart = {
  type: 'bar', 
  data: { values: data },
  xField: 'category',
  yField: 'value',
  hover: {
    enable: true,
    markNames: ['bar'],
    trigger: ['mouseenter', 'pointerover'],
    triggerOff: ['mouseleave', 'pointerout']
  }
};
```

#### Series-Level Hover Configuration
```typescript
const seriesHover = {
  type: 'line',
  data: { values: data },
  series: [
    {
      type: 'line',
      xField: 'x',
      yField: 'y1',
      hover: {
        enable: true,
        markIds: ['line-series-0'],
        trigger: 'click'
      }
    },
    {
      type: 'line', 
      xField: 'x',
      yField: 'y2',
      hover: {
        enable: false  // Disable hover for this series
      }
    }
  ]
};
```

#### Mobile-Optimized Configuration
```typescript
const mobileChart = {
  type: 'scatter',
  data: { values: data },
  xField: 'x', 
  yField: 'y',
  hover: {
    enable: true,
    trigger: ['tap', 'touchstart'],
    triggerOff: ['touchend', 'touchcancel'],
    markNames: ['point']
  }
};
```

## Boolean Shorthand

```typescript
// Boolean configuration (simple enable/disable)
hover: true   // Equivalent to { enable: true } with default events
hover: false  // Equivalent to { enable: false }

// Detailed configuration
hover: {
  enable: true,
  trigger: 'mouseenter',
  triggerOff: 'mouseleave'
}
```

## Event Type Categories

### Mouse Events
- **mouseenter/mouseleave**: Most common for desktop hover
- **mouseover/mouseout**: Alternative mouse events
- **click/dblclick**: Click-based hover activation

### Pointer Events  
- **pointerenter/pointerleave**: Modern pointer API events
- **pointerover/pointerout**: Alternative pointer events

### Touch Events
- **touchstart/touchend**: Touch-based interactions
- **tap**: Simplified touch event

### Custom Events
- **dragstart/dragend**: Drag-based hover activation
- **wheel**: Scroll-based interactions

## Integration with State Styling

```typescript
// Configure hover state styling in marks
const chartWithHoverStyles = {
  type: 'bar',
  data: { values: data },
  hover: {
    enable: true,
    trigger: 'mouseenter',
    triggerOff: 'mouseleave'
  },
  // Hover state styling
  bar: {
    state: {
      hover: {
        fill: '#ff0000',        // Red fill on hover
        stroke: '#000000',      // Black border on hover
        strokeWidth: 2
      },
      hover_reverse: {
        fillOpacity: 0.3        // Dim non-hovered elements
      }
    }
  }
};
```
