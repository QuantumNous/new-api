# Feature Specification: Fix Discrete Legend Filtering After updateSpec

**Feature Branch**: `011-fix-discrete-legend-filter-after-update-spec`  
**Created**: 2026-04-21  
**Status**: Draft  
**Input**: User description: "Fix VChart issue #4566: after `updateSpec`, clicking a discrete legend with a custom `data` callback no longer triggers legend filtering unless `reMake` is true"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Keep Discrete Legend Filtering Active After updateSpec (Priority: P1)

As a chart author using a discrete legend with a custom `data` callback, I want legend clicks to keep filtering the latest series data after `updateSpec(..., { reMake: false })` so that I can update chart data without remaking the chart and losing legend interaction.

**Why this priority**: The reported bug breaks the primary discrete-legend interaction path immediately after a common update flow and regresses behavior that previously worked in 1.x.

**Independent Test**: Render a chart whose legend uses `data: items => items`, call `updateSpecSync` with new legend values and `reMake: false`, click a legend item, and verify both the legend selected state and filtered series view data update to the new legend domain.

**Acceptance Scenarios**:

1. **Given** a discrete legend configured with a custom `data` callback, **When** `updateSpecSync` updates the backing data with `reMake: false`, **Then** the legend still exposes the latest legend items after the update.
2. **Given** the same chart after `updateSpecSync`, **When** the user clicks a legend item, **Then** VChart updates the legend selected data and re-filters series view data according to the clicked legend item.

### Edge Cases

- The `reCompile` path must rebuild or rebind the underlying vrender legend component after cleanup so event handlers are not lost.
- Existing discrete legends without a custom `data` callback must keep their current interaction behavior.
- `reMake: true` behavior must remain unchanged.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: After `updateSpec` on a discrete legend with a custom `data` callback, the legend component MUST use the updated legend item set when `reMake` is false.
- **FR-002**: After the same update path, clicking a legend item MUST update `selectedData` and trigger the normal series data filtering flow.
- **FR-003**: Legend cleanup on the `reCompile` path MUST NOT retain a released vrender legend component instance.
- **FR-004**: Existing discrete legend behavior outside this update path MUST remain backward compatible.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In the issue #4566 reproduction, `updateSpec(..., { reMake: false })` no longer disables legend filtering when `legends.data` is a function.
- **SC-002**: A focused automated regression test proves legend selection and series filtering still work after the update.
