## Core Type Structure

```typescript
interface ISelectSpec extends IBaseInteractionSpec {
  enable?: boolean; // Selection interaction toggle (default: true)
  mode?: 'single' | 'multiple'; // Selection mode (default: 'single')
  trigger?: Trigger; // Selection trigger events
  triggerOff?: Trigger | number; // Selection clear events or timeout
}
```

## Base Interaction Specification

```typescript
interface IBaseInteractionSpec {
  markIds?: StringOrNumber[]; // Target mark IDs for interaction
  markNames?: StringOrNumber[]; // Target mark names for interaction
}
```

## Trigger Event Configuration

```typescript
type Trigger = EventType | EventType[];

type EventType =
  // Pointer events
  | 'pointerdown'
  | 'pointerup'
  | 'pointerupoutside'
  | 'pointertap'
  | 'pointerover'
  | 'pointermove'
  | 'pointerenter'
  | 'pointerleave'
  | 'pointerout'

  // Mouse events
  | 'mousedown'
  | 'mouseup'
  | 'mouseupoutside'
  | 'rightdown'
  | 'rightup'
  | 'rightupoutside'
  | 'click'
  | 'dblclick'
  | 'mousemove'
  | 'mouseover'
  | 'mouseout'
  | 'mouseenter'
  | 'mouseleave'
  | 'wheel'

  // Touch events
  | 'touchstart'
  | 'touchend'
  | 'touchendoutside'
  | 'touchmove'
  | 'touchcancel'
  | 'tap'

  // Drag events
  | 'dragstart'
  | 'drag'
  | 'dragenter'
  | 'dragleave'
  | 'dragover'
  | 'dragend'
  | 'drop'

  // Gesture events
  | 'pan';
```

## Complete Interface Definition

```typescript
interface ISelectSpec {
  // Base interaction properties
  markIds?: StringOrNumber[]; // Specific mark IDs to target
  markNames?: StringOrNumber[]; // Specific mark names to target

  // Selection-specific properties
  enable?: boolean; // Enable/disable selection interaction (default: true)
  mode?: 'single' | 'multiple'; // Selection mode (default: 'single')
  trigger?: EventType | EventType[]; // Events that trigger selection
  triggerOff?: EventType | EventType[] | number; // Events that clear selection or timeout
}
```

## Property Descriptions

### Target Configuration

```typescript
markIds?: StringOrNumber[];     // Array of mark IDs that should respond to selection
markNames?: StringOrNumber[];   // Array of mark names that should respond to selection
```

### Interaction Control

```typescript
enable?: boolean;               // Controls whether selection interaction is active
                               // Default: true (selection is enabled by default)
```

### Selection Mode

```typescript
mode?: 'single' | 'multiple';  // Controls selection behavior
                               // 'single': Only one element can be selected at a time
                               // 'multiple': Multiple elements can be selected simultaneously
                               // Default: 'single'
```

### Event Configuration

```typescript
trigger?: EventType | EventType[];    // Events that activate selection state
                                      // Default: ['click']

triggerOff?: EventType | EventType[] | number;  // Events that clear selection or timeout
                                                // EventType: Specific events to clear selection
                                                // number: Timeout in milliseconds to auto-clear
                                                // Default: undefined (no auto-clear)
```

## Usage Examples

### Basic Selection Configuration

```typescript
// Enable selection with default settings (single mode, click trigger)
const basicSelection: ISelectSpec = {
  enable: true
};

// Disable selection interaction
const disabledSelection: ISelectSpec = {
  enable: false
};
```

### Selection Mode Configuration

```typescript
// Single selection mode (default)
const singleSelection: ISelectSpec = {
  enable: true,
  mode: 'single',
  trigger: 'click'
};

// Multiple selection mode
const multipleSelection: ISelectSpec = {
  enable: true,
  mode: 'multiple',
  trigger: 'click'
};
```

### Custom Trigger Events

```typescript
// Double-click to select
const doubleClickSelection: ISelectSpec = {
  enable: true,
  mode: 'single',
  trigger: 'dblclick',
  triggerOff: 'click'
};

// Multiple trigger events
const multiTriggerSelection: ISelectSpec = {
  enable: true,
  mode: 'multiple',
  trigger: ['click', 'tap'],
  triggerOff: ['dblclick', 'rightclick']
};
```

### Timeout-Based Clear

```typescript
// Auto-clear selection after 3 seconds
const timeoutSelection: ISelectSpec = {
  enable: true,
  mode: 'single',
  trigger: 'click',
  triggerOff: 3000 // 3000ms timeout
};

// Auto-clear with event fallback
const hybridClearSelection: ISelectSpec = {
  enable: true,
  mode: 'multiple',
  trigger: 'click',
  triggerOff: ['dblclick', 5000] // Clear on double-click or after 5 seconds
};
```

### Target-Specific Selection

```typescript
// Target specific mark IDs
const markIdSelection: ISelectSpec = {
  enable: true,
  mode: 'multiple',
  markIds: ['bar-series-0', 'bar-series-1'],
  trigger: 'click',
  triggerOff: 'rightclick'
};

// Target specific mark names
const markNameSelection: ISelectSpec = {
  enable: true,
  mode: 'single',
  markNames: ['point', 'symbol'],
  trigger: 'click'
};
```

### Touch-Optimized Selection

```typescript
// Touch device configuration
const touchSelection: ISelectSpec = {
  enable: true,
  mode: 'multiple',
  trigger: ['tap', 'touchstart'],
  triggerOff: ['touchend', 2000] // Clear on touch end or 2s timeout
};
```

### Chart Integration Examples

#### Bar Chart with Single Selection

```typescript
const barChart = {
  type: 'bar',
  data: { values: data },
  xField: 'category',
  yField: 'value',
  select: {
    enable: true,
    mode: 'single',
    trigger: 'click',
    triggerOff: 'dblclick'
  }
};
```

#### Scatter Plot with Multiple Selection

```typescript
const scatterChart = {
  type: 'scatter',
  data: { values: data },
  xField: 'x',
  yField: 'y',
  select: {
    enable: true,
    mode: 'multiple',
    markNames: ['point'],
    trigger: 'click',
    triggerOff: 3000 // Auto-clear after 3 seconds
  }
};
```

#### Series-Level Selection Configuration

```typescript
const multiSeriesChart = {
  type: 'line',
  data: { values: data },
  series: [
    {
      type: 'line',
      xField: 'x',
      yField: 'y1',
      select: {
        enable: true,
        mode: 'single',
        markIds: ['line-0'],
        trigger: 'click'
      }
    },
    {
      type: 'bar',
      xField: 'x',
      yField: 'y2',
      select: {
        enable: true,
        mode: 'multiple',
        markNames: ['bar'],
        trigger: 'click',
        triggerOff: 'rightclick'
      }
    }
  ]
};
```

#### Mobile-Friendly Configuration

```typescript
const mobileChart = {
  type: 'pie',
  data: { values: data },
  categoryField: 'category',
  valueField: 'value',
  select: {
    enable: true,
    mode: 'single',
    trigger: ['tap', 'touchstart'],
    triggerOff: 2000 // Auto-clear after 2 seconds
  }
};
```
