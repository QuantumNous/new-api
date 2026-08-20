# Playground Parameter Popover Design

## Goal

Match the supplied `flatkey-dialog-model-prototype.html` interaction when a
Playground user opens media generation parameters. The Playground remains
clear and usable as visual context; parameters appear in a local surface
anchored to the Parameters button.

## Selected interaction

- Replace the centered modal dialog with the existing shared Popover primitive.
- Open the panel above the Parameters button and align its left edge with the
  trigger, matching the supplied prototype.
- Do not render a full-screen backdrop, dimmer, or backdrop blur.
- Keep the existing model-specific fields, values, constraints, localization,
  and parameter update callbacks unchanged.
- Keep a visible close button. Clicking outside the panel or pressing Escape
  also closes it through the Popover primitive.
- Constrain the panel to the viewport and allow its contents to scroll on small
  screens.

## Scope

Only `PlaygroundParameters` and its focused regression test change. The shared
Dialog and Popover primitives remain unchanged so other application surfaces
retain their existing behavior.

## Verification

- A focused component test proves the Parameters trigger uses a popover rather
  than a modal dialog trigger.
- Playground tests, targeted lint, typecheck, and production build pass.
- Staging browser inspection confirms there is a popover content surface and no
  dialog overlay after clicking Parameters.

