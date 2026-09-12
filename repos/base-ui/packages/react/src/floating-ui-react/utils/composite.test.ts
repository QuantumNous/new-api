import { isElementVisible, isHiddenByStyles } from './composite';

afterEach(() => {
  document.body.innerHTML = '';
});

it('treats hidden visibility styles as hidden', () => {
  const hidden = document.createElement('div');
  const collapsed = document.createElement('div');
  const visible = document.createElement('div');

  hidden.style.visibility = 'hidden';
  collapsed.style.visibility = 'collapse';

  document.body.append(hidden, collapsed, visible);

  expect(isHiddenByStyles(getComputedStyle(hidden))).toBe(true);
  expect(isHiddenByStyles(getComputedStyle(collapsed))).toBe(true);
  expect(isHiddenByStyles(getComputedStyle(visible))).toBe(false);
});

it('uses CSS visibility fallbacks when checkVisibility is unavailable', () => {
  const visible = document.createElement('button');
  const displayHidden = document.createElement('button');
  const displayContents = document.createElement('button');
  const contentHidden = document.createElement('button');

  displayHidden.style.display = 'none';
  displayContents.style.display = 'contents';
  contentHidden.style.contentVisibility = 'hidden';
  Object.defineProperty(displayContents, 'checkVisibility', {
    configurable: true,
    value: undefined,
  });
  Object.defineProperty(contentHidden, 'checkVisibility', {
    configurable: true,
    value: undefined,
  });
  document.body.append(visible, displayHidden, displayContents, contentHidden);

  expect(isElementVisible(visible)).toBe(true);
  expect(isElementVisible(displayHidden)).toBe(false);
  expect(isElementVisible(displayContents)).toBe(false);
  expect(isElementVisible(contentHidden)).toBe(true);
});
