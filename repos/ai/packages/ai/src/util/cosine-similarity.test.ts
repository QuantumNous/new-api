import { cosineSimilarity } from './cosine-similarity';
import { it, expect } from 'vitest';

it('should calculate cosine similarity correctly', () => {
  const vector1 = [1, 2, 3];
  const vector2 = [4, 5, 6];

  const result = cosineSimilarity(vector1, vector2);

  // test against pre-calculated value:
  expect(result).toBeCloseTo(0.9746318461970762, 5);
});

it('should calculate negative cosine similarity correctly', () => {
  const vector1 = [1, 0];
  const vector2 = [-1, 0];

  const result = cosineSimilarity(vector1, vector2);

  // test against pre-calculated value:
  expect(result).toBeCloseTo(-1, 5);
});

it('should throw an error when vectors have different lengths', () => {
  const vector1 = [1, 2, 3];
  const vector2 = [4, 5];

  expect(() => cosineSimilarity(vector1, vector2)).toThrowError();
});

it('should give 0 when one of the vectors is a zero vector', () => {
  const vector1 = [0, 1, 2];
  const vector2 = [0, 0, 0];

  const result = cosineSimilarity(vector1, vector2);

  expect(result).toBe(0);

  const result2 = cosineSimilarity(vector2, vector1);

  expect(result2).toBe(0);
});

it('should handle vectors with very small magnitudes', () => {
  const vector1 = [1e-10, 0, 0];
  const vector2 = [2e-10, 0, 0];

  const result = cosineSimilarity(vector1, vector2);

  expect(result).toBe(1);

  const vector3 = [1e-10, 0, 0];
  const vector4 = [-1e-10, 0, 0];

  const result2 = cosineSimilarity(vector3, vector4);
  expect(result2).toBe(-1);
});
