# Feature Specification: Fix Heatmap Scrollbar Axis Direction

**Feature Branch**: `009-fix-heatmap-scrollbar-axis-direction`  
**Created**: 2026-03-23  
**Status**: Draft  
**Input**: User description: "Fix VChart issue #4320: heatmap right scrollbar scroll direction is opposite to the left band axis order"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Keep Vertical Scroll Direction Consistent (Priority: P1)

As a chart author using a heatmap with a right-side vertical scrollbar, I want the visible left-axis labels to move in the same direction as the scrollbar thumb so that the viewport behaves consistently with bar charts and user expectations.

**Why this priority**: The reported bug breaks the primary interaction for scrolling long heatmap category axes and makes the chart feel inverted.

**Independent Test**: Render a heatmap with a left `band` axis and a right `scrollBar` bound to the same Y field. Move the scrollbar to the top and verify the axis viewport shows the first categories rather than the last categories.

**Acceptance Scenarios**:

1. **Given** a heatmap whose Y axis is a vertical band axis and whose `scrollBar.orient` is `right`, **When** the scrollbar range starts at `0`, **Then** the left axis viewport shows the earliest/top categories in the axis domain.
2. **Given** the same chart, **When** the scrollbar is dragged downward, **Then** the visible Y-axis categories advance downward in the same direction as the scrollbar thumb.

### Edge Cases

- Vertical discrete axes whose internal scale range is reversed because of cartesian axis layout should still map scrollbar state to domain values correctly.
- Horizontal scrollbars and already-correct dataZoom behavior must remain unchanged.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The scrollbar component MUST resolve discrete axis domain values using the same reverse-axis logic as other data-filter components.
- **FR-002**: For vertical cartesian band axes, a scrollbar state near `start = 0` MUST map to the top of the visible axis domain instead of the bottom when the axis scale range is reversed by layout.
- **FR-003**: Existing scrollbar behavior for non-reversed or horizontal axes MUST remain backward compatible.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In the issue #4320 reproduction, placing the right scrollbar thumb at the top shows the top portion of the heatmap Y-axis domain.
- **SC-002**: A focused automated regression test proves scrollbar state-to-domain conversion respects reversed vertical axis ranges.
