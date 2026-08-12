import { expect } from 'vitest';
import { getDefaultFormSubmitter } from './getDefaultFormSubmitter';

describe('getDefaultFormSubmitter', () => {
  function setup(html: string) {
    document.body.innerHTML = html;
    return document.querySelector<HTMLFormElement>('#test-form')!;
  }

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('returns the first submit button associated with the form', () => {
    const form = setup(`
      <button id="external-before" form="test-form" type="submit">External before</button>
      <form id="test-form">
        <input type="checkbox" />
        <button id="internal" type="submit">Internal</button>
      </form>
    `);

    expect(getDefaultFormSubmitter(form)).toBe(document.querySelector('#external-before'));
  });

  it('returns a disabled submit button when it is first in form.elements', () => {
    const form = setup(`
      <form id="test-form">
        <button id="disabled" type="submit" disabled>Disabled</button>
        <button id="enabled" type="submit">Enabled</button>
      </form>
    `);

    expect(getDefaultFormSubmitter(form)).toBe(document.querySelector('#disabled'));
  });

  it('supports buttons with the default submit type', () => {
    const form = setup(`
      <form id="test-form">
        <button id="default">Default</button>
        <button id="explicit" type="submit">Explicit</button>
      </form>
    `);

    expect(getDefaultFormSubmitter(form)).toBe(document.querySelector('#default'));
  });

  it('supports input submitters from form.elements and ignores non-submit controls', () => {
    const form = setup(`
      <form id="test-form">
        <button id="button" type="button">Button</button>
        <input id="reset" type="reset" />
        <input id="submit" type="submit" />
      </form>
    `);

    expect(getDefaultFormSubmitter(form)).toBe(document.querySelector('#submit'));
  });

  it('returns null when there is no default submitter', () => {
    const form = setup(`
      <form id="test-form">
        <input type="checkbox" />
        <button type="button">Button</button>
      </form>
    `);

    expect(getDefaultFormSubmitter(form)).toBe(null);
  });
});
