# Feature Specification: Hide Axes For Empty Series

**Feature Branch**: `010-hide-empty-axes`  
**Created**: 2026-03-20  
**Status**: Draft  
**Input**: User description: "Add hideWhenEmpty axis option to hide axes when series is empty"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Suppress Empty Axes (Priority: P1)

As a chart author, I want to opt in to hiding an axis when every series bound to that axis has no visible data, so charts do not show empty scaffolding that suggests missing content.

**Why this priority**: This is the core request from issue #4490 and provides immediate visual clarity in empty-state charts.

**Independent Test**: Configure a chart with one or more axes and no usable series data, enable the new empty-axis behavior, and verify the affected axes do not render while the rest of the chart remains stable.

**Acceptance Scenarios**:

1. **Given** a chart axis with the empty-axis behavior enabled and all bound series have no usable data, **When** the chart renders, **Then** that axis is hidden.
2. **Given** a chart axis with the empty-axis behavior enabled and at least one bound series has usable data, **When** the chart renders, **Then** that axis remains visible.

---

### User Story 2 - Preserve Existing Defaults (Priority: P2)

As an existing VChart user, I want charts to keep their current axis visibility behavior unless I explicitly opt in, so upgrading does not change existing layouts unexpectedly.

**Why this priority**: Backward compatibility is required for a safe feature release in the core chart library.

**Independent Test**: Render an existing chart configuration without the new option and verify axis visibility matches current behavior for both empty and non-empty series.

**Acceptance Scenarios**:

1. **Given** a chart axis without the empty-axis behavior enabled, **When** all bound series are empty, **Then** the axis visibility matches the current default behavior.

---

### User Story 3 - Mixed Axis Visibility (Priority: P3)

As a chart author using multiple axes, I want only axes whose own bound series are empty to be hidden, so charts can still show the axes that have valid data.

**Why this priority**: Multi-axis charts are common in VChart, and partial hiding is needed to avoid over-hiding unrelated axes.

**Independent Test**: Render a chart with multiple axes where one axis has empty bound series and another has non-empty bound series, enable the new behavior, and verify only the empty axis is hidden.

**Acceptance Scenarios**:

1. **Given** a chart with multiple axes and the empty-axis behavior enabled per axis, **When** only some axes have bound series with usable data, **Then** only the axes whose bound series are empty are hidden.

### Edge Cases

- When an axis is configured with the empty-axis behavior but the chart has no series bound to that axis, the axis should be treated as empty and hidden.
- When series exist but all values are filtered out, invalid, or otherwise unavailable for rendering, the axis should be treated as empty.
- When one direction of axes is hidden in a multi-axis chart, layout and remaining axes should still render without overlap or misalignment.
- When the chart updates from empty to non-empty data, the axis should reappear on the next render/update cycle.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide an opt-in axis configuration that hides an axis when all series bound to that axis are empty at render time.
- **FR-002**: The system MUST keep current axis visibility behavior unchanged when the new empty-axis configuration is not enabled.
- **FR-003**: The system MUST evaluate emptiness per axis, based on the series bound to that specific axis, rather than using chart-wide emptiness.
- **FR-004**: The system MUST continue rendering any axis that has at least one bound series with usable data, even if other axes in the same chart are hidden.
- **FR-005**: The system MUST apply the empty-axis visibility rule consistently during initial render and after data or spec updates.
- **FR-006**: The system MUST make the new axis configuration available through the public chart specification for axes.
- **FR-007**: The system MUST preserve chart stability when axes are hidden, including layout, region sizing, and rendering of remaining components.

### Key Entities *(include if feature involves data)*

- **Axis Visibility Rule**: An axis-level display setting that determines whether the axis should stay visible when its bound series are empty.
- **Bound Series Set**: The collection of series associated with a specific axis and used to determine whether that axis has usable data.
- **Usable Data State**: The render-time status describing whether a series contributes visible data points for its bound axis.

## Assumptions

- The feature applies to chart axes exposed through the public VChart axis specification.
- "Empty" includes the absence of renderable series data after any chart preprocessing or filtering.
- The requested API name is `hideWhenEmpty`, as proposed in issue #4490.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In empty-data charts with the new axis option enabled, affected axes are hidden in 100% of verified regression scenarios.
- **SC-002**: In non-empty charts, enabling the new option does not hide any axis that still has at least one bound series with usable data in 100% of verified regression scenarios.
- **SC-003**: Existing chart specifications that do not enable the new option show no axis-visibility regression in the targeted validation scenarios for this release.
- **SC-004**: Multi-axis validation scenarios correctly hide only the empty axes and preserve the visible axes in 100% of targeted regression checks.
