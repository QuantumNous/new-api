import { expect } from 'vitest';
import { getFormatter } from './formatNumber';

const getOptions = (): Intl.NumberFormatOptions => ({
  currency: 'USD',
  style: 'currency',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

describe('NumberField format', () => {
  describe('getFormatter', () => {
    it('caches the formatter based on options', () => {
      const formatter1 = getFormatter(undefined, getOptions());
      const formatter2 = getFormatter(undefined, getOptions());
      expect(formatter1).toBe(formatter2);
    });

    it('caches different Intl.Locale objects separately', () => {
      const formatter1 = getFormatter(new Intl.Locale('fr-FR'), getOptions());
      const formatter2 = getFormatter(new Intl.Locale('en-US'), getOptions());

      expect(formatter1).not.toBe(formatter2);
      expect(formatter1.resolvedOptions().locale).toBe('fr-FR');
      expect(formatter2.resolvedOptions().locale).toBe('en-US');
    });
  });

  describe('formatNumber', () => {
    it('formats a number', () => {
      const expected = new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'USD',
      }).format(1234.56);
      expect(getFormatter(undefined, getOptions()).format(1234.56)).toBe(expected);
    });

    it('formats a number with different options', () => {
      expect(getFormatter('en-US', { style: 'percent' }).format(0.1234)).toBe('12%');
    });
  });
});
