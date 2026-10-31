import { expect } from 'vitest';
import { toValidatedNumber, removeFloatingPointErrors } from './validate';

const min = Number.MIN_SAFE_INTEGER;
const max = Number.MAX_SAFE_INTEGER;

const defaultOptions = {
  step: 1,
  minWithDefault: min,
  maxWithDefault: max,
  minWithZeroDefault: 0,
  format: undefined,
  snapOnStep: true,
  small: false,
  clamp: true,
} as const;

describe('NumberField validate', () => {
  describe('removeFloatingPointErrors', () => {
    it('returns 0.3 for 0.2 + 0.1', () => {
      expect(removeFloatingPointErrors(0.2 + 0.1)).toBe(0.3);
    });

    it('cleans negative floating point noise without a format', () => {
      expect(removeFloatingPointErrors(-0.1 - 0.2)).toBe(-0.3);
    });

    it('preserves precision finer than 3 fraction digits without a format', () => {
      expect(removeFloatingPointErrors(0.0005)).toBe(0.0005);
      expect(removeFloatingPointErrors(1.23456)).toBe(1.23456);
    });

    it('preserves safe integers exactly without a format', () => {
      expect(removeFloatingPointErrors(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
      expect(removeFloatingPointErrors(Number.MIN_SAFE_INTEGER)).toBe(Number.MIN_SAFE_INTEGER);
    });

    it('cleans 16-digit noise patterns from arithmetic', () => {
      expect(removeFloatingPointErrors(0.1 + 0.7)).toBe(0.8);
      expect(removeFloatingPointErrors(0.1 + 0.2 + 0.3)).toBe(0.6);
    });

    it('leaves large-magnitude noise uncleaned once one ULP exceeds the absolute cap', () => {
      // From the 2^19 binade (~5.2e5) up, a single ULP exceeds MAX_FLOATING_POINT_CLEANUP_DELTA,
      // so the delta-bounded cleanup returns the raw (noisy) sum rather than risk corrupting
      // real precision.
      expect(removeFloatingPointErrors(1000000.1 + 0.2)).toBe(1000000.1 + 0.2);
      expect(removeFloatingPointErrors(1000000.1 + 0.2)).not.toBe(1000000.3);
    });

    it('returns 0.3 for 0.2 + 0.1 with maximumFractionDigits', () => {
      expect(removeFloatingPointErrors(0.2 + 0.1, { maximumFractionDigits: 1 })).toBe(0.3);
    });

    it('respects roundingMode when maximumFractionDigits is provided', () => {
      expect(
        removeFloatingPointErrors(1.239, {
          maximumFractionDigits: 2,
          roundingMode: 'floor',
        }),
      ).toBe(1.23);
    });

    it('respects half-even rounding at ties', () => {
      expect(
        removeFloatingPointErrors(1.235, {
          maximumFractionDigits: 2,
          roundingMode: 'halfEven',
        }),
      ).toBe(1.24);
      expect(
        removeFloatingPointErrors(1.245, {
          maximumFractionDigits: 2,
          roundingMode: 'halfEven',
        }),
      ).toBe(1.24);
    });

    it('respects rounding mode differences for negative values', () => {
      expect(
        removeFloatingPointErrors(-1.239, {
          maximumFractionDigits: 2,
          roundingMode: 'floor',
        }),
      ).toBe(-1.24);
      expect(
        removeFloatingPointErrors(-1.239, {
          maximumFractionDigits: 2,
          roundingMode: 'trunc',
        }),
      ).toBe(-1.23);
    });

    it('rounds percent values at display scale when maximumFractionDigits is provided', () => {
      expect(
        removeFloatingPointErrors(0.01236, {
          style: 'percent',
          maximumFractionDigits: 2,
        }),
      ).toBe(0.0124);
      expect(
        removeFloatingPointErrors(0.01239, {
          style: 'percent',
          maximumFractionDigits: 2,
          roundingMode: 'floor',
        }),
      ).toBe(0.0123);
    });

    it.each(['floor', 'ceil', 'trunc', 'expand'] as const)(
      'preserves exact percent precision boundaries with roundingMode: %s',
      (roundingMode) => {
        expect(
          removeFloatingPointErrors(0.0046, {
            style: 'percent',
            maximumFractionDigits: 2,
            roundingMode,
          }),
        ).toBe(0.0046);
      },
    );

    it('rounds percent values at display scale when only minimumFractionDigits is provided', () => {
      expect(
        removeFloatingPointErrors(0.01239, {
          style: 'percent',
          minimumFractionDigits: 2,
          roundingMode: 'floor',
        }),
      ).toBe(0.0123);
    });

    it('rounds values with significant digit precision', () => {
      expect(
        removeFloatingPointErrors(12345, {
          maximumSignificantDigits: 3,
          roundingMode: 'floor',
        }),
      ).toBe(12300);
    });

    it('rounds percent values at display scale when significant digits are provided', () => {
      expect(
        removeFloatingPointErrors(0.01239, {
          style: 'percent',
          maximumSignificantDigits: 3,
          roundingMode: 'floor',
        }),
      ).toBe(0.0123);
    });

    it('rounds percent significant digit values without reintroducing binary noise', () => {
      const format = {
        style: 'percent',
        maximumSignificantDigits: 2,
        roundingMode: 'floor',
      } as const;
      const rounded = removeFloatingPointErrors(0.009995, format);

      expect(rounded).toBe(0.0099);
      expect(new Intl.NumberFormat('en-US', format).format(rounded)).toBe(
        new Intl.NumberFormat('en-US', format).format(0.009995),
      );
    });

    it('preserves tiny percent significant digit values after scaling back', () => {
      const format = {
        style: 'percent',
        maximumSignificantDigits: 2,
      } as const;
      const value = 0.000001234;
      const rounded = removeFloatingPointErrors(value, format);

      expect(rounded).toBe(0.0000012);
      expect(new Intl.NumberFormat('en-US', format).format(rounded)).toBe(
        new Intl.NumberFormat('en-US', format).format(value),
      );
    });

    it('preserves meaningful percent precision above directional rounding boundaries', () => {
      const format = {
        style: 'percent',
        maximumFractionDigits: 2,
        roundingMode: 'ceil',
      } as const;
      const rounded = removeFloatingPointErrors(0.01230000001, format);

      expect(rounded).toBe(0.0124);
      expect(new Intl.NumberFormat('en-US', format).format(rounded)).toBe(
        new Intl.NumberFormat('en-US', format).format(0.01230000001),
      );
    });

    it('preserves high-precision percent fraction digits', () => {
      const format = {
        style: 'percent',
        maximumFractionDigits: 16,
      } as const;
      const value = 0.001234567890123456;

      expect(removeFloatingPointErrors(value, format)).toBe(value);
    });

    it('preserves high-precision percent boundaries with directional rounding', () => {
      const format = {
        style: 'percent',
        maximumFractionDigits: 16,
        roundingMode: 'floor',
      } as const;
      const value = 0.0046;
      const rounded = removeFloatingPointErrors(value, format);

      expect(rounded).toBe(value);
      expect(new Intl.NumberFormat('en-US', format).format(rounded)).toBe(
        new Intl.NumberFormat('en-US', format).format(value),
      );
    });

    it('preserves tiny values when Intl supports more than 20 fraction digits', () => {
      expect(removeFloatingPointErrors(1e-21, { maximumFractionDigits: 21 })).toBe(1e-21);
    });

    it('uses percent fraction defaults when significant digits use roundingPriority', () => {
      const format = {
        style: 'percent',
        maximumSignificantDigits: 3,
        roundingPriority: 'morePrecision',
      } as const;
      const rounded = removeFloatingPointErrors(0.0123456, format);

      expect(rounded).toBe(0.0123);
      expect(new Intl.NumberFormat('en-US', format).format(rounded)).toBe(
        new Intl.NumberFormat('en-US', format).format(0.0123456),
      );
    });

    it('respects roundingPriority when fraction and significant digits are provided', () => {
      expect(
        removeFloatingPointErrors(1.2399, {
          minimumFractionDigits: 2,
          maximumSignificantDigits: 3,
          roundingMode: 'floor',
          roundingPriority: 'morePrecision',
        }),
      ).toBe(1.239);
    });

    it('does not scale unit percent values when maximumFractionDigits is provided', () => {
      expect(
        removeFloatingPointErrors(1.239, {
          style: 'unit',
          unit: 'percent',
          maximumFractionDigits: 2,
          roundingMode: 'floor',
        }),
      ).toBe(1.23);
    });

    it('rounds currency values without percent scaling', () => {
      expect(
        removeFloatingPointErrors(1.239, {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 2,
          roundingMode: 'floor',
        }),
      ).toBe(1.23);
    });

    it('rounds scientific currency code values', () => {
      const format = {
        style: 'currency',
        currency: 'EUR',
        currencyDisplay: 'code',
        notation: 'scientific',
        maximumFractionDigits: 2,
      } as const;

      expect(removeFloatingPointErrors(12345, format)).toBe(12300);
    });

    it('preserves negative values when signDisplay hides the sign', () => {
      const format = {
        maximumFractionDigits: 2,
        signDisplay: 'never',
      } as const;
      const rounded = removeFloatingPointErrors(-1.239, format);

      expect(rounded).toBe(-1.24);
      expect(new Intl.NumberFormat('en-US', format).format(rounded)).toBe(
        new Intl.NumberFormat('en-US', format).format(-1.239),
      );
    });

    it('rounds negative accounting currency values', () => {
      const format = {
        style: 'currency',
        currency: 'USD',
        currencySign: 'accounting',
        maximumFractionDigits: 2,
      } as const;
      const rounded = removeFloatingPointErrors(-1.239, format);

      expect(rounded).toBe(-1.24);
      expect(new Intl.NumberFormat('en-US', format).format(rounded)).toBe(
        new Intl.NumberFormat('en-US', format).format(-1.239),
      );
    });

    it('respects roundingMode when no precision is provided', () => {
      expect(
        removeFloatingPointErrors(1.2399, {
          minimumIntegerDigits: 1,
          roundingMode: 'floor',
        }),
      ).toBe(1.239);
    });

    it('respects roundingIncrement when maximumFractionDigits is provided', () => {
      expect(
        removeFloatingPointErrors(1.26, {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
          roundingIncrement: 5,
        }),
      ).toBe(1.5);
    });

    it('keeps the original finite value when percent scaling overflows before Intl rounding', () => {
      expect(
        removeFloatingPointErrors(Number.MAX_VALUE, {
          style: 'percent',
          maximumFractionDigits: 2,
          roundingMode: 'floor',
        }),
      ).toBe(Number.MAX_VALUE);
    });

    it('rounds scientific notation values at their formatted scale', () => {
      const format = {
        notation: 'scientific',
        maximumFractionDigits: 2,
      } as const;
      const rounded = removeFloatingPointErrors(0.000123456, format);

      expect(rounded).toBe(0.000123);
      expect(new Intl.NumberFormat('en-US', format).format(rounded)).toBe(
        new Intl.NumberFormat('en-US', format).format(0.000123456),
      );
    });

    it('preserves non-invertible scientific rounded zero buckets', () => {
      const format = {
        notation: 'scientific',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
        roundingIncrement: 5,
      } as const;
      const value = 12345;
      const rounded = removeFloatingPointErrors(value, format);

      expect(rounded).toBe(value);
      expect(new Intl.NumberFormat('en-US', format).format(rounded)).toBe(
        new Intl.NumberFormat('en-US', format).format(value),
      );
    });

    it('rounds invertible scientific zero buckets', () => {
      expect(
        removeFloatingPointErrors(1, {
          notation: 'scientific',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
          roundingIncrement: 5,
        }),
      ).toBe(0);
    });

    it('returns 1000 for 1000, ignoring grouping', () => {
      expect(removeFloatingPointErrors(1000)).toBe(1000);
    });

    it('ignores formatting style', () => {
      expect(removeFloatingPointErrors(1000, { style: 'currency', currency: 'USD' })).toBe(1000);
    });

    it('uses resolved maximumFractionDigits when only minimum is provided', () => {
      expect(removeFloatingPointErrors(1.234567, { minimumFractionDigits: 5 })).toBe(1.23457);
    });
  });

  describe('toValidatedNumber', () => {
    it('returns null when value is null', () => {
      expect(toValidatedNumber(null, defaultOptions)).toBe(null);
    });

    it('skips clamping when clamp is false', () => {
      expect(
        toValidatedNumber(12, {
          ...defaultOptions,
          minWithDefault: 0,
          maxWithDefault: 10,
          step: undefined,
          snapOnStep: false,
          clamp: false,
        }),
      ).toBe(12);
    });

    it('preserves parsed input beyond 15 significant digits when step is undefined', () => {
      // Parsed input performs no arithmetic, so there is no binary noise to clean.
      expect(toValidatedNumber(1.234567890123456, { ...defaultOptions, step: undefined })).toBe(
        1.234567890123456,
      );
      expect(toValidatedNumber(0.1234567890123456, { ...defaultOptions, step: undefined })).toBe(
        0.1234567890123456,
      );
    });

    it('cleans arithmetic noise when stepping', () => {
      expect(
        toValidatedNumber(0.1 + 0.7, { ...defaultOptions, step: 0.1, snapOnStep: false }),
      ).toBe(0.8);
    });

    it('preserves large fractional values when stepping cleanup would be too coarse', () => {
      const steppedValue = 100000000000000.1 + 0.1;

      expect(
        toValidatedNumber(steppedValue, { ...defaultOptions, step: 0.1, snapOnStep: false }),
      ).toBe(steppedValue);
    });

    it('preserves high-significance step values', () => {
      const step = 0.1234567890123456;

      expect(
        toValidatedNumber(step, {
          ...defaultOptions,
          step,
          snapOnStep: false,
        }),
      ).toBe(step);
    });

    describe('incrementing', () => {
      it('snaps 5 to 5 when step is 1', () => {
        expect(toValidatedNumber(5, defaultOptions)).toBe(5);
      });

      it('snaps 5.5 to 5 when step is 1', () => {
        expect(toValidatedNumber(5.5, defaultOptions)).toBe(5);
      });

      it('snaps -0.3 to -1 when step is 1', () => {
        expect(toValidatedNumber(-0.3, defaultOptions)).toBe(-1);
      });

      it('be same value when step is undefined and within bounds', () => {
        expect(
          toValidatedNumber(5.5, {
            ...defaultOptions,
            step: undefined,
          }),
        ).toBe(5.5);
      });

      it('snaps 9 to 5 when step is 5 and within bounds', () => {
        expect(
          toValidatedNumber(9, {
            ...defaultOptions,
            step: 5,
          }),
        ).toBe(5);
      });

      it('snaps 12 to 10 when step is 5 and within bounds', () => {
        expect(
          toValidatedNumber(12, {
            ...defaultOptions,
            step: 5,
          }),
        ).toBe(10);
      });

      it('preserves exact value when snapOnStep is false', () => {
        expect(
          toValidatedNumber(9.7, {
            ...defaultOptions,
            step: 5,
            snapOnStep: false,
          }),
        ).toBe(9.7);
      });
    });

    describe('decrementing', () => {
      it('snaps 5 to 5 when step is -1', () => {
        expect(
          toValidatedNumber(5, {
            ...defaultOptions,
            step: -1,
          }),
        ).toBe(5);
      });

      it('snaps 5.5 to 6 when step is -1', () => {
        expect(
          toValidatedNumber(5.5, {
            ...defaultOptions,
            step: -1,
          }),
        ).toBe(6);
      });

      it('snaps -0.3 to 0 when step is -1', () => {
        expect(
          toValidatedNumber(-0.3, {
            ...defaultOptions,
            step: -1,
          }),
        ).toBe(0);
      });

      it('be same value when step is undefined and within bounds', () => {
        expect(
          toValidatedNumber(5.5, {
            ...defaultOptions,
            step: undefined,
          }),
        ).toBe(5.5);
      });

      it('snaps 9 to 10 when step is -5', () => {
        expect(
          toValidatedNumber(9, {
            ...defaultOptions,
            step: -5,
          }),
        ).toBe(10);
      });

      it('snaps 12 to 15 when step is -5', () => {
        expect(
          toValidatedNumber(12, {
            ...defaultOptions,
            step: -5,
          }),
        ).toBe(15);
      });

      it('preserves exact value when snapOnStep is false', () => {
        expect(
          toValidatedNumber(12.3, {
            ...defaultOptions,
            step: -5,
            snapOnStep: false,
          }),
        ).toBe(12.3);
      });
    });
  });

  it('applies roundingMode after step validation', () => {
    expect(
      toValidatedNumber(1.239, {
        ...defaultOptions,
        step: 0.001,
        snapOnStep: true,
        format: {
          maximumFractionDigits: 2,
          roundingMode: 'floor',
        },
      }),
    ).toBe(1.23);
  });

  it('clamps the final value after percent rounding crosses max', () => {
    expect(
      toValidatedNumber(0.01236, {
        ...defaultOptions,
        step: undefined,
        snapOnStep: false,
        maxWithDefault: 0.01235,
        format: {
          style: 'percent',
          maximumFractionDigits: 2,
        },
      }),
    ).toBe(0.01235);
  });

  it('clamps the final value after directional percent rounding crosses min', () => {
    expect(
      toValidatedNumber(0.01234, {
        ...defaultOptions,
        step: undefined,
        snapOnStep: false,
        minWithDefault: 0.01235,
        minWithZeroDefault: 0.01235,
        format: {
          style: 'percent',
          maximumFractionDigits: 2,
          roundingMode: 'floor',
        },
      }),
    ).toBe(0.01235);
  });

  it('removes floating point errors when stepping', () => {
    expect(
      toValidatedNumber(0.2 + 0.1, {
        ...defaultOptions,
        step: 0.1,
        snapOnStep: false,
      }),
    ).toBe(0.3);
  });

  it('clamps before rounding for non-integer bounds', () => {
    // 0.4 is below min 0.6, so it's clamped to 0.6 first and the integer format rounds that to 1.
    // Rounding first would round 0.4 to 0, then clamp back up to 0.6, disagreeing with the
    // displayed "1". Both clamp passes (before and after rounding) are needed here.
    expect(
      toValidatedNumber(0.4, {
        ...defaultOptions,
        step: undefined,
        snapOnStep: false,
        minWithDefault: 0.6,
        minWithZeroDefault: 0,
        maxWithDefault: 10,
        format: { maximumFractionDigits: 0 },
      }),
    ).toBe(1);
  });

  describe('fractional step with snapOnStep', () => {
    it('handles increment with step 0.1 without getting stuck', () => {
      // Simulates incrementing 100.1 by 0.1: the raw value becomes 100.19999999999999
      // which should snap to 100.2, not back to 100.1
      expect(
        toValidatedNumber(100.1 + 0.1, {
          ...defaultOptions,
          step: 0.1,
          snapOnStep: true,
        }),
      ).toBe(100.2);
    });

    it('handles decrement with step -0.1 without getting stuck', () => {
      // Simulates decrementing 100.1 by 0.1
      expect(
        toValidatedNumber(100.1 - 0.1, {
          ...defaultOptions,
          step: -0.1,
          snapOnStep: true,
        }),
      ).toBe(100);
    });

    it('handles multiple increments with step 0.01', () => {
      expect(
        toValidatedNumber(0.01 + 0.01, {
          ...defaultOptions,
          step: 0.01,
          snapOnStep: true,
        }),
      ).toBe(0.02);
    });

    it('handles fractional step when a minimum is set', () => {
      expect(
        toValidatedNumber(3 + 0.2 + 0.2, {
          ...defaultOptions,
          step: 0.2,
          minWithDefault: 3,
          minWithZeroDefault: 3,
        }),
      ).toBe(3.4);
    });

    it('rounds to the nearest value when using small step', () => {
      expect(
        toValidatedNumber(0.15, {
          ...defaultOptions,
          step: 0.1,
          snapOnStep: true,
          small: true,
        }),
      ).toBe(0.2);
    });

    it('rounds negative small steps to the nearest value', () => {
      expect(
        toValidatedNumber(-0.15, {
          ...defaultOptions,
          step: -0.1,
          snapOnStep: true,
          small: true,
        }),
      ).toBe(-0.2);
    });
  });

  it('clamps to a non-step-aligned max after snapping so the boundary is reachable', () => {
    // Incrementing past max (raw 13) must land on max=10, not snap down to 9.
    expect(
      toValidatedNumber(13, {
        ...defaultOptions,
        step: 3,
        minWithDefault: 0,
        minWithZeroDefault: 0,
        maxWithDefault: 10,
      }),
    ).toBe(10);
  });

  it('clamps to a non-step-aligned min after snapping so the boundary is reachable', () => {
    // Decrementing past min (raw -13) must land on min=-10, not stay below the boundary.
    expect(
      toValidatedNumber(-13, {
        ...defaultOptions,
        step: -3,
        minWithDefault: -10,
        minWithZeroDefault: -10,
        maxWithDefault: 0,
      }),
    ).toBe(-10);
  });
});
