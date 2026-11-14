/**
 * @deprecated This utility is no longer used internally and will be removed in the next version.
 */
export function isMouseWithinBounds(
  event: React.MouseEvent<HTMLElement> | React.PointerEvent<HTMLElement>,
) {
  const targetRect = event.currentTarget.getBoundingClientRect();

  // Safari randomly fires `mouseleave` incorrectly when the item is
  // aligned to the trigger. This is a workaround to prevent the highlight
  // from being removed while the cursor is still within the bounds of the item.
  // https://github.com/mui/base-ui/issues/869
  const isWithinBounds =
    targetRect.top + 1 <= event.clientY &&
    event.clientY <= targetRect.bottom - 1 &&
    targetRect.left + 1 <= event.clientX &&
    event.clientX <= targetRect.right - 1;

  return isWithinBounds;
}
