# Data Model: Scrollbar Fixed Step & Min Height

## Entities

### IScrollBarSpec

The configuration object for the Scrollbar component.

| Field | Type | Description |
|-------|------|-------------|
| `scrollStep` | `number` | **(New)** The fixed scrolling step in pixels for wheel events. If specified, overrides default percentage-based scrolling. |
| `minSliderSize` | `number` | **(New)** The minimum size (height for vertical, width for horizontal) of the slider in pixels. |

## Validation Rules

- `scrollStep`: Must be > 0. If > total scrollable area, should clamp.
- `minSliderSize`: Must be > 0. If > track size, should clamp to track size (or handle gracefully).

## State Transitions

- **Wheel Event**:
  - Input: `WheelEvent` (deltaX/Y)
  - Logic:
    - If `scrollStep` is set: `delta = sign(event.delta) * scrollStep`.
    - Else: `delta = event.delta` (default).
  - Output: Update `start/end` of scrollbar.

- **Rendering**:
  - Input: `start`, `end`, `trackSize`, `minSliderSize`.
  - Logic:
    - `currentSize = (end - start) * trackSize`.
    - If `currentSize < minSliderSize`:
      - `diff = (minSliderSize - currentSize) / trackSize`.
      - `visualStart = start - diff/2`, `visualEnd = end + diff/2`.
      - Clamp `visualStart`, `visualEnd` to [0, 1].
  - Output: `visualStart`, `visualEnd` passed to renderer.
