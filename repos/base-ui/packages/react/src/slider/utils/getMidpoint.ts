import type { Coords } from '../../floating-ui-react/types';

export function getMidpoint(element: HTMLElement): Coords {
  const rect = element.getBoundingClientRect();
  return {
    x: (rect.left + rect.right) / 2,
    y: (rect.top + rect.bottom) / 2,
  };
}
