# Research: Hide Axes For Empty Series

**Feature**: Hide Axes For Empty Series
**Date**: 2026-03-20

## Unknowns & Resolutions

### 1. What should define an "empty" axis?
- **Analysis**: Axis visibility should be derived from the data actually collected by the axis from its bound series, not from chart-level series count or raw spec presence.
- **Decision**: Treat an axis as empty when the axis data collection step cannot collect any series statistics for the bound series.
- **Rationale**: This matches the requested behavior and aligns with existing axis domain computation, which already filters out empty `viewData`.
- **Alternatives Considered**:
  - Use chart-level "all series empty": rejected because multi-axis charts would over-hide unrelated axes.
  - Use raw series array existence: rejected because a series can exist in spec but still have no collected axis data after transforms or filtering.

### 2. How should runtime auto hide/show work?
- **Analysis**: Current axis `visible` is effectively a creation-time decision. Hiding by only mutating spec visibility would require remake to show the axis again after data updates.
- **Decision**: Separate explicit spec visibility from runtime empty-data visibility inside the axis component. Keep axis marks/tick data available when `hideWhenEmpty` is enabled, and update effective visibility as data changes.
- **Rationale**: This supports `updateData` and `updateSpec` driven reappearance without remaking the whole chart.
- **Alternatives Considered**:
  - Recompute chart spec and remake chart on every visibility change: rejected because it is heavier and less aligned with the existing axis update flow.
  - Hide only rendered graphics while keeping layout size: rejected because the axis would still occupy space, which does not solve the empty-axis problem.

### 3. What is the correct implementation surface for this issue?
- **Analysis**: The request scope was clarified to cartesian axes only. Public API changes still need to be reflected in both source specs and published declaration files.
- **Decision**: Add `hideWhenEmpty?: boolean` to the common axis spec used by cartesian axes, then implement runtime visibility checks in the axis base/cartesian axis pipeline.
- **Rationale**: This exposes one consistent API while keeping implementation scope limited to cartesian axes.

## Technology Choices

- **Public API**: `hideWhenEmpty?: boolean` on axis spec.
- **Runtime Visibility Source**: Axis data collection result from bound series.
- **Behavior Scope**: Cartesian axes only in this change.
- **Validation**: Unit tests covering empty initial render, mixed-axis cases, and runtime updates.

## Best Practices

- Preserve backward compatibility by defaulting the new option to disabled.
- Reuse the existing axis data collection flow instead of introducing separate emptiness scans.
- Avoid tying runtime visibility to only raw data presence; use collected series statistics so filtered or non-renderable data is handled consistently.
