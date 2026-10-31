# Feature Specification: Fix DataZoom Value Update on Data Change in React

**Feature Branch**: `007-fix-datazoom-react`
**Created**: 2025-02-09
**Status**: Draft
**Input**: User description: "Fix DataZoom value not updating after data update in React (Issue #4185)"

## Clarifications

### Session 2025-02-09

- Q: How should DataZoom range behave when data updates? → A: Reset range based on user configuration (props/spec). If user explicitly sets `start: 0, end: 0.2`, respect that on update.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - DataZoom Synchronization on Data Update (Priority: P1)

As a developer using ReactVChart, I want the DataZoom component to automatically update its state (value range and preview) when I update the chart's data source, so that the data navigation control accurately reflects the new dataset.

**Why this priority**: This is a critical bug fix. Currently, when data changes in a React environment, the DataZoom component may retain stale references to old data or fail to update its internal state, leading to broken interaction and incorrect visual feedback.

**Independent Test**:

1.  Setup a ReactVChart with a Bar chart and DataZoom.
2.  Provide an initial dataset.
3.  Trigger a data update (e.g., via `setState`).
4.  Observe that the chart updates.
5.  **Verify**: The DataZoom preview should reflect the new data distribution.
6.  **Verify**: Dragging the DataZoom handlers should correctly filter the _new_ data, not the old data.

**Acceptance Scenarios**:

1.  **Given** a chart with DataZoom and initial data A, **When** the data is replaced with data B (different range/values), **Then** the DataZoom preview must re-render to show the shape of data B.
2.  **Given** the data has been updated to data B, **When** I interact with the DataZoom, **Then** it should filter data B correctly.
3.  **Given** a DataZoom spec with explicit range (e.g., start: 0, end: 0.2), **When** data or spec updates, **Then** the DataZoom range should respect the configured values (resetting to 0-0.2) rather than preserving current user interaction state or resetting to full range (0-1).

---

### Edge Cases

- **Data View Reference**: In React, props update might cause the underlying `DataView` to be replaced. DataZoom needs to unbind from the old `DataView` and bind to the new one.
- **Empty Data**: Updating to empty data should clear the preview safely.
- **User Interaction vs. Spec Reset**: If the user has manually panned the zoom, but then triggers a data update _without_ changing the spec range, should we preserve the manual position?
  - _Clarification Answer implies_: If the spec contains explicit range settings passed down during update, those take precedence. If no specific range is enforced in the update payload, standard behavior applies (usually preserving if possible, or resetting if data is totally new). For this fix, we prioritize respecting the incoming spec configuration.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `DataFilterBaseComponent` (and subclasses like `DataZoom`) MUST detect when the associated Series' data source (DataView) changes.
- **FR-002**: Upon detection of a data source change, the component MUST remove listeners from the old DataView to prevent memory leaks and stale updates.
- **FR-003**: The component MUST add listeners to the new DataView to receive `change` events.
- **FR-004**: The component MUST trigger a re-computation of its domain and re-render the preview when the data source changes.
- **FR-005**: On data/spec update, the DataZoom range (start/end) MUST be re-evaluated against the provided configuration. If `start`/`end` properties are present in the spec, they MUST be applied, overriding previous interactive states if they differ.

### Key Entities

- **DataFilterBaseComponent**: The base class for data filtering components.
- **DataView**: The VDataset object holding the data.
- **Series**: The chart series that provides the data to the DataZoom.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: DataZoom updates correctly (preview and filtering) 100% of the time after a data prop update in ReactVChart.
- **SC-002**: No errors in console regarding detached DataViews or stale listeners.
- **SC-003**: Explicit range configurations (start/end) are correctly applied after data updates.
