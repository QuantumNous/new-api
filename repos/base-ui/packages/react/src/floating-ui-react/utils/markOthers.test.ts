import { expect } from 'vitest';
import { markOthers } from './markOthers';

afterEach(() => {
  document.body.innerHTML = '';
});

test('single call', () => {
  const other = document.createElement('div');
  document.body.appendChild(other);
  const target = document.createElement('div');
  document.body.appendChild(target);

  const cleanup = markOthers([target], { ariaHidden: true });

  expect(other.getAttribute('aria-hidden')).toBe('true');

  cleanup();

  expect(other.getAttribute('aria-hidden')).toBe(null);
});

test('multiple calls', () => {
  const other = document.createElement('div');
  document.body.appendChild(other);
  const target = document.createElement('div');
  document.body.appendChild(target);

  const cleanup = markOthers([target], { ariaHidden: true });

  expect(other.getAttribute('aria-hidden')).toBe('true');

  const nextTarget = document.createElement('div');
  document.body.appendChild(nextTarget);

  const nextCleanup = markOthers([nextTarget], { ariaHidden: true });

  expect(target.getAttribute('aria-hidden')).toBe('true');
  expect(nextTarget.getAttribute('aria-hidden')).toBe(null);

  document.body.removeChild(nextTarget);

  nextCleanup();

  expect(target.getAttribute('aria-hidden')).toBe(null);
  expect(other.getAttribute('aria-hidden')).toBe('true');

  cleanup();

  expect(other.getAttribute('aria-hidden')).toBe(null);

  document.body.appendChild(nextTarget);
});

test('out of order cleanup', () => {
  const other = document.createElement('div');
  document.body.appendChild(other);
  const target = document.createElement('div');
  target.setAttribute('data-testid', '');
  document.body.appendChild(target);

  const cleanup = markOthers([target], { ariaHidden: true });

  expect(other.getAttribute('aria-hidden')).toBe('true');

  const nextTarget = document.createElement('div');
  document.body.appendChild(nextTarget);

  const nextCleanup = markOthers([nextTarget], { ariaHidden: true });

  expect(target.getAttribute('aria-hidden')).toBe('true');
  expect(nextTarget.getAttribute('aria-hidden')).toBe(null);

  cleanup();

  expect(nextTarget.getAttribute('aria-hidden')).toBe(null);
  expect(target.getAttribute('aria-hidden')).toBe('true');
  expect(other.getAttribute('aria-hidden')).toBe('true');

  nextCleanup();

  expect(nextTarget.getAttribute('aria-hidden')).toBe(null);
  expect(other.getAttribute('aria-hidden')).toBe(null);
  expect(target.getAttribute('aria-hidden')).toBe(null);
});

test('multiple cleanups with differing controlAttribute', () => {
  const other = document.createElement('div');
  document.body.appendChild(other);
  const target = document.createElement('div');
  target.setAttribute('data-testid', '1');
  document.body.appendChild(target);

  const cleanup = markOthers([target], { ariaHidden: true });

  expect(other.getAttribute('aria-hidden')).toBe('true');

  const target2 = document.createElement('div');
  target2.setAttribute('data-testid', '2');
  document.body.appendChild(target2);

  const cleanup2 = markOthers([target2]);

  expect(target.getAttribute('aria-hidden')).not.toBe('true');
  expect(target.getAttribute('data-base-ui-inert')).toBe('');

  cleanup();

  expect(other.getAttribute('aria-hidden')).toBe(null);

  cleanup2();

  expect(target.getAttribute('data-base-ui-inert')).toBe(null);
});

test('mixed controlAttribute usage (aria-hidden/inert/none)', () => {
  const other = document.createElement('div');
  document.body.appendChild(other);

  const A = document.createElement('div');
  A.setAttribute('data-testid', 'A');
  document.body.appendChild(A);

  const B = document.createElement('div');
  B.setAttribute('data-testid', 'B');
  document.body.appendChild(B);

  const C = document.createElement('div');
  C.setAttribute('data-testid', 'C');
  document.body.appendChild(C);

  const cleanupA = markOthers([A], { ariaHidden: true });

  expect(other.getAttribute('aria-hidden')).toBe('true');
  expect(other.hasAttribute('inert')).toBe(false);
  expect(other.getAttribute('data-base-ui-inert')).toBe('');

  const cleanupB = markOthers([B], { inert: true });

  expect(other.getAttribute('aria-hidden')).toBe('true');
  expect(other.getAttribute('inert')).toBe('');
  expect(other.getAttribute('data-base-ui-inert')).toBe('');

  const cleanupC = markOthers([C]);

  expect(other.getAttribute('aria-hidden')).toBe('true');
  expect(other.getAttribute('inert')).toBe('');
  expect(other.getAttribute('data-base-ui-inert')).toBe('');

  cleanupC();

  expect(other.getAttribute('aria-hidden')).toBe('true');
  expect(other.getAttribute('inert')).toBe('');
  expect(other.getAttribute('data-base-ui-inert')).toBe('');

  cleanupB();

  expect(other.getAttribute('aria-hidden')).toBe('true');
  expect(other.hasAttribute('inert')).toBe(false);
  expect(other.getAttribute('data-base-ui-inert')).toBe('');

  cleanupA();

  expect(other.hasAttribute('aria-hidden')).toBe(false);
  expect(other.hasAttribute('inert')).toBe(false);
  expect(other.hasAttribute('data-base-ui-inert')).toBe(false);
});

test('tracks externally controlled attributes per control attribute', () => {
  const container = document.createElement('div');
  const keep = document.createElement('div');
  const outside = document.createElement('div');

  outside.setAttribute('inert', '');
  container.append(keep, outside);
  document.body.append(container);

  let cleanupInert: (() => void) | undefined;
  let cleanupAriaHidden: (() => void) | undefined;

  try {
    cleanupInert = markOthers([keep], { inert: true });
    cleanupAriaHidden = markOthers([keep], { ariaHidden: true });

    expect(outside).toHaveAttribute('inert');
    expect(outside).toHaveAttribute('aria-hidden', 'true');

    cleanupAriaHidden();
    cleanupAriaHidden = undefined;

    expect(outside).toHaveAttribute('inert');
    expect(outside).not.toHaveAttribute('aria-hidden');

    cleanupInert();
    cleanupInert = undefined;

    expect(outside).toHaveAttribute('inert');
    expect(outside).not.toHaveAttribute('aria-hidden');
  } finally {
    cleanupAriaHidden?.();
    cleanupInert?.();
  }
});

test('preserves externally owned aria-hidden during concurrent aria-hidden and inert overlaps', () => {
  const keep = document.createElement('div');
  const outside = document.createElement('div');
  outside.setAttribute('aria-hidden', 'true');
  document.body.append(keep, outside);

  let cleanupAriaHidden: (() => void) | undefined;
  let cleanupInert: (() => void) | undefined;

  try {
    cleanupAriaHidden = markOthers([keep], { ariaHidden: true, mark: false });
    cleanupInert = markOthers([keep], { inert: true, mark: false });

    expect(outside).toHaveAttribute('aria-hidden', 'true');
    expect(outside).toHaveAttribute('inert');

    cleanupInert();
    cleanupInert = undefined;

    expect(outside).toHaveAttribute('aria-hidden', 'true');
    expect(outside).not.toHaveAttribute('inert');

    cleanupAriaHidden();
    cleanupAriaHidden = undefined;

    expect(outside).toHaveAttribute('aria-hidden', 'true');
    expect(outside).not.toHaveAttribute('inert');
  } finally {
    cleanupInert?.();
    cleanupAriaHidden?.();
  }
});

test('does not let mark-only overlap disturb control cleanup bookkeeping', () => {
  const keep = document.createElement('div');
  const outside = document.createElement('div');
  document.body.append(keep, outside);

  let cleanupMarkOnly: (() => void) | undefined;
  let cleanupControlOnly: (() => void) | undefined;

  try {
    cleanupMarkOnly = markOthers([keep], { mark: true });
    cleanupControlOnly = markOthers([keep], { ariaHidden: true, mark: false });

    expect(outside).toHaveAttribute('data-base-ui-inert');
    expect(outside).toHaveAttribute('aria-hidden', 'true');

    cleanupMarkOnly();
    cleanupMarkOnly = undefined;

    expect(outside).not.toHaveAttribute('data-base-ui-inert');
    expect(outside).toHaveAttribute('aria-hidden', 'true');

    cleanupControlOnly();
    cleanupControlOnly = undefined;

    expect(outside).not.toHaveAttribute('data-base-ui-inert');
    expect(outside).not.toHaveAttribute('aria-hidden');
  } finally {
    cleanupControlOnly?.();
    cleanupMarkOnly?.();
  }
});

test('does not recurse infinitely with target inside anchor in shadow root', () => {
  const host = document.createElement('div');
  document.body.appendChild(host);

  const shadowRoot = host.attachShadow({ mode: 'open' });
  const anchor = document.createElement('a');
  anchor.href = 'https://floating-ui.com';

  const target = document.createElement('button');
  anchor.appendChild(target);
  shadowRoot.appendChild(anchor);

  const cleanup = markOthers([target], { ariaHidden: true });

  cleanup();
});

test('uses shadow root host as avoid element when parent chain includes anchor', () => {
  const outside = document.createElement('div');
  document.body.appendChild(outside);

  const host = document.createElement('div');
  document.body.appendChild(host);

  const shadowRoot = host.attachShadow({ mode: 'open' });
  const anchor = document.createElement('a');
  anchor.href = 'https://floating-ui.com';

  const target = document.createElement('button');
  anchor.appendChild(target);
  shadowRoot.appendChild(anchor);

  const cleanup = markOthers([target], { ariaHidden: true });

  expect(outside.getAttribute('aria-hidden')).toBe('true');
  expect(host.getAttribute('aria-hidden')).toBe(null);

  cleanup();

  expect(outside.getAttribute('aria-hidden')).toBe(null);
});
