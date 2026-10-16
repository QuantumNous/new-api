import { afterEach, describe, expect, it, vi } from 'vitest';
import { isJSDOM } from '#test-utils';
import { getPseudoElementBounds } from './getPseudoElementBounds';

describe('getPseudoElementBounds', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.skipIf(!isJSDOM)('does not read pseudo-element styles in jsdom', () => {
    const element = createElementWithRect({ x: 100, y: 50, width: 20, height: 10 });
    const getComputedStyle = vi.spyOn(window, 'getComputedStyle');

    expect(getPseudoElementBounds(element)).toMatchObject({
      left: 100,
      right: 120,
      top: 50,
      bottom: 60,
    });
    expect(getComputedStyle).not.toHaveBeenCalled();
  });

  it.skipIf(isJSDOM)('includes pseudo-element bounds in browsers', () => {
    const style = document.createElement('style');
    style.textContent = `
      .pseudo-element-bounds-test {
        position: absolute;
        left: 100px;
        top: 50px;
        width: 20px;
        height: 10px;
      }

      .pseudo-element-bounds-test::before {
        content: "";
        display: block;
        width: 40px;
        height: 30px;
      }
    `;

    const element = document.createElement('div');
    element.className = 'pseudo-element-bounds-test';

    document.head.appendChild(style);
    document.body.appendChild(element);

    try {
      expect(getPseudoElementBounds(element)).toEqual({
        left: 90,
        right: 130,
        top: 40,
        bottom: 70,
      });
    } finally {
      element.remove();
      style.remove();
    }
  });
});

function createElementWithRect(rect: DOMRectInit) {
  const element = document.createElement('div');
  element.getBoundingClientRect = () => DOMRect.fromRect(rect);
  return element;
}
