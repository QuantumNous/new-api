import { isJSDOM } from '#test-utils';
import { visuallyHidden, visuallyHiddenInput } from '@base-ui/utils/visuallyHidden';
import { isTabbable, tabbable } from './tabbable';

afterEach(() => {
  document.body.innerHTML = '';
});

it('includes basic tabbable controls and excludes hidden inputs', () => {
  const button = document.createElement('button');
  const input = document.createElement('input');
  const hiddenInput = document.createElement('input');

  hiddenInput.type = 'hidden';
  document.body.append(button, input, hiddenInput);

  expect(tabbable(document.body)).toEqual([button, input]);
});

it('includes embedded focusable elements in the tab order', () => {
  const iframe = document.createElement('iframe');

  document.body.append(iframe);

  expect(tabbable(document.body)).toContain(iframe);
});

it('excludes disabled controls from the tab order', () => {
  const enabledButton = document.createElement('button');
  const disabledButton = document.createElement('button');

  disabledButton.disabled = true;
  document.body.append(enabledButton, disabledButton);

  expect(tabbable(document.body)).toEqual([enabledButton]);
});

it('includes slotted light DOM elements in the tab order', () => {
  const host = document.createElement('div');
  const shadowRoot = host.attachShadow({ mode: 'open' });
  const slot = document.createElement('slot');
  const button = document.createElement('button');

  shadowRoot.appendChild(slot);
  host.appendChild(button);
  document.body.appendChild(host);

  expect(tabbable(document.body)).toContain(button);
});

it('excludes unslotted light DOM elements from a shadow host tab order', () => {
  const host = document.createElement('div');
  const shadowRoot = host.attachShadow({ mode: 'open' });
  const shadowButton = document.createElement('button');
  const hiddenLightButton = document.createElement('button');

  shadowRoot.appendChild(shadowButton);
  host.appendChild(hiddenLightButton);
  document.body.appendChild(host);

  const tabbableElements = tabbable(document.body);

  expect(tabbableElements).toContain(shadowButton);
  expect(tabbableElements).not.toContain(hiddenLightButton);
});

it('keeps the summary tabbable but excludes closed details content', () => {
  const details = document.createElement('details');
  const summary = document.createElement('summary');
  const button = document.createElement('button');

  summary.textContent = 'Summary';
  button.textContent = 'Hidden';
  details.append(summary, button);
  document.body.append(details);

  expect(tabbable(document.body)).toContain(summary);
  expect(tabbable(document.body)).not.toContain(button);
});

it('keeps only the first summary tabbable and includes details without a summary', () => {
  const closedDetails = document.createElement('details');
  const closedSummary = document.createElement('summary');
  const hiddenButton = document.createElement('button');
  const openDetails = document.createElement('details');
  const openSummary = document.createElement('summary');
  const ignoredSummary = document.createElement('summary');
  const visibleButton = document.createElement('button');
  const summarylessDetails = document.createElement('details');

  openDetails.open = true;

  closedSummary.textContent = 'closed';
  openSummary.textContent = 'open';
  ignoredSummary.textContent = 'ignored';

  closedDetails.append(closedSummary, hiddenButton);
  openDetails.append(openSummary, ignoredSummary, visibleButton);
  summarylessDetails.textContent = 'summaryless';

  document.body.append(closedDetails, openDetails, summarylessDetails);

  expect(tabbable(document.body)).toEqual([
    closedSummary,
    openSummary,
    visibleButton,
    summarylessDetails,
  ]);
});

it('keeps aria-disabled elements in the tab order', () => {
  const element = document.createElement('div');

  element.tabIndex = 0;
  element.setAttribute('aria-disabled', 'true');
  document.body.append(element);

  expect(isTabbable(element)).toBe(true);
  expect(tabbable(document.body)).toContain(element);
});

it('excludes elements hidden with CSS visibility from the tab order', () => {
  const button = document.createElement('button');

  button.style.visibility = 'hidden';
  document.body.append(button);

  expect(isTabbable(button)).toBe(false);
  expect(tabbable(document.body)).not.toContain(button);
});

it('keeps descendants of display: contents ancestors in the tab order', () => {
  const wrapper = document.createElement('div');
  const dialog = document.createElement('div');
  const button = document.createElement('button');

  wrapper.style.display = 'contents';
  Object.defineProperty(wrapper, 'checkVisibility', {
    configurable: true,
    value: () => false,
  });
  dialog.setAttribute('role', 'dialog');
  dialog.append(button);
  wrapper.append(dialog);
  document.body.append(wrapper);

  expect(isTabbable(button)).toBe(true);
  expect(tabbable(document.body)).toContain(button);
});

it.skipIf(isJSDOM)(
  'keeps visible descendants of display: contents ancestors in the tab order in Chromium',
  () => {
    const wrapper = document.createElement('div');
    const button = document.createElement('button');

    wrapper.style.display = 'contents';
    wrapper.tabIndex = 0;
    wrapper.append(button);
    document.body.append(wrapper);

    expect(isTabbable(wrapper)).toBe(false);
    expect(isTabbable(button)).toBe(true);
    expect(tabbable(document.body)).toContain(button);
    expect(tabbable(document.body)).not.toContain(wrapper);
  },
);

it('excludes descendants of hidden display: contents ancestors from the tab order', () => {
  const wrapper = document.createElement('div');
  const button = document.createElement('button');

  wrapper.style.display = 'contents';
  wrapper.style.visibility = 'hidden';
  wrapper.append(button);
  document.body.append(wrapper);

  expect(isTabbable(button)).toBe(false);
  expect(tabbable(document.body)).not.toContain(button);
});

it('keeps descendants that override ancestor visibility in the tab order', () => {
  const wrapper = document.createElement('div');
  const button = document.createElement('button');

  wrapper.style.visibility = 'hidden';
  button.style.visibility = 'visible';
  wrapper.append(button);
  document.body.append(wrapper);

  expect(isTabbable(button)).toBe(true);
  expect(tabbable(document.body)).toContain(button);
});

it('excludes display: contents candidates when checkVisibility reports them hidden', () => {
  const button = document.createElement('button');

  button.style.display = 'contents';
  Object.defineProperty(button, 'checkVisibility', {
    configurable: true,
    value: () => false,
  });
  document.body.append(button);

  expect(isTabbable(button)).toBe(false);
  expect(tabbable(document.body)).not.toContain(button);
});

it('excludes display: contents candidates when checkVisibility is unavailable', () => {
  const button = document.createElement('button');

  button.style.display = 'contents';
  Object.defineProperty(button, 'checkVisibility', {
    configurable: true,
    value: undefined,
  });
  document.body.append(button);

  expect(isTabbable(button)).toBe(false);
  expect(tabbable(document.body)).not.toContain(button);
});

it('excludes descendants of display: none ancestors from the tab order', () => {
  const wrapper = document.createElement('div');
  const button = document.createElement('button');

  wrapper.style.display = 'none';
  wrapper.append(button);
  document.body.append(wrapper);

  expect(isTabbable(button)).toBe(false);
  expect(tabbable(document.body)).not.toContain(button);
});

it.skipIf(isJSDOM)(
  'excludes descendants of block content-visibility:hidden ancestors from the tab order',
  () => {
    const wrapper = document.createElement('div');
    const button = document.createElement('button');

    wrapper.style.setProperty('content-visibility', 'hidden');
    wrapper.append(button);
    document.body.append(wrapper);

    expect(isTabbable(button)).toBe(false);
    expect(tabbable(document.body)).not.toContain(button);
  },
);

it.skipIf(isJSDOM)(
  'keeps descendants of display: contents content-visibility:hidden ancestors in the tab order',
  () => {
    const wrapper = document.createElement('div');
    const button = document.createElement('button');

    wrapper.style.display = 'contents';
    wrapper.style.setProperty('content-visibility', 'hidden');
    wrapper.append(button);
    document.body.append(wrapper);

    expect(isTabbable(button)).toBe(true);
    expect(tabbable(document.body)).toContain(button);
  },
);

it.skipIf(isJSDOM)(
  'keeps descendants of inline content-visibility:hidden ancestors in the tab order',
  () => {
    const wrapper = document.createElement('div');
    const button = document.createElement('button');

    wrapper.style.display = 'inline';
    wrapper.style.setProperty('content-visibility', 'hidden');
    wrapper.append(button);
    document.body.append(wrapper);

    expect(isTabbable(button)).toBe(true);
    expect(tabbable(document.body)).toContain(button);
  },
);

it.skipIf(isJSDOM)('keeps content-visibility:hidden candidates in the tab order', () => {
  const button = document.createElement('button');

  button.style.setProperty('content-visibility', 'hidden');
  document.body.append(button);

  expect(isTabbable(button)).toBe(true);
  expect(tabbable(document.body)).toContain(button);
});

it.skipIf(isJSDOM)('keeps zero-size elements in the tab order', () => {
  const element = document.createElement('div');

  element.tabIndex = 0;
  element.style.width = '0';
  element.style.height = '0';
  element.style.padding = '0';
  element.style.border = '0';
  document.body.append(element);

  expect(isTabbable(element)).toBe(true);
  expect(tabbable(document.body)).toContain(element);
});

it('keeps visuallyHidden elements in the tab order', () => {
  const button = document.createElement('button');

  Object.assign(button.style, visuallyHidden);
  document.body.append(button);

  expect(isTabbable(button)).toBe(true);
  expect(tabbable(document.body)).toContain(button);
});

it('keeps visuallyHiddenInput elements in the tab order', () => {
  const input = document.createElement('input');

  input.type = 'checkbox';
  Object.assign(input.style, visuallyHiddenInput);
  document.body.append(input);

  expect(isTabbable(input)).toBe(true);
  expect(tabbable(document.body)).toContain(input);
});

it('keeps only the checked radio in a named group', () => {
  const firstRadio = document.createElement('input');
  const checkedRadio = document.createElement('input');
  const button = document.createElement('button');

  firstRadio.type = 'radio';
  firstRadio.name = 'group';
  checkedRadio.type = 'radio';
  checkedRadio.name = 'group';
  checkedRadio.checked = true;

  document.body.append(firstRadio, checkedRadio, button);

  const tabbableElements = tabbable(document.body);

  expect(tabbableElements).not.toContain(firstRadio);
  expect(tabbableElements).toContain(checkedRadio);
  expect(tabbableElements).toContain(button);
});

it('keeps only the first radio when a named group has no checked item', () => {
  const firstRadio = document.createElement('input');
  const secondRadio = document.createElement('input');

  firstRadio.type = 'radio';
  firstRadio.name = 'group';
  secondRadio.type = 'radio';
  secondRadio.name = 'group';

  document.body.append(firstRadio, secondRadio);

  const tabbableElements = tabbable(document.body);

  expect(tabbableElements).toContain(firstRadio);
  expect(tabbableElements).not.toContain(secondRadio);
});

it('treats slotted elements inside inert shadow content as untabbable', () => {
  const host = document.createElement('div');
  const shadowRoot = host.attachShadow({ mode: 'open' });
  const wrapper = document.createElement('div');
  const slot = document.createElement('slot');
  const button = document.createElement('button');

  wrapper.setAttribute('inert', '');
  wrapper.appendChild(slot);
  shadowRoot.appendChild(wrapper);
  host.appendChild(button);
  document.body.appendChild(host);

  expect(tabbable(document.body)).not.toContain(button);
});
