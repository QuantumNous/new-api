# Feature Specification: Scrollbar Fixed Step & Min Height

**Feature Branch**: `001-scrollbar-wheel-step`  
**Created**: 2026-01-15  
**Status**: Draft  
**Input**: User description: "Support fixed pixel step scrolling on wheel event and minimum scrollbar slider height"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fixed Step Scrolling (Priority: P1)

As a chart user, I want the scrollbar to scroll by a fixed pixel distance when I use the mouse wheel, so that I can navigate the chart content with consistent and predictable speed regardless of the total data range.

**Why this priority**: This is the core functionality requested to improve user experience during scrolling, especially for charts where precise navigation is needed.

**Independent Test**: Can be tested by configuring a scrollbar with a fixed step and verifying that each wheel notch moves the content by exactly that amount.

**Acceptance Scenarios**:

1. **Given** a chart with a scrollbar configured with `scrollStep: 20` (pixels), **When** I scroll the mouse wheel one notch, **Then** the view should shift by exactly 20 pixels.
2. **Given** a chart with a scrollbar without `scrollStep` configured, **When** I scroll the mouse wheel, **Then** the view should shift by the default calculated amount (percentage-based or native behavior).

---

### User Story 2 - Minimum Slider Visibility (Priority: P1)

As a chart user viewing a very large dataset, I want the scrollbar slider to maintain a minimum size, so that I can still see and interact with it even when the data ratio would mathematically make it tiny.

**Why this priority**: Critical for usability with large datasets. If the slider becomes too small (e.g., 1-2px), it becomes impossible to drag or even see.

**Independent Test**: Can be tested by loading a chart with a massive dataset (e.g., 10,000 points) and verifying the rendered slider height/width.

**Acceptance Scenarios**:

1. **Given** a chart with a large dataset that would result in a 2px slider and `minSliderSize` set to 20px, **When** the chart renders, **Then** the scrollbar slider should be rendered with a size of 20px.
2. **Given** a chart with a small dataset where the calculated slider size is 50px (larger than min), **When** the chart renders, **Then** the scrollbar slider should be rendered with its calculated size (50px).

### Edge Cases

- What happens when the `scrollStep` is larger than the total scrollable area? The scroll should clamp to the start/end bounds.
- What happens when `minSliderSize` is larger than the total scrollbar track size? The slider should probably fill the track or be clamped to the track size.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The scrollbar component MUST support a configuration option (e.g., `roam.step` or `scrollbar.scrollStep`) to define the scrolling step size in pixels for wheel events.
- **FR-002**: When the fixed step configuration is present, the wheel event handler MUST ignore the default percentage-based scrolling and apply the fixed pixel offset.
- **FR-003**: The scrollbar component MUST support a configuration option (e.g., `slider.minSize` or `minSliderSize`) to define the minimum size (height for vertical, width for horizontal) of the slider.
- **FR-004**: The rendering logic for the scrollbar slider MUST check the calculated size against the minimum size and use the larger of the two, while ensuring it doesn't exceed the track size.

### Key Entities

- **Scrollbar Spec**: The configuration object defining scrollbar behavior.
- **Scroll Event**: The event triggered by mouse wheel interactions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: When configured with a 50px step, 10 wheel events move the scroll position by exactly 500px (within float precision).
- **SC-002**: With 1,000,000 data points and a 500px high chart, the scrollbar slider is rendered at exactly the configured minimum size (e.g., 20px) and is clickable/draggable.
