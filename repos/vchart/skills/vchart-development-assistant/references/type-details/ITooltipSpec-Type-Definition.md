## Core Interface Structure

```typescript
interface ITooltipSpec
  extends Partial<
    ITooltipActiveTypeAsKeys<ITooltipPattern & { checkOverlap?: boolean }, ITooltipPattern, IGroupTooltipPattern>
  > {
  visible?: boolean; // Tooltip visibility
  activeType?: TooltipActiveType | TooltipActiveType[]; // Supported activation types
  trigger?: TooltipTrigger; // Trigger configuration
  triggerOff?: TooltipTriggerOff; // Hide trigger configuration
  showDelay?: number; // Show delay for enterable tooltips
  hideTimer?: number; // Hide timer duration
  lockAfterClick?: boolean; // Lock tooltip after click
  style?: ITooltipTheme; // Tooltip styling
  handler?: Partial<ITooltipHandlerSpec>; // Custom handler methods
  renderMode?: 'html' | 'canvas'; // Rendering mode
  confine?: boolean; // Confine to canvas area
  className?: string; // CSS class name (HTML mode)
  parentElement?: string | HTMLElement | HTMLCanvasElement; // Mount point
  enterable?: boolean; // Allow mouse enter tooltip
  transitionDuration?: number; // Animation duration
  throttleInterval?: number; // Update throttle interval
  updateElement?: UpdateElementFunction; // Custom DOM update function
  offset?: { x?: number; y?: number }; // Position offset
}
```

## Active Type Configuration

```typescript
interface ITooltipActiveTypeAsKeys<T, K, U> {
  mark?: T; // Mark tooltip configuration
  dimension?: K; // Dimension tooltip configuration
  group?: U; // Group tooltip configuration
}
```

## Tooltip Pattern Configuration

```typescript
interface ITooltipPattern extends ITooltipShapePattern {
  visible?: TooltipPatternProperty<boolean>; // Pattern visibility
  title?: TooltipPatternProperty<ITooltipLinePattern>; // Title configuration
  content?: MaybeArray<TooltipPatternProperty<MaybeArray<ITooltipLinePattern>>>; // Content lines
  position?: TooltipPatternProperty<TooltipPosition>; // Position configuration
  positionMode?: TooltipPatternProperty<TooltipPositionMode>; // Position mode
  updateTitle?: TooltipUpdateCallback<ITooltipLineActual>; // Custom title updater
  updateContent?: TooltipUpdateCallback<ITooltipLineActual[]>; // Custom content updater
  updatePosition?: TooltipUpdateCallback<ITooltipPositionActual>; // Custom position updater
  maxLineCount?: number; // Maximum content lines
  othersLine?: ITooltipLineActual; // "Others" line configuration
}
```

## Group Tooltip Pattern

```typescript
interface IGroupTooltipPattern extends ITooltipPattern {
  triggerMark?: MaybeArray<GroupTooltipTriggerMark>; // Trigger mark types
}

type GroupTooltipTriggerMark = 'line' | 'area' | 'point' | 'bar';
```

## Tooltip Shape Pattern

```typescript
interface ITooltipShapePattern {
  hasShape?: TooltipPatternProperty<boolean>; // Show shape indicator
  shapeType?: TooltipPatternProperty<string>; // Shape type
  shapeColor?: TooltipPatternProperty<string>; // Shape color
  shapeFill?: TooltipPatternProperty<string>; // Shape fill color
  shapeStroke?: TooltipPatternProperty<string>; // Shape stroke color
  shapeHollow?: TooltipPatternProperty<boolean>; // Hollow shape
  shapeLineWidth?: TooltipPatternProperty<number>; // Shape line width
  shapeSize?: TooltipPatternProperty<number>; // Shape size
}
```

## Trigger Configuration

```typescript
type TooltipTrigger = MaybeArray<'hover' | 'click' | CustomTrigger> | 'none';

type TooltipTriggerOff = MaybeArray<'hover' | 'click' | CustomTriggerOff> | 'none';

interface CustomTrigger {
  eventType: EventType; // Event type
  source?: EventSourceType; // Event source
  consume?: boolean; // Consume event
}

interface CustomTriggerOff extends CustomTrigger {
  checkOutside?: boolean; // Check outside click
}
```

## Supporting Type Definitions

### Active Types

```typescript
type TooltipActiveType = 'mark' | 'dimension' | 'group';
```

### Tooltip Handler

```typescript
interface ITooltipHandlerSpec {
  showTooltip: (
    activeType: TooltipActiveType,
    tooltipData: TooltipData,
    params: TooltipHandlerParams
  ) => Maybe<TooltipResult>;
  hideTooltip: (params: TooltipHandlerParams) => Maybe<TooltipResult>;
  release: () => void;
  isTooltipShown?: () => boolean;
}
```

### Tooltip Line Pattern

```typescript
interface ITooltipLinePattern {
  key?: TooltipPatternProperty<string>; // Line key
  value?: TooltipPatternProperty<string>; // Line value
  hasShape?: TooltipPatternProperty<boolean>; // Show shape
  shapeType?: TooltipPatternProperty<string>; // Shape type
  shapeColor?: TooltipPatternProperty<string>; // Shape color
  // ... other shape properties
}
```

## Complete Interface Definition

```typescript
interface ITooltipSpec {
  // Basic configuration
  visible?: boolean;
  activeType?: 'mark' | 'dimension' | 'group' | ('mark' | 'dimension' | 'group')[];

  // Trigger configuration
  trigger?:
    | 'hover'
    | 'click'
    | 'none'
    | ('hover' | 'click')[]
    | {
        eventType: EventType;
        source?: EventSourceType;
        consume?: boolean;
      }
    | {
        eventType: EventType;
        source?: EventSourceType;
        consume?: boolean;
      }[];

  triggerOff?:
    | 'hover'
    | 'click'
    | 'none'
    | ('hover' | 'click')[]
    | {
        eventType: EventType;
        source?: EventSourceType;
        consume?: boolean;
        checkOutside?: boolean;
      }
    | {
        eventType: EventType;
        source?: EventSourceType;
        consume?: boolean;
        checkOutside?: boolean;
      }[];

  // Timing configuration
  showDelay?: number;
  hideTimer?: number;
  lockAfterClick?: boolean;

  // Rendering configuration
  renderMode?: 'html' | 'canvas';
  confine?: boolean;
  className?: string;
  parentElement?: string | HTMLElement | HTMLCanvasElement;
  enterable?: boolean;
  transitionDuration?: number;
  throttleInterval?: number;

  // Position configuration
  offset?: {
    x?: number;
    y?: number;
  };

  // Styling configuration
  style?: {
    panel?: {
      padding?: number | number[];
      backgroundColor?: string;
      border?: {
        color?: string;
        width?: number;
        radius?: number;
      };
      shadow?: {
        x?: number;
        y?: number;
        blur?: number;
        spread?: number;
        color?: string;
      };
    };
    titleLabel?: {
      fontSize?: number;
      fontFamily?: string;
      fontWeight?: string | number;
      fill?: string;
      textAlign?: string;
      lineHeight?: number | string;
    };
    keyLabel?: {
      fontSize?: number;
      fontFamily?: string;
      fontWeight?: string | number;
      fill?: string;
      textAlign?: string;
      lineHeight?: number | string;
    };
    valueLabel?: {
      fontSize?: number;
      fontFamily?: string;
      fontWeight?: string | number;
      fill?: string;
      textAlign?: string;
      lineHeight?: number | string;
    };
    shape?: {
      size?: number;
      spacing?: number;
    };
  };

  // Mark tooltip specific
  mark?: {
    visible?: boolean | ((data: any) => boolean);
    checkOverlap?: boolean;
    title?: {
      key?: string | ((data: any) => string);
      value?: string | ((data: any) => string);
    };
    content?: {
      key?: string | ((data: any) => string);
      value?: string | ((data: any) => string);
      hasShape?: boolean | ((data: any) => boolean);
      shapeType?: string | ((data: any) => string);
      shapeColor?: string | ((data: any) => string);
    }[];
    position?: string | ((data: any) => { x: number; y: number });
    updateTitle?: (prev: any, data: any, params: any) => any;
    updateContent?: (prev: any[], data: any, params: any) => any[];
    updatePosition?: (prev: any, data: any, params: any) => any;
  };

  // Dimension tooltip specific
  dimension?: {
    visible?: boolean | ((data: any) => boolean);
    title?: {
      key?: string | ((data: any) => string);
      value?: string | ((data: any) => string);
    };
    content?: {
      key?: string | ((data: any) => string);
      value?: string | ((data: any) => string);
      hasShape?: boolean | ((data: any) => boolean);
      shapeType?: string | ((data: any) => string);
      shapeColor?: string | ((data: any) => string);
    }[];
    position?: string | ((data: any) => { x: number; y: number });
    updateTitle?: (prev: any, data: any, params: any) => any;
    updateContent?: (prev: any[], data: any, params: any) => any[];
    updatePosition?: (prev: any, data: any, params: any) => any;
  };

  // Group tooltip specific
  group?: {
    visible?: boolean | ((data: any) => boolean);
    triggerMark?: 'line' | 'area' | 'point' | 'bar' | ('line' | 'area' | 'point' | 'bar')[];
    title?: {
      key?: string | ((data: any) => string);
      value?: string | ((data: any) => string);
    };
    content?: {
      key?: string | ((data: any) => string);
      value?: string | ((data: any) => string);
      hasShape?: boolean | ((data: any) => boolean);
      shapeType?: string | ((data: any) => string);
      shapeColor?: string | ((data: any) => string);
    }[];
    position?: string | ((data: any) => { x: number; y: number });
    updateTitle?: (prev: any, data: any, params: any) => any;
    updateContent?: (prev: any[], data: any, params: any) => any[];
    updatePosition?: (prev: any, data: any, params: any) => any;
  };

  // Custom handler
  handler?: {
    showTooltip?: (activeType: 'mark' | 'dimension' | 'group', tooltipData: any, params: any) => number;
    hideTooltip?: (params: any) => number;
    release?: () => void;
    isTooltipShown?: () => boolean;
  };

  // Custom DOM update function (HTML mode only)
  updateElement?: (tooltipElement: HTMLElement, actualTooltip: any, params: any) => void;
}
```

## Usage Examples

### Basic Tooltip Configuration

```typescript
const basicTooltip: ITooltipSpec = {
  visible: true,
  activeType: ['mark', 'dimension'],
  trigger: 'hover'
};
```

### Mark Tooltip with Custom Content

```typescript
const markTooltip: ITooltipSpec = {
  visible: true,
  activeType: 'mark',
  trigger: 'hover',
  mark: {
    visible: true,
    title: {
      key: 'Category',
      value: data => data.category
    },
    content: [
      {
        key: 'Value',
        value: data => `${data.value}`,
        hasShape: true,
        shapeColor: data => data.color
      }
    ]
  }
};
```

### Dimension Tooltip for Time Series

```typescript
const dimensionTooltip: ITooltipSpec = {
  visible: true,
  activeType: 'dimension',
  trigger: 'hover',
  dimension: {
    title: {
      key: 'Date',
      value: data => data.date
    },
    content: [
      {
        key: 'Sales',
        value: data => `$${data.sales.toLocaleString()}`,
        hasShape: true,
        shapeType: 'rect'
      },
      {
        key: 'Profit',
        value: data => `$${data.profit.toLocaleString()}`,
        hasShape: true,
        shapeType: 'rect'
      }
    ]
  }
};
```

### Group Tooltip for Line Chart

```typescript
const groupTooltip: ITooltipSpec = {
  visible: true,
  activeType: 'group',
  trigger: 'hover',
  group: {
    visible: true,
    triggerMark: ['line', 'point'],
    title: {
      key: 'Date',
      value: data => data.date
    },
    content: [
      {
        key: data => data.seriesName,
        value: data => `${data.value}`,
        hasShape: true,
        shapeColor: data => data.seriesColor
      }
    ]
  }
};
```

### Styled Tooltip with Custom Appearance

```typescript
const styledTooltip: ITooltipSpec = {
  visible: true,
  activeType: 'mark',
  trigger: 'hover',
  style: {
    panel: {
      padding: [8, 12],
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      border: {
        color: '#333',
        width: 1,
        radius: 4
      },
      shadow: {
        x: 2,
        y: 2,
        blur: 8,
        color: 'rgba(0, 0, 0, 0.2)'
      }
    },
    titleLabel: {
      fontSize: 14,
      fontWeight: 'bold',
      fill: '#fff'
    },
    keyLabel: {
      fontSize: 12,
      fill: '#ccc'
    },
    valueLabel: {
      fontSize: 12,
      fontWeight: 'bold',
      fill: '#fff'
    }
  }
};
```

### Custom Trigger Configuration

```typescript
const customTriggerTooltip: ITooltipSpec = {
  visible: true,
  activeType: 'mark',
  trigger: [
    'hover',
    {
      eventType: 'pointerdown',
      source: 'chart',
      consume: false
    }
  ],
  triggerOff: [
    {
      eventType: 'pointerup',
      checkOutside: true
    }
  ],
  lockAfterClick: true
};
```

### HTML Tooltip with Custom Element

```typescript
const htmlTooltip: ITooltipSpec = {
  visible: true,
  renderMode: 'html',
  className: 'custom-tooltip',
  enterable: true,
  transitionDuration: 200,
  updateElement: (tooltipElement, actualTooltip, params) => {
    tooltipElement.innerHTML = `
      <div class="tooltip-header">${actualTooltip.title?.value}</div>
      <div class="tooltip-content">
        ${actualTooltip.content
          ?.map(
            item =>
              `<div class="tooltip-line">
            <span class="key">${item.key}</span>
            <span class="value">${item.value}</span>
          </div>`
          )
          .join('')}
      </div>
    `;
  }
};
```

### Canvas Tooltip with Positioning

```typescript
const canvasTooltip: ITooltipSpec = {
  visible: true,
  renderMode: 'canvas',
  confine: true,
  offset: { x: 10, y: 10 },
  activeType: 'dimension',
  dimension: {
    position: 'tl',
    positionMode: 'mark'
  }
};
```

## Chart Integration Examples

### Bar Chart with Mark Tooltip

```typescript
const barChart = {
  type: 'bar',
  data: { values: data },
  xField: 'category',
  yField: 'value',
  tooltip: {
    visible: true,
    activeType: 'mark',
    mark: {
      title: {
        key: 'Category',
        value: data => data.category
      },
      content: [
        {
          key: 'Value',
          value: data => data.value.toLocaleString()
        }
      ]
    }
  }
};
```

### Line Chart with Dimension Tooltip

```typescript
const lineChart = {
  type: 'line',
  data: { values: data },
  xField: 'date',
  yField: 'value',
  seriesField: 'series',
  tooltip: {
    visible: true,
    activeType: 'dimension',
    dimension: {
      title: {
        key: 'Date',
        value: data => data.date
      }
    }
  }
};
```

### Multi-Series Chart with Group Tooltip

```typescript
const multiSeriesChart = {
  type: 'line',
  data: { values: data },
  xField: 'month',
  yField: 'sales',
  seriesField: 'region',
  tooltip: {
    visible: true,
    activeType: 'group',
    group: {
      triggerMark: 'line',
      title: {
        value: data => `Sales for ${data.month}`
      }
    }
  }
};
```
