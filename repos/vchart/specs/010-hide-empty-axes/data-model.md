# Data Model: Hide Axes For Empty Series

## Entities

### Axis Visibility Spec

The public axis configuration entry that controls explicit visibility and optional auto-hide behavior.

| Field | Type | Description |
|-------|------|-------------|
| `visible` | `boolean` | Existing explicit axis visibility control. |
| `hideWhenEmpty` | `boolean` | New opt-in flag that hides the axis when no bound series data can be collected for the axis. |

### Axis Runtime Visibility State

The effective axis visibility derived from both explicit spec visibility and runtime data collection state.

| Field | Type | Description |
|-------|------|-------------|
| `specVisible` | `boolean` | Whether the user explicitly allows the axis to render. |
| `runtimeVisible` | `boolean` | Whether the axis should currently render after evaluating `hideWhenEmpty`. |
| `supportsRuntimeToggle` | `boolean` | Whether axis marks/tick data must stay available for future data-driven visibility changes. |

### Bound Series Collection Result

The aggregated result of axis-side collection from the series bound to a single axis.

| Field | Type | Description |
|-------|------|-------------|
| `seriesIndexes` | `number[]` | Bound series linked to the axis through spec info. |
| `collectedDataCount` | `number` | Number of collected axis statistics entries across bound series. |
| `isEmpty` | `boolean` | True when no bound series contributed collected axis data. |

## Validation Rules

- `hideWhenEmpty` is optional and defaults to disabled.
- If `visible === false`, the axis remains hidden regardless of `hideWhenEmpty`.
- If `hideWhenEmpty === true`, the axis is hidden only when the bound series collection result is empty.
- Visibility must be recalculated after data updates and spec updates that affect bound series or axis visibility.

## State Transitions

- **Initial Render**:
  - Input: axis spec + bound series collection result
  - Logic: `runtimeVisible = specVisible && (!hideWhenEmpty || collectedDataCount > 0)`
  - Output: axis renders or collapses from layout

- **Data Update**:
  - Input: updated series view statistics
  - Logic: recompute bound series collection result, then recompute `runtimeVisible`
  - Output: axis hides or reappears without chart remake

- **Spec Update**:
  - Input: changed `visible` or `hideWhenEmpty`
  - Logic: refresh runtime visibility and axis layout/render state
  - Output: axis reflects the updated visibility rules
