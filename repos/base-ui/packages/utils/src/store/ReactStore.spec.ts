import { expectType } from '../testUtils';
import { createSelector } from './createSelector';
import { ReactStore } from './ReactStore';

interface TestState {
  count: number | undefined;
  text: string;
}

const selectors = {
  count: createSelector((state: TestState) => state.count),
  text: createSelector((state: TestState) => state.text),
  textLongerThan(state: TestState, length: number) {
    return state.text.length > length;
  },
  textLengthBetween(state: TestState, minLength: number, maxLength: number) {
    return state.text.length >= minLength && state.text.length <= maxLength;
  },
};

const store = new ReactStore<TestState, Record<string, never>, typeof selectors>(
  { count: 0, text: '' },
  undefined,
  selectors,
);

const count = store.select('count');
expectType<number | undefined, typeof count>(count);

const text = store.select('text');
expectType<string, typeof text>(text);

const isTextLongerThan5 = store.select('textLongerThan', 5);
expectType<boolean, typeof isTextLongerThan5>(isTextLongerThan5);

const isTextLengthBetween3And10 = store.select('textLengthBetween', 3, 10);
expectType<boolean, typeof isTextLengthBetween3And10>(isTextLengthBetween3And10);

const countReactive = store.useState('count');
expectType<number | undefined, typeof countReactive>(countReactive);

const textReactive = store.useState('text');
expectType<string, typeof textReactive>(textReactive);

const isTextLongerThan7Reactive = store.useState('textLongerThan', 7);
expectType<boolean, typeof isTextLongerThan7Reactive>(isTextLongerThan7Reactive);

const isTextLengthBetween2And8Reactive = store.useState('textLengthBetween', 2, 8);
expectType<boolean, typeof isTextLengthBetween2And8Reactive>(isTextLengthBetween2And8Reactive);

// incorrect calls:

// @ts-expect-error
store.select();
// @ts-expect-error
store.select('count', 1);
// @ts-expect-error
store.select('textLongerThan');
// @ts-expect-error
store.select('textLengthBetween', 1);
// @ts-expect-error
store.select('textLongerThan', 2, 3);

// @ts-expect-error
store.useState();
// @ts-expect-error
store.useState('count', 1);
// @ts-expect-error
store.useState('textLongerThan');
// @ts-expect-error
store.useState('textLengthBetween', 1);
// @ts-expect-error
store.useState('textLongerThan', 2, 3);

const unsubscribeFromCount = store.observe('count', (newValue, oldValue) => {
  expectType<number | undefined, typeof newValue>(newValue);
  expectType<number | undefined, typeof oldValue>(oldValue);
});
expectType<() => void, typeof unsubscribeFromCount>(unsubscribeFromCount);

const unsubscribeFromSelector = store.observe(
  (state) => state.text.length,
  (newValue, oldValue) => {
    expectType<number, typeof newValue>(newValue);
    expectType<number, typeof oldValue>(oldValue);
  },
);
expectType<() => void, typeof unsubscribeFromSelector>(unsubscribeFromSelector);

const mismatchedListener = (newValue: string) => {
  expectType<string, typeof newValue>(newValue);
};
// @ts-expect-error listener must match selector return type
store.observe((state) => state.text.length, mismatchedListener);
