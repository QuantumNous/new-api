import { expect } from 'vitest';
import { getNumberLocaleDetails, parseNumber } from './parse';

describe('NumberField parse', () => {
  describe('getNumberLocaleDetails', () => {
    it('returns the number locale details', () => {
      const details = getNumberLocaleDetails('en-US');
      expect(details.decimal).toBe('.');
      expect(details.group).toBe(',');
      expect(details.currency).toBe(undefined);
      expect(details.percent).toBe(undefined);
      expect(details.unit).toBe(undefined);
    });
  });

  describe('parseNumber', () => {
    it('parses a number', () => {
      const numberString = new Intl.NumberFormat().format(1234.56);
      expect(parseNumber(numberString)).toBe(1234.56);
    });

    it('parses percentages by default', () => {
      expect(parseNumber('12%')).toBe(0.12);
    });

    it('parses a number with Arabic numerals', ({ skip }) => {
      // Skip in browser as it doesn't support Arabic numerals.
      skip();
      expect(parseNumber('١٬٢٣٤٫٥٦')).toBe(1234.56);
    });

    it('parses a number with Han numerals', () => {
      expect(parseNumber('一,二三四.五六')).toBe(1234.56);
    });

    it('parses percentages with Arabic numerals', () => {
      expect(parseNumber('١٢٪')).toBe(0.12);
    });

    it('parses percentages with Han numerals', () => {
      expect(parseNumber('一二%')).toBe(0.12);
    });

    it('returns null for an invalid number', () => {
      expect(parseNumber('invalid')).toBe(null);
    });

    it('handles percentages with style: "percent"', () => {
      expect(parseNumber('12%', 'en-US', { style: 'percent' })).toBe(0.12);
    });

    it('parses prefix percentages', () => {
      const format = { style: 'percent', maximumFractionDigits: 2 } as const;
      const formatted = new Intl.NumberFormat('tr-TR', format).format(0.0123);

      expect(parseNumber(formatted, 'tr-TR', format)).toBe(0.0123);
    });

    it('parses scientific notation percentages', () => {
      expect(parseNumber('1e-7%', 'en-US', { style: 'percent' })).toBe(1e-9);
    });

    it('handles percentages with style: "unit" and unit: "percent"', () => {
      expect(parseNumber('12%', 'en-US', { style: 'unit', unit: 'percent' })).toBe(12);
    });

    it('parses fullwidth digits and punctuation', () => {
      expect(parseNumber('１，２３４．５６')).toBe(1234.56);
      expect(parseNumber('１２％')).toBe(0.12);
    });

    it('parses Persian digits', () => {
      expect(parseNumber('۱۲۳۴')).toBe(1234);
      expect(parseNumber('۱۲٫۳۴')).toBe(12.34);
      expect(parseNumber('۱۲٪')).toBe(0.12);
    });

    it('parses Persian digits with Arabic thousands and decimal characters', () => {
      // Uses Persian digits + Arabic separators (common in copied text)
      expect(parseNumber('۱۲٬۳۴۵٫۶۷')).toBe(12345.67);
    });

    it('parses permille values', () => {
      expect(parseNumber('12‰')).toBe(0.012);
      expect(parseNumber('12؉')).toBe(0.012);
    });

    it('strips bidi/control characters', () => {
      expect(parseNumber('1\u200E234.56')).toBe(1234.56);
      expect(parseNumber('\u200E12\u200F%')).toBe(0.12);
    });

    it('handles unicode minus and plus signs', () => {
      expect(parseNumber('−1234')).toBe(-1234);
      expect(parseNumber('1234−')).toBe(-1234);
      expect(parseNumber('＋1234')).toBe(1234);
      expect(parseNumber('1234＋')).toBe(1234);
    });

    it('parses french formatted numbers with narrow no-break space grouping', () => {
      const fr = new Intl.NumberFormat('fr-FR').format(1234.5); // e.g., '1 234,5'
      expect(parseNumber(fr, 'fr-FR')).toBe(1234.5);
      expect(parseNumber(`${fr}−`, 'fr-FR')).toBe(-1234.5);
    });

    it('parses currency when options specify currency style', () => {
      expect(parseNumber('$1,234.56', 'en-US', { style: 'currency', currency: 'USD' })).toBe(
        1234.56,
      );
    });

    it('parses scientific notation with currency codes', () => {
      const format = {
        style: 'currency',
        currency: 'EUR',
        currencyDisplay: 'code',
        notation: 'scientific',
        maximumFractionDigits: 2,
      } as const;
      const formatted = new Intl.NumberFormat('en-US', format).format(12345);

      expect(parseNumber(formatted, 'en-US', format)).toBe(12300);
    });

    it.each(['ar-EG', 'fa-IR'] as const)(
      'parses localized scientific notation for %s',
      (locale) => {
        const format = { notation: 'scientific', maximumFractionDigits: 2 } as const;
        const formatted = new Intl.NumberFormat(locale, format).format(12345);

        expect(parseNumber(formatted, locale, format)).toBe(12300);
      },
    );

    it.each(['ar-EG', 'fa-IR'] as const)(
      'parses localized percent scientific notation with a negative exponent for %s',
      (locale) => {
        const format = {
          style: 'percent',
          notation: 'scientific',
          maximumFractionDigits: 2,
        } as const;
        const value = 0.0000012345;
        const formatted = new Intl.NumberFormat(locale, format).format(value);

        expect(parseNumber(formatted, locale, format)).toBe(0.00000123);
      },
    );

    it.each(['ar-EG', 'fa-IR'] as const)(
      'parses localized tiny percent scientific notation for %s',
      (locale) => {
        const format = {
          style: 'percent',
          notation: 'scientific',
          maximumFractionDigits: 2,
        } as const;
        const value = 0.0000000000012345;
        const formatted = new Intl.NumberFormat(locale, format).format(value);

        expect(parseNumber(formatted, locale, format)).toBe(0.00000000000123);
      },
    );

    it('parses scientific notation permille values', () => {
      expect(parseNumber('1e-7‰', 'en-US')).toBe(1e-10);
    });

    it('parses units when options specify unit style', () => {
      expect(parseNumber('12 kg', 'en-US', { style: 'unit', unit: 'kilogram' })).toBe(12);
    });

    it('returns null for Infinity-like inputs', () => {
      expect(parseNumber('Infinity')).toBe(null);
      expect(parseNumber('-Infinity')).toBe(null);
      expect(parseNumber('∞')).toBe(null);
    });

    it('returns null when parsing overflows to Infinity', () => {
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'percent',
        maximumFractionDigits: 2,
      }).format(Number.MAX_VALUE);

      expect(parseNumber(formatted, 'en-US', { style: 'percent' })).toBe(null);
    });

    it('collapses extra dots from mixed-locale inputs', () => {
      // Last '.' is decimal; previous '.' are removed
      expect(parseNumber('1.234.567.89')).toBe(1234567.89);
    });

    it('parses number with mixed separators (FR)', () => {
      expect(parseNumber('1.234.567,89', 'fr-FR')).toBe(1234567.89);
    });

    it('parses number with mixed separators (US)', () => {
      expect(parseNumber('1.234.567,89', 'en-US')).toBe(1234.56789);
    });

    it('returns null for empty and whitespace-only input', () => {
      expect(parseNumber('')).toBe(null);
      expect(parseNumber('   ')).toBe(null);
    });

    it('returns null for just a sign', () => {
      expect(parseNumber('-')).toBe(null);
      expect(parseNumber('+')).toBe(null);
    });

    it('handles ASCII leading and trailing signs', () => {
      expect(parseNumber('+1234')).toBe(1234);
      expect(parseNumber('1234+')).toBe(1234);
      expect(parseNumber('-1234')).toBe(-1234);
      expect(parseNumber('1234-')).toBe(-1234);
    });

    it('supports multiple unicode minus variants', () => {
      expect(parseNumber('‒123')).toBe(-123); // figure dash
      expect(parseNumber('–123')).toBe(-123); // en dash
      expect(parseNumber('—123')).toBe(-123); // em dash
      expect(parseNumber('－123')).toBe(-123); // fullwidth hyphen-minus
      expect(parseNumber('﹣123')).toBe(-123); // small hyphen-minus
    });

    it('supports additional unicode plus variants', () => {
      expect(parseNumber('﹢123')).toBe(123); // small plus sign
    });

    it('handles additional percent symbol variants', () => {
      expect(parseNumber('12％')).toBe(0.12); // fullwidth percent
      expect(parseNumber('12﹪')).toBe(0.12); // small percent
      expect(parseNumber('12٪')).toBe(0.12); // Arabic percent sign with ASCII digits
    });

    it('parses Arabic punctuation with ASCII digits', () => {
      expect(parseNumber('1٬234٫56')).toBe(1234.56);
    });

    it('removes various Unicode space groupings (fr-FR)', () => {
      expect(parseNumber('1\u202F234,56', 'fr-FR')).toBe(1234.56); // narrow no-break space
      expect(parseNumber('1\u2009234,56', 'fr-FR')).toBe(1234.56); // thin space
      expect(parseNumber('1\u2007234,56', 'fr-FR')).toBe(1234.56); // figure space
      expect(parseNumber('1\u00A0234,56', 'fr-FR')).toBe(1234.56); // no-break space
    });

    it('handles Swiss grouping apostrophe', () => {
      // de-CH uses RIGHT SINGLE QUOTATION MARK (U+2019) as group separator on some platforms and straight apostrophe on others
      expect(parseNumber('1’234.56', 'de-CH')).toBe(1234.56);
      expect(parseNumber("1'234.56", 'de-CH')).toBe(1234.56);
    });

    it('parses de-DE formatted numbers', () => {
      expect(parseNumber('1.234,56', 'de-DE')).toBe(1234.56);
      expect(parseNumber('1.234.567,89', 'de-DE')).toBe(1234567.89);
    });

    it('parses currency prefix/suffix across locales', () => {
      const en = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(
        1234.56,
      );
      const fr = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(
        1234.56,
      );
      expect(parseNumber(en, 'en-US', { style: 'currency', currency: 'EUR' })).toBe(1234.56);
      expect(parseNumber(fr, 'fr-FR', { style: 'currency', currency: 'EUR' })).toBe(1234.56);
    });

    it('parses units with different formats', () => {
      expect(parseNumber('12 km/h', 'en-US', { style: 'unit', unit: 'kilometer-per-hour' })).toBe(
        12,
      );
      expect(parseNumber('12 m/s', 'en-US', { style: 'unit', unit: 'meter-per-second' })).toBe(12);
    });

    it('treats bidi/format controls as ignorable in the middle of input', () => {
      expect(parseNumber('1\u202A234\u202C.56')).toBe(1234.56); // LRE...PDF
      expect(parseNumber('\u202A12\u202C%')).toBe(0.12);
    });

    it('returns null for Infinity with explicit sign and surrounding spaces', () => {
      expect(parseNumber(' +Infinity ')).toBe(null);
      expect(parseNumber(' -∞ ')).toBe(null);
      expect(parseNumber('+Infinity')).toBe(null);
    });

    it('collapses multiple consecutive dots keeping only the last as decimal', () => {
      expect(parseNumber('1..5')).toBe(1.5);
      expect(parseNumber('123..456..789.01')).toBe(123456789.01);
      expect(parseNumber('....5')).toBe(0.5);
    });
  });
});
