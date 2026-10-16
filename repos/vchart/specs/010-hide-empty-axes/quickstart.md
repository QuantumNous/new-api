# Quickstart: Hide Axes For Empty Series

## Overview

This feature adds an opt-in `hideWhenEmpty` flag for cartesian axes. When enabled, the axis hides if its bound series do not contribute any collected axis data. When data appears later, the axis shows again automatically.

## Usage

### 1. Hide a value axis when its series is empty

```ts
const spec = {
  type: 'line',
  data: [{ id: 'line', values: [] }],
  axes: [
    { orient: 'left', hideWhenEmpty: true },
    { orient: 'bottom', type: 'band' }
  ],
  series: [{ type: 'line', dataId: 'line', xField: 'x', yField: 'y' }]
};
```

Expected result:
- The left axis is hidden on first render because no axis data can be collected from the bound series.
- The bottom axis keeps its normal behavior unless it also enables `hideWhenEmpty`.

### 2. Mixed axes

```ts
const spec = {
  type: 'common',
  axes: [
    { id: 'left-empty', orient: 'left', hideWhenEmpty: true },
    { id: 'right-active', orient: 'right', hideWhenEmpty: true },
    { orient: 'bottom', type: 'band' }
  ]
};
```

Expected result:
- Only the axis whose bound series collect no data is hidden.
- Axes with collected bound-series data remain visible.

### 3. Runtime updates

```ts
vchart.updateData('line', [
  { x: 'Mon', y: 10 },
  { x: 'Tue', y: 20 }
]);
```

Expected result:
- A previously hidden axis with `hideWhenEmpty: true` becomes visible again after data update.
