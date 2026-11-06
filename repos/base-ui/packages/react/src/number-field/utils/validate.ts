import { clamp } from '../../internals/clamp';
import { getFormatter } from '../../utils/formatNumber';
import { parseNumber } from './parse';

// A relative factor scaled by the step size when snapping (`stepSize * STEP_EPSILON_FACTOR`).
const STEP_EPSILON_FACTOR = 1e-10;
// An absolute cap (in the value's own units) on how far floating-point cleanup may move a value.
// Equal to `STEP_EPSILON_FACTOR` only by coincidence — the two are independent and may diverge.
const MAX_FLOATING_POINT_CLEANUP_DELTA = 1e-10;

// The repo compiles against es2022 Intl types, so model NumberFormat v3 options locally.
// Delete this once tsconfig.base.json includes es2023.
type NumberFormatOptionsWithRounding = Intl.NumberFormatOptions & {
  roundingIncrement?: number | undefined;
  roundingMode?: string | undefined;
  roundingPriority?: string | undefined;
};

export function hasNumberFormatRoundingOptions(
  format?: NumberFormatOptionsWithRounding,
): format is NumberFormatOptionsWithRounding {
  return (
    format?.maximumFractionDigits != null ||
    format?.minimumFractionDigits != null ||
    format?.maximumSignificantDigits != null ||
    format?.minimumSignificantDigits != null ||
    format?.roundingIncrement != null ||
    format?.roundingMode != null ||
    format?.roundingPriority != null
  );
}

export function removeFloatingPointErrors(value: number, format?: NumberFormatOptionsWithRounding) {
  if (!Number.isFinite(value)) {
    return value;
  }

  if (!hasNumberFormatRoundingOptions(format)) {
    // Clean binary floating-point noise (e.g. `0.1 + 0.2`) without discarding legitimate
    // precision. The cleanup is delta-bounded, so it cannot tell noise apart from real digits
    // that fall within the same epsilon: arithmetic that produces sub-epsilon precision (e.g.
    // accumulating a high-significance `step` past the first tick) is normalized to ~15
    // significant digits.
    const roundedValue = parseFloat(value.toPrecision(15));
    const cleanupDelta = Math.abs(roundedValue - value);
    // Cap the cleanup delta so `toPrecision(15)` cannot erase meaningful fractional values
    // at large magnitudes, where the relative epsilon alone is too permissive. The trade-off is
    // that from the `2^19` binade (~5.2e5) up, a single ULP exceeds the absolute cap, so genuine
    // stepping noise is left uncleaned there (e.g. `1000000.1 + 0.2` stays `1000000.2999999999`)
    // rather than risk corrupting real precision.
    const cleanupTolerance = Math.min(
      Number.EPSILON * Math.max(1, Math.abs(value)),
      MAX_FLOATING_POINT_CLEANUP_DELTA,
    );

    return cleanupDelta <= cleanupTolerance ? roundedValue : value;
  }

  const formatter = getFormatter('en-US', {
    ...format,
    // These options alter only display decoration, not numeric rounding.
    signDisplay: 'auto',
    currencySign: 'standard',
    notation: format.notation === 'compact' ? 'standard' : format.notation,
    useGrouping: false,
  } as NumberFormatOptionsWithRounding);
  const roundedText = formatter.format(value);
  const roundedValue = parseNumber(roundedText, 'en-US', format);

  if (roundedValue === null) {
    return value;
  }

  return formatter.format(roundedValue) === roundedText ? roundedValue : value;
}

function snapToStep(
  value: number,
  base: number,
  step: number,
  mode: 'directional' | 'nearest' = 'directional',
) {
  const stepSize = Math.abs(step);
  const direction = Math.sign(step);
  const tolerance = stepSize * STEP_EPSILON_FACTOR * direction;
  const rawSteps = value - base + tolerance;

  if (mode === 'nearest') {
    return base + Math.round(rawSteps / step) * step;
  }

  const snappedSteps =
    direction > 0 ? Math.floor(rawSteps / stepSize) : Math.ceil(rawSteps / stepSize);
  return base + snappedSteps * stepSize;
}

export function toValidatedNumber(
  value: number | null,
  {
    step,
    minWithDefault,
    maxWithDefault,
    minWithZeroDefault,
    format,
    snapOnStep,
    small,
    clamp: shouldClamp,
  }: {
    step: number | undefined;
    minWithDefault: number;
    maxWithDefault: number;
    minWithZeroDefault: number;
    format: NumberFormatOptionsWithRounding | undefined;
    snapOnStep: boolean;
    small: boolean;
    clamp: boolean;
  },
) {
  if (value === null) {
    return value;
  }

  let nextValue = value;

  if (step != null && snapOnStep && step !== 0) {
    const base =
      small || minWithDefault === Number.MIN_SAFE_INTEGER ? minWithZeroDefault : minWithDefault;

    // Snap before clamping so non-step-aligned boundaries stay reachable.
    nextValue = snapToStep(nextValue, base, step, small ? 'nearest' : 'directional');
  }

  // Clamp before rounding so a value just outside a fractional boundary (e.g. `0.4` with
  // `min: 0.6`) is pulled in range first, then clamp again after rounding in case rounding
  // nudges it back out. Both passes are needed for non-integer bounds.
  if (shouldClamp) {
    nextValue = clamp(nextValue, minWithDefault, maxWithDefault);
  }

  // Non-stepping values — parsed input (typing, paste, blur) and externally-supplied controlled
  // values — involve no arithmetic here, so they carry no binary noise to clean and are returned
  // verbatim to keep every digit, including values with more than 15 significant digits. Only
  // stepping/snapping arithmetic can introduce noise (e.g. 0.7 + 0.1), which
  // `removeFloatingPointErrors` cleans.
  if (step == null && !hasNumberFormatRoundingOptions(format)) {
    return nextValue;
  }

  const roundedValue = removeFloatingPointErrors(nextValue, format);
  return shouldClamp ? clamp(roundedValue, minWithDefault, maxWithDefault) : roundedValue;
}
