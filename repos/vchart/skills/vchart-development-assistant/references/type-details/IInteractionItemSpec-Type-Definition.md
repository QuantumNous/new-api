## Overview

`IInteractionItemSpec` is a union type for VChart interaction configurations, supporting 9 different interaction types:

```typescript
export type IInteractionItemSpec =
  | IElementActiveSpec // Element activation
  | IElementSelectSpec // Element selection
  | IElementHighlightSpec // Element highlighting
  | IElementHighlightByKeySpec // Key-based highlighting
  | IElementHighlightByGroup // Group-based highlighting
  | IElementActiveByLegend // Legend-based activation
  | IElementHighlightByLegend // Legend-based highlighting
  | IElementHighlightByName // Name-based highlighting
  | ICustomInteraction; // Custom interaction
```

## Base Structure

All interaction types extend `IBaseInteractionSpec`:

```typescript
interface IBaseInteractionSpec {
  /** Target mark IDs for interaction */
  markIds?: StringOrNumber[];

  /** Target mark names for interaction */
  markNames?: StringOrNumber[];
}

type Trigger = EventType | EventType[];
```

## Interaction Type Configurations

### 1. Element Active (IElementActiveSpec)

Activates element state, supports `state.active` visual encoding:

```typescript
type IElementActiveSpec = IBaseInteractionSpec & {
  /** Interaction type identifier */
  type: 'element-active';

  /** Trigger events */
  trigger?: Trigger;

  /** Trigger off events */
  triggerOff?: Trigger;

  /** Active state configuration */
  state?: string;
};
```

### 2. Element Select (IElementSelectSpec)

Element selection interaction, supports `state.selected` and `state.selected_reverse`:

```typescript
type IElementSelectSpec = IBaseInteractionSpec & {
  /** Interaction type identifier */
  type: 'element-select';

  /** Trigger events */
  trigger?: Trigger;

  /** Trigger off events */
  triggerOff?: Trigger;

  /** Selected state configuration */
  state?: string;

  /** Multiple selection support */
  isMultiple?: boolean;

  /** Reverse state configuration */
  reverseState?: string;
};
```

### 3. Element Highlight (IElementHighlightSpec)

Element highlighting interaction, supports `state.highlight` and `state.blur`:

```typescript
type IElementHighlightSpec = IBaseInteractionSpec & {
  /** Interaction type identifier */
  type: 'element-highlight';

  /** Trigger events */
  trigger?: Trigger;

  /** Trigger off events */
  triggerOff?: Trigger;

  /** Highlight state configuration */
  highlightState?: string;

  /** Blur state configuration */
  blurState?: string;
};
```

### 4. Element Highlight By Key (IElementHighlightByKeySpec)

Highlights elements with same key, requires series `dataKey` configuration:

```typescript
type IElementHighlightByKeySpec = IBaseInteractionSpec & {
  /** Interaction type identifier */
  type: 'element-highlight-by-key';

  /** Trigger events */
  trigger?: Trigger;

  /** Trigger off events */
  triggerOff?: Trigger;

  /** Highlight state configuration */
  highlightState?: string;

  /** Blur state configuration */
  blurState?: string;
};
```

### 5. Element Highlight By Group (IElementHighlightByGroup)

Highlights elements with same group value (groupKey):

```typescript
type IElementHighlightByGroup = IBaseInteractionSpec & {
  /** Interaction type identifier */
  type: 'element-highlight-by-group';

  /** Trigger events */
  trigger?: Trigger;

  /** Trigger off events */
  triggerOff?: Trigger;

  /** Highlight state configuration */
  highlightState?: string;

  /** Blur state configuration */
  blurState?: string;
};
```

### 6. Element Active By Legend (IElementActiveByLegend)

Activates elements based on legend interaction, default triggers: `legendItemHover`/`legendItemUnHover`:

```typescript
type IElementActiveByLegend = IBaseInteractionSpec & {
  /** Interaction type identifier */
  type: 'element-active-by-legend';

  /** Filter type configuration */
  filterType?: string;

  /** Active state configuration */
  state?: string;
};
```

### 7. Element Highlight By Legend (IElementHighlightByLegend)

Highlights elements based on legend interaction, default triggers: `legendItemHover`/`legendItemUnHover`:

```typescript
type IElementHighlightByLegend = IBaseInteractionSpec & {
  /** Interaction type identifier */
  type: 'element-highlight-by-legend';

  /** Filter type configuration */
  filterType?: string;

  /** Highlight state configuration */
  highlightState?: string;

  /** Blur state configuration */
  blurState?: string;
};
```

### 8. Element Highlight By Name (IElementHighlightByName)

Highlights elements based on graphic name:

```typescript
type IElementHighlightByName = IBaseInteractionSpec & {
  /** Interaction type identifier */
  type: 'element-highlight-by-name';

  /** Highlight state configuration */
  highlightState?: string;

  /** Blur state configuration */
  blurState?: string;

  /** Target graphic name */
  graphicName?: string;

  /** Data parsing function */
  parseData?: Function;
};
```

### 9. Custom Interaction (ICustomInteraction)

Custom interaction type for extended functionality:

```typescript
interface ICustomInteraction extends IBaseInteractionSpec {
  /** Custom interaction type string */
  type: string;
}
```

## Core Sub-configurations

### Hover Interaction (IHoverSpec)

```typescript
interface IHoverSpec extends IBaseInteractionSpec {
  /** Enable hover interaction @default true */
  enable?: boolean;

  /** Hover trigger events */
  trigger?: Trigger;

  /** Hover trigger off events */
  triggerOff?: Trigger;
}
```

### Select Interaction (ISelectSpec)

```typescript
interface ISelectSpec extends IBaseInteractionSpec {
  /** Enable select interaction @default true */
  enable?: boolean;

  /** Selection mode @default 'single' */
  mode?: 'single' | 'multiple';

  /** Select trigger events */
  trigger?: Trigger;

  /** Select trigger off events */
  triggerOff?: Trigger | number;
}
```

### Main Interaction Configuration (IInteractionSpec)

```typescript
interface IInteractionSpec {
  /** Hover interaction configuration */
  hover?: IHoverSpec | boolean;

  /** Select interaction configuration */
  select?: ISelectSpec | boolean;

  /** Custom interaction configurations */
  interactions?: IInteractionItemSpec[];
}
```

## Dependency Type Definitions

### Event Types

```typescript
// Event types from VChart event system
type EventType = string; // Specific event type strings like 'click', 'hover', etc.
```

### Basic Types

```typescript
type StringOrNumber = string | number;
```

### Interaction Options (from trigger module)

```typescript
interface IElementActiveOptions {
  trigger?: Trigger;
  triggerOff?: Trigger;
  state?: string;
}

interface IElementSelectOptions {
  trigger?: Trigger;
  triggerOff?: Trigger;
  state?: string;
  isMultiple?: boolean;
  reverseState?: string;
}

interface IElementHighlightOptions {
  trigger?: Trigger;
  triggerOff?: Trigger;
  highlightState?: string;
  blurState?: string;
}

interface IElementActiveByLegendOptions {
  filterType?: string;
  state?: string;
}

interface IElementHighlightByLegendOptions {
  filterType?: string;
  highlightState?: string;
  blurState?: string;
}

interface IElementHighlightByNameOptions {
  highlightState?: string;
  blurState?: string;
  graphicName?: string;
  parseData?: Function;
}
```

## Usage Examples

### Element Active Interaction

```typescript
const activeInteraction: IElementActiveSpec = {
  type: 'element-active',
  markIds: ['point-mark'],
  trigger: 'pointerover',
  triggerOff: 'pointerout',
  state: 'active'
};
```

### Element Select Interaction

```typescript
const selectInteraction: IElementSelectSpec = {
  type: 'element-select',
  markNames: ['bar'],
  trigger: 'click',
  triggerOff: 'click',
  state: 'selected',
  isMultiple: true,
  reverseState: 'unselected'
};
```

### Element Highlight Interaction

```typescript
const highlightInteraction: IElementHighlightSpec = {
  type: 'element-highlight',
  markIds: ['line-mark', 'point-mark'],
  trigger: ['pointerover', 'focus'],
  triggerOff: ['pointerout', 'blur'],
  highlightState: 'highlight',
  blurState: 'blur'
};
```

### Key-based Highlighting

```typescript
const keyHighlight: IElementHighlightByKeySpec = {
  type: 'element-highlight-by-key',
  markNames: ['series-mark'],
  trigger: 'pointerover',
  triggerOff: 'pointerout',
  highlightState: 'active',
  blurState: 'inactive'
};
```

### Legend-based Activation

```typescript
const legendActive: IElementActiveByLegend = {
  type: 'element-active-by-legend',
  markIds: ['series-1', 'series-2'],
  filterType: 'index',
  state: 'legendActive'
};
```

### Complete Interaction Configuration

```typescript
const interactionConfig: IInteractionSpec = {
  hover: {
    enable: true,
    trigger: 'pointerover',
    triggerOff: 'pointerout',
    markNames: ['bar']
  },
  select: {
    enable: true,
    mode: 'multiple',
    trigger: 'click',
    triggerOff: 500 // Auto deselect after 500ms
  },
  interactions: [
    {
      type: 'element-highlight',
      markIds: ['line'],
      trigger: 'pointerover',
      highlightState: 'highlight',
      blurState: 'blur'
    },
    {
      type: 'element-active-by-legend',
      markNames: ['series'],
      filterType: 'datum',
      state: 'legendHover'
    }
  ]
};
```
