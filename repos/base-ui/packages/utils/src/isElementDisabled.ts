export function isElementDisabled(element: HTMLElement | null) {
  return (
    element == null ||
    element.hasAttribute('disabled') ||
    element.getAttribute('aria-disabled') === 'true'
  );
}
