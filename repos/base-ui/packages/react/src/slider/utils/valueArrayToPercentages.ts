import { clamp } from '../../internals/clamp';
import { valueToPercent } from '../../utils/valueToPercent';

export function valueArrayToPercentages(values: number[], min: number, max: number) {
  const output = [];
  for (let i = 0; i < values.length; i += 1) {
    output.push(clamp(valueToPercent(values[i], min, max), 0, 100));
  }
  return output;
}
