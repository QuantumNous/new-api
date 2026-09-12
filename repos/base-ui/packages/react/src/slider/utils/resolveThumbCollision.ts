import { clamp } from '../../internals/clamp';
import { getPushedThumbValues } from './getPushedThumbValues';
import { SliderRootContext } from '../root/SliderRootContext';

export interface ResolveThumbCollisionParams {
  behavior: SliderRootContext['thumbCollisionBehavior'];
  values: readonly number[];
  currentValues?: readonly number[] | null | undefined;
  initialValues?: readonly number[] | null | undefined;
  pressedIndex: number;
  nextValue: number;
  min: number;
  max: number;
  step: number;
  minStepsBetweenValues: number;
}

export interface ResolveThumbCollisionResult {
  value: number | number[];
  thumbIndex: number;
  didSwap: boolean;
}

export function resolveThumbCollision({
  behavior,
  values,
  currentValues,
  initialValues,
  pressedIndex,
  nextValue,
  min,
  max,
  step,
  minStepsBetweenValues,
}: ResolveThumbCollisionParams): ResolveThumbCollisionResult {
  const activeValues = currentValues ?? values;
  const baselineValues = initialValues ?? values;
  const range = activeValues.length > 1;

  if (!range) {
    return {
      value: nextValue,
      thumbIndex: 0,
      didSwap: false,
    };
  }

  const minValueDifference = step * minStepsBetweenValues;

  switch (behavior) {
    case 'swap': {
      const pressedInitialValue = activeValues[pressedIndex];
      const epsilon = 1e-7;
      const candidateValues = activeValues.slice();
      const previousNeighbor = candidateValues[pressedIndex - 1];
      const nextNeighbor = candidateValues[pressedIndex + 1];

      const lowerBound = previousNeighbor != null ? previousNeighbor + minValueDifference : min;
      const upperBound = nextNeighbor != null ? nextNeighbor - minValueDifference : max;

      const constrainedValue = clamp(nextValue, lowerBound, upperBound);
      const pressedValueAfterClamp = Number(constrainedValue.toFixed(12));
      candidateValues[pressedIndex] = pressedValueAfterClamp;

      const movingForward = nextValue > pressedInitialValue;
      const movingBackward = nextValue < pressedInitialValue;

      const shouldSwapForward =
        movingForward && nextNeighbor != null && nextValue >= nextNeighbor - epsilon;
      const shouldSwapBackward =
        movingBackward && previousNeighbor != null && nextValue <= previousNeighbor + epsilon;

      if (!shouldSwapForward && !shouldSwapBackward) {
        return {
          value: candidateValues,
          thumbIndex: pressedIndex,
          didSwap: false,
        };
      }

      const targetIndex = shouldSwapForward ? pressedIndex + 1 : pressedIndex - 1;

      const initialValuesForPush = candidateValues.map((_, index) => {
        if (index === pressedIndex) {
          return pressedValueAfterClamp;
        }

        const baseline = baselineValues[index];
        if (baseline != null) {
          return baseline;
        }

        return activeValues[index];
      });

      let nextValueForTarget = nextValue;
      if (shouldSwapForward) {
        nextValueForTarget = Math.max(nextValue, candidateValues[targetIndex]);
      } else {
        nextValueForTarget = Math.min(nextValue, candidateValues[targetIndex]);
      }

      const adjustedValues = getPushedThumbValues({
        values: candidateValues,
        index: targetIndex,
        nextValue: nextValueForTarget,
        min,
        max,
        step,
        minStepsBetweenValues,
        initialValues: initialValuesForPush,
      });

      const neighborIndex = shouldSwapForward ? targetIndex - 1 : targetIndex + 1;

      if (neighborIndex >= 0 && neighborIndex < adjustedValues.length) {
        const previousValue = adjustedValues[neighborIndex - 1];
        const nextValueAfter = adjustedValues[neighborIndex + 1];

        let neighborLowerBound = previousValue != null ? previousValue + minValueDifference : min;
        neighborLowerBound = Math.max(neighborLowerBound, min + neighborIndex * minValueDifference);

        let neighborUpperBound = nextValueAfter != null ? nextValueAfter - minValueDifference : max;
        neighborUpperBound = Math.min(
          neighborUpperBound,
          max - (adjustedValues.length - 1 - neighborIndex) * minValueDifference,
        );

        const restoredValue = clamp(pressedValueAfterClamp, neighborLowerBound, neighborUpperBound);
        adjustedValues[neighborIndex] = Number(restoredValue.toFixed(12));
      }

      return {
        value: adjustedValues,
        thumbIndex: targetIndex,
        didSwap: true,
      };
    }
    case 'push': {
      const nextValues = getPushedThumbValues({
        values: activeValues,
        index: pressedIndex,
        nextValue,
        min,
        max,
        step,
        minStepsBetweenValues,
      });

      return {
        value: nextValues,
        thumbIndex: pressedIndex,
        didSwap: false,
      };
    }
    case 'none':
    default: {
      const candidateValues = activeValues.slice();
      const previousNeighbor = candidateValues[pressedIndex - 1];
      const nextNeighbor = candidateValues[pressedIndex + 1];

      const lowerBound = previousNeighbor != null ? previousNeighbor + minValueDifference : min;
      const upperBound = nextNeighbor != null ? nextNeighbor - minValueDifference : max;

      const constrainedValue = clamp(nextValue, lowerBound, upperBound);
      candidateValues[pressedIndex] = Number(constrainedValue.toFixed(12));

      return {
        value: candidateValues,
        thumbIndex: pressedIndex,
        didSwap: false,
      };
    }
  }
}
