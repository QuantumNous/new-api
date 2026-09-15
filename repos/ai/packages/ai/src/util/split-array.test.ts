import { expect, it } from 'vitest';
import { splitArray } from './split-array';

it('should split an array into chunks of the specified size', () => {
  const array = [1, 2, 3, 4, 5];
  const size = 2;
  const result = splitArray(array, size);
  expect(result).toEqual([[1, 2], [3, 4], [5]]);
});

it('should return an empty array when the input array is empty', () => {
  const array: number[] = [];
  const size = 2;
  const result = splitArray(array, size);
  expect(result).toEqual([]);
});

it('should return the original array when the chunk size is greater than the array length', () => {
  const array = [1, 2, 3];
  const size = 5;
  const result = splitArray(array, size);
  expect(result).toEqual([[1, 2, 3]]);
});

it('should return the original array when the chunk size is equal to the array length', () => {
  const array = [1, 2, 3];
  const size = 3;
  const result = splitArray(array, size);
  expect(result).toEqual([[1, 2, 3]]);
});

it('should handle chunk size of 1 correctly', () => {
  const array = [1, 2, 3];
  const size = 1;
  const result = splitArray(array, size);
  expect(result).toEqual([[1], [2], [3]]);
});

it('should throw an error for chunk size of 0', () => {
  const array = [1, 2, 3];
  const size = 0;
  expect(() => splitArray(array, size)).toThrow(
    'chunkSize must be greater than 0',
  );
});

it('should throw an error for negative chunk size', () => {
  const array = [1, 2, 3];
  const size = -1;
  expect(() => splitArray(array, size)).toThrow(
    'chunkSize must be greater than 0',
  );
});

it('should handle non-integer chunk size by flooring the size', () => {
  const array = [1, 2, 3, 4, 5];
  const size = 2.5;
  const result = splitArray(array, Math.floor(size));
  expect(result).toEqual([[1, 2], [3, 4], [5]]);
});
