# Research: Scrollbar Fixed Step & Min Height

**Feature**: Scrollbar Fixed Step & Min Height
**Date**: 2026-01-15

## Unknowns & Resolutions

### 1. How to implement fixed pixel step scrolling?
- **Analysis**: Wheel events are handled in `DataFilterEvent.handleChartScroll`. Currently, it calculates a percentage delta based on `scrollX/Y` (pixels) divided by total layout size.
- **Decision**: Modify `handleChartScroll` to check for a new `scrollStep` configuration. If present, ignore the magnitude of `scrollX/Y` and instead use `sign(scrollX/Y) * scrollStep` as the pixel delta.
- **Rationale**: This satisfies the requirement to move by a fixed distance per wheel event (notch), overriding the default behavior.

### 2. How to implement minimum slider size?
- **Analysis**: `ScrollBar` in `vchart` uses `@visactor/vrender-components`'s `ScrollBar`. It sets the `range` attribute (0-1). `vrender-components` likely draws the slider proportional to this range.
- **Constraint**: `vrender-components` is an external dependency (~1.0.37). We cannot easily modify it to add a `minSliderSize` prop if it doesn't exist.
- **Decision**: Implement a "Visual Range" adjustment in `ScrollBar._getAttrs`.
  - Calculate the logical `start` and `end`.
  - Calculate the pixel size: `size = (end - start) * trackLength`.
  - If `size < minSliderSize`, calculate a `visualStart` and `visualEnd` that produces `minSliderSize` while keeping the center position (clamped).
  - Pass this `visualRange` to the vrender component.
  - **Note**: This means the visual slider will represent a larger data range than actual. This is a common trade-off for usability.
- **Alternatives Considered**:
  - Update `vrender-components`: Blocked by repo access/scope.
  - `limitRange`: Only limits bounds, not size.

## Technology Choices

- **Configuration**: Add `scrollStep` (number) and `minSliderSize` (number) to `IScrollBarSpec`.
- **Implementation Location**:
  - `packages/vchart/src/component/data-zoom/data-filter-event.ts`: Wheel logic.
  - `packages/vchart/src/component/data-zoom/scroll-bar/scroll-bar.ts`: Rendering logic.

## Best Practices

- **Event Handling**: Ensure the fixed step doesn't conflict with trackpad smooth scrolling (maybe apply debounce or threshold if needed, but for now stick to "notch" logic).
- **Rendering**: Ensure the "Visual Range" adjustment doesn't break drag interactions (dragging the larger slider should still work, though the data update might be slightly non-linear or just reflect the visual position).
