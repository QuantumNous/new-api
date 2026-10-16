import { describe, it, expect } from 'vitest';
import i18next from '../../src/i18next.js';

describe('i18next.use()', () => {
  describe('passing an undefined module', () => {
    it('it should throw accordingly', () => {
      const badFn = () => i18next.use(undefined);
      expect(badFn).to.throw(/undefined module/);
    });
  });

  describe('passing a module with wrong interface', () => {
    it('it should throw accordingly', () => {
      const badFn = () => i18next.use({});
      expect(badFn).to.throw(/wrong module/);
    });
  });
});
