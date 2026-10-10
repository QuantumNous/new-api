import assert from 'node:assert';
import { isDeepEqualData } from './is-deep-equal-data';
import { it } from 'vitest';

it('should check if two primitives are equal', async () => {
  let x = 1;
  let y = 1;
  let result = isDeepEqualData(x, y);
  assert.equal(result, true);

  x = 1;
  y = 2;
  result = isDeepEqualData(x, y);
  assert.equal(result, false);
});

it('should return false for different types', async () => {
  const obj = { a: 1 };
  const num = 1;
  const result = isDeepEqualData(obj, num);
  assert.equal(result, false);
});

it('should return false for null values compared with objects', async () => {
  const obj = { a: 1 };
  const result = isDeepEqualData(obj, null);
  assert.equal(result, false);
});

it('should identify two equal objects', async () => {
  const obj1 = { a: 1, b: 2 };
  const obj2 = { a: 1, b: 2 };
  const result = isDeepEqualData(obj1, obj2);
  assert.equal(result, true);
});

it('should identify two objects with different values', async () => {
  const obj1 = { a: 1, b: 2 };
  const obj2 = { a: 1, b: 3 };
  const result = isDeepEqualData(obj1, obj2);
  assert.equal(result, false);
});

it('should identify two objects with different number of keys', async () => {
  const obj1 = { a: 1, b: 2 };
  const obj2 = { a: 1, b: 2, c: 3 };
  const result = isDeepEqualData(obj1, obj2);
  assert.equal(result, false);
});

it('should handle nested objects', async () => {
  const obj1 = { a: { c: 1 }, b: 2 };
  const obj2 = { a: { c: 1 }, b: 2 };
  const result = isDeepEqualData(obj1, obj2);
  assert.equal(result, true);
});

it('should detect inequality in nested objects', async () => {
  const obj1 = { a: { c: 1 }, b: 2 };
  const obj2 = { a: { c: 2 }, b: 2 };
  const result = isDeepEqualData(obj1, obj2);
  assert.equal(result, false);
});

it('should compare arrays correctly', async () => {
  const arr1 = [1, 2, 3];
  const arr2 = [1, 2, 3];
  const result = isDeepEqualData(arr1, arr2);
  assert.equal(result, true);

  const arr3 = [1, 2, 3];
  const arr4 = [1, 2, 4];
  const result2 = isDeepEqualData(arr3, arr4);
  assert.equal(result2, false);
});

it('should return false for null comparison with object', () => {
  const obj = { a: 1 };
  const result = isDeepEqualData(obj, null);
  assert.equal(result, false);
});

it('should distinguish between array and object with same enumerable properties', () => {
  const obj = { 0: 'one', 1: 'two', length: 2 };
  const arr = ['one', 'two'];
  const result = isDeepEqualData(obj, arr);
  assert.equal(result, false);
});

it('should return false when comparing objects with different prototypes', () => {
  const obj1 = Object.create({ a: 1 });
  const obj2 = Object.create(null);
  obj1.b = 2;
  obj2.b = 2;
  const result = isDeepEqualData(obj1, obj2);
  assert.equal(result, false);
});

it('should handle date object comparisons correctly', () => {
  const date1 = new Date(2000, 0, 1);
  const date2 = new Date(2000, 0, 1);
  const date3 = new Date(2000, 0, 2);
  assert.equal(isDeepEqualData(date1, date2), true);
  assert.equal(isDeepEqualData(date1, date3), false);
});

it('should handle function comparisons', () => {
  const func1 = () => {
    console.log('hello');
  };
  const func2 = () => {
    console.log('hello');
  };
  const func3 = () => {
    console.log('world');
  };
  assert.equal(isDeepEqualData(func1, func2), false);
  assert.equal(isDeepEqualData(func1, func3), false);
});
