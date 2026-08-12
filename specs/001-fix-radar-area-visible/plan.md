# Plan: Fix Radar Chart Area Visibility Update

## Phase 0: Research
- [x] Analyze `BaseMark.ts` code, especially `_compileProduct`, `removeProduct`, and `_runApplyGraphic`.
- [x] Confirm that `removeProduct` does not clear children graphics.
- [x] Confirm that `_runApplyGraphic` misses `appendChild` for reused graphics when product is recreated.

## Phase 1: Implementation Design
- Modify `packages/vchart/src/mark/base/base-mark.ts`.
- In `_runApplyGraphic`, check if reused graphics are attached to the current `this._product`.
- If not (or if `this._product` changed), append the graphic to `this._product`.

## Technical Details
- The fix involves adding a check in `_runApplyGraphic` loop:
  ```typescript
  if (this._product && g.parent !== this._product) {
    this._product.appendChild(g);
  }
  ```
- This ensures that when `this._product` is recreated (after `visible: false -> true`), the existing graphics are moved to the new group.

## Risks
- Ensure that this doesn't break other update scenarios where `_product` is NOT recreated but graphics are updated. (In that case `g.parent` would be `this._product`, so `appendChild` is skipped or safe).
- Ensure that `appendChild` handles re-parenting correctly (vrender usually does).

## Verification Plan
- Create a unit test case that reproduces the issue:
  1. Create a chart with `area.visible: false`.
  2. Verify `areaMark.getProduct()` is null.
  3. Update spec to `area.visible: true`.
  4. Verify `areaMark.getProduct()` is not null and has children.
- Verify existing tests pass.
