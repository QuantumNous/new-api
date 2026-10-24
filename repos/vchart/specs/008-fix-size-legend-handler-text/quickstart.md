# Quickstart: Verify Size Legend Handler Text Layout

## Manual Verification

1. Prepare a chart using the size legend demo referenced in issue #4489.
2. Configure `legend.size.handlerText.style` with a callback that changes text alignment or offset near the slider bounds.
3. Render the chart and drag the legend handler across the full range.
4. Confirm the handler text updates from the callback and remains readable near both ends of the slider.

## Automated Verification

1. Run the focused Jest test for the continuous legend regression.
2. Confirm that static `handlerText.style` still transforms as before.
3. Confirm that callback-based `handlerText.style` is preserved and its returned style is converted to graphic attributes.
