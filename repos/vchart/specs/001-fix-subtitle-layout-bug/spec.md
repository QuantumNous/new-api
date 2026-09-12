# Feature Specification: Fix Subtitle Layout Bug

**Feature Branch**: `001-fix-subtitle-layout-bug`
**Created**: 2026-01-13
**Status**: Draft
**Input**: User description: "If only the subtitle is set in the title and the main title is not set, a layout error will occur."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Render Chart with Only Subtitle (Priority: P1)

As a developer using VChart, I want to be able to display a chart with only a subtitle (no main title) so that I can have flexible title configurations without layout errors.

**Why this priority**: This is a bug fix for a layout error that crashes or breaks the chart rendering when a valid configuration (only subtitle) is used.

**Independent Test**: Create a chart with a title component where `text` is undefined/null/empty and `subtext` has a string value.

**Acceptance Scenarios**:

1. **Given** a VChart configuration with a title component, **When** the `text` property is not set but `subtext` is set to "My Subtitle", **Then** the chart should render without errors.
2. **Given** the chart renders, **When** checking the layout, **Then** the title component should occupy the correct amount of space for the subtitle.
3. **Given** the chart renders, **When** checking the visual output, **Then** "My Subtitle" should be visible.

### Edge Cases

- What happens when both `text` and `subtext` are empty? (Should render nothing or empty space, but not crash).
- What happens when `subtext` is empty but `text` is set? (Standard case, should already work).
- What happens when title is positioned at different locations (top/bottom/left/right) with only subtitle?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST support title components where the main title (`text`) is undefined or empty string.
- **FR-002**: The system MUST correctly calculate layout dimensions when only `subtext` is present.
- **FR-003**: The system MUST NOT throw layout calculation errors or exceptions when `text` is missing.
- **FR-004**: The rendering engine MUST display the `subtext` content even if `text` is missing.

### Key Entities

- **TitleComponent**: The component responsible for rendering chart titles and subtitles.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can successfully render a chart with only a subtitle defined.
- **SC-002**: No console errors or exceptions related to "layout" or "title" when rendering with only subtitle.
- **SC-003**: Visual regression tests confirm that subtitle is displayed correctly.
