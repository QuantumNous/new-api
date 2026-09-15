# Feature: Fix Radar Chart Area Visibility Update

## Context
User reported a bug where the radar chart area cannot be displayed or hidden through `updateSpec`. specifically when switching `visible` from `false` to `true`.
The issue seems to be related to graphics reuse in `BaseMark`. When a mark becomes invisible, its product (group) is removed, but the graphics are cached. When it becomes visible again, the product is recreated, but cached graphics are not correctly re-attached to the new product.

## Requirements
1.  **Fix Visibility Update**: Ensure that when a mark's visibility changes from `false` to `true` via `updateSpec`, the graphics are correctly displayed.
2.  **Graphics Reuse**: Ensure that reused graphics are correctly attached to the newly created product (Group) in `BaseMark`.

## Acceptance Criteria
- [ ] Radar chart area shows up when `updateSpec` changes `area.visible` from `false` to `true`.
- [ ] No regression in other chart types or update scenarios.
