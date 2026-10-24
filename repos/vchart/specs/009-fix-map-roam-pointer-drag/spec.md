# Feature Specification: Fix Map Roam Drag in Pointer-Only Mobile Browsers

**Feature Branch**: `009-fix-map-roam-pointer-drag`  
**Created**: 2026-03-19  
**Status**: Draft

## Summary

Fix a map interaction bug where dragging a roam-enabled map fails on mobile browsers when VChart is configured to use pointer events without touch events.

## User Scenarios

### Primary User Story

As a VChart user embedding a roam-enabled map in a mobile web page, I want vertical and horizontal dragging to remain stable when `supportsTouchEvents` is disabled, so that the map can still be panned reliably in pointer-only environments.

## Requirements

### Functional Requirements

1. The map component MUST support stable drag roaming on mobile browsers when `VChart.vglobal.supportsTouchEvents` is set to `false`.
2. The fix MUST prevent the browser's default touch gesture handling from interrupting map drag sequences when a geo region enables roam dragging.
3. The fix MUST preserve existing drag behavior for roam-enabled geo maps in normal browser rendering.
4. The fix MUST NOT change interaction behavior for charts that are not geo roam drag scenarios.

### Edge Cases

1. When a geo region disables `roam.drag`, the browser's default touch behavior should remain unchanged.
2. When a chart does not use geo regions, the fix should not alter canvas touch handling.
3. When roam is toggled by spec updates, the canvas touch handling should reflect the latest spec state.

## Success Criteria

1. In pointer-only mobile browser mode, initial vertical dragging on a roam-enabled map no longer enters a broken partial-drag state.
2. Horizontal and vertical panning both work consistently without requiring a prior horizontal gesture.
3. Non-map or non-roam charts keep their existing page scrolling behavior.
