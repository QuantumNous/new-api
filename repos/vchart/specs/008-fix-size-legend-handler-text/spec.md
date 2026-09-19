# Feature Specification: Size Legend Handler Text Layout

**Feature Branch**: `008-fix-size-legend-handler-text`  
**Created**: 2026-03-20  
**Status**: Draft  
**Input**: User description: "Fix VChart issue #4489: size legend handlerText style should support function values and avoid overlapping text when sliding the handler"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Render Handler Text Without Overlap (Priority: P1)

As a chart author using a size legend with a draggable handler, I want the handler text to stay readable while the handler moves so that the legend remains understandable during interaction.

**Why this priority**: The reported bug is a visual regression in the primary interaction path for the size legend. Fixing readability during dragging is the direct user value of this issue.

**Independent Test**: Open a chart with a size legend and drag the handler across its range. The handler text remains readable and does not overlap surrounding legend content throughout the interaction.

**Acceptance Scenarios**:

1. **Given** a size legend configured with handler text enabled, **When** the user drags the handler, **Then** the handler text remains visually separated from adjacent legend labels and marks.
2. **Given** a size legend with default handler text styling, **When** the handler is moved to either end of the slider range, **Then** the rendered text still stays readable and does not collide with neighboring content.

---

### User Story 2 - Use Dynamic Handler Text Styling (Priority: P2)

As a chart author, I want handler text style options to accept dynamic values so that I can tailor the text presentation to the active legend value and layout context.

**Why this priority**: Supporting dynamic styling resolves the missing capability named in the bug report and enables authors to prevent layout problems in charts with varying content.

**Independent Test**: Configure handler text style with value-dependent settings, render the chart, and verify that the handler text updates according to the current legend value while preserving legibility.

**Acceptance Scenarios**:

1. **Given** a size legend whose handler text style is configured with functions, **When** the legend renders or updates, **Then** the evaluated style is applied to the handler text for the current handler state.
2. **Given** a size legend whose handler text style mixes static values and functions, **When** the handler position changes, **Then** both static and dynamic style settings are honored without breaking rendering.

### Edge Cases

- What happens when the handler is dragged to the minimum or maximum extent of the size legend range?
- How does the system handle handler text style functions that return partial style objects or omit optional fields?
- What happens when the evaluated handler text content becomes longer than typical labels in the same legend?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST render size legend handler text in a way that remains readable while the handler is dragged across the legend range.
- **FR-002**: The system MUST prevent handler text from visually overlapping adjacent size legend content in normal dragging scenarios, including when the handler is at either range boundary.
- **FR-003**: Chart authors MUST be able to provide function-based values for size legend `handlerText` style settings.
- **FR-004**: The system MUST evaluate function-based `handlerText` style values against the current legend context whenever the handler text is rendered or updated.
- **FR-005**: The system MUST continue to support existing static `handlerText` style values without requiring configuration changes from current users.
- **FR-006**: The system MUST ignore unsupported or missing dynamic style fields gracefully and continue rendering the handler text.

### Key Entities *(include if feature involves data)*

- **Size Legend Handler**: The draggable control on a size legend that represents the active position within the legend range.
- **Handler Text Style**: The set of presentation properties applied to the size legend handler label, including both static and function-derived values.
- **Legend Render Context**: The runtime state used to resolve handler text appearance, such as current handler position or legend value.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In the reproduction for issue #4489, dragging the size legend handler no longer produces visible overlap between handler text and neighboring legend content.
- **SC-002**: Charts that already use static size legend `handlerText` styles continue to render without required option changes.
- **SC-003**: Charts configured with function-based size legend `handlerText` style values apply those values during initial render and after handler movement.
- **SC-004**: The bug fix can be verified with automated coverage or scripted examples that exercise both static and dynamic `handlerText` styling behavior.
