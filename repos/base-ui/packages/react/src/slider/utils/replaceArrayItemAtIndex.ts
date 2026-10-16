import { asc } from './asc';

export function replaceArrayItemAtIndex(array: readonly number[], index: number, newValue: number) {
  const output = array.slice();
  output[index] = newValue;
  return output.sort(asc);
}
