# Research: Size Legend Handler Text Layout

## Decision 1: Treat this as a VChart spec/type support gap, not a new layout engine feature

- Decision: Extend the size legend `handlerText.style` contract so function-based style values are accepted and passed through the existing continuous legend transformation path.
- Rationale: `transformComponentStyle` already preserves `style` callbacks by wrapping them and converting returned values with `transformToGraphic`. The continuous legend path already calls `transformComponentStyle(handlerText)`, so the missing support is in the public type contract rather than the transform implementation itself.
- Alternatives considered:
  - Modify continuous legend layout defaults to auto-avoid overlap in all cases. Rejected because the issue explicitly asks for function style support, and a generic layout rewrite is broader than the reported bug.
  - Patch only documentation without changing the type contract. Rejected because TypeScript users would still be blocked from supplying the supported runtime shape.

## Decision 2: Reuse the existing legend style callback signature pattern

- Decision: Model the new `handlerText.style` callback after other legend callback-based style APIs that receive legend item context and return a style object.
- Rationale: Discrete legend already exposes callback-capable style values for legend item subparts, and `transformComponentStyle` is written against the `LegendItemDatum` callback shape expected by vrender components.
- Alternatives considered:
  - Introduce a new callback signature specific to continuous legends. Rejected because it would add public API inconsistency and require additional transformation logic without evidence that vrender needs a different shape.
  - Accept only full `handlerText` object callbacks. Rejected because the issue scope is narrower: `handlerText.style` should support function values.

## Decision 3: Add a focused unit regression around attribute transformation

- Decision: Add a unit test that verifies `getContinuousLegendAttributes` preserves function-based `handlerText.style` and transforms returned style values correctly.
- Rationale: This directly guards the bug path inside VChart without requiring browser-level screenshot infrastructure in this change. It also validates backward compatibility for static values in the same transformation layer.
- Alternatives considered:
  - Add only end-to-end demo verification. Rejected because the constitution strongly prefers regression coverage for bug fixes.
  - Test `transformComponentStyle` in isolation. Rejected because the user-facing contract is the continuous legend spec, and the regression should exercise the actual legend attribute assembly path.
