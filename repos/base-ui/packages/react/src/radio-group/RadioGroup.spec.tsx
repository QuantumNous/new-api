import { expectType } from '#test-utils';
import { RadioGroup } from '@base-ui/react/radio-group';

const values = ['a', 'b', 'c'];

<RadioGroup
  value={values[0]}
  onValueChange={(value) => {
    expectType<string, typeof value>(value);
  }}
/>;

const narrowedValues = ['a', 'b', 'c'] as const;
type NarrowedValue = (typeof narrowedValues)[number];
const narrowedIndex: number = 0;
const narrowedValue = narrowedValues[narrowedIndex];

<RadioGroup
  value={narrowedValue}
  onValueChange={(value) => {
    expectType<NarrowedValue, typeof value>(value);
  }}
/>;

<RadioGroup
  defaultValue={narrowedValue}
  onValueChange={(value) => {
    expectType<NarrowedValue, typeof value>(value);
  }}
/>;

<RadioGroup<NarrowedValue>
  value={narrowedValue}
  onValueChange={(value) => {
    expectType<NarrowedValue, typeof value>(value);
  }}
/>;

<RadioGroup<string | null>
  onValueChange={(value) => {
    expectType<string | null, typeof value>(value);
  }}
/>;

<RadioGroup
  value={null}
  onValueChange={(value) => {
    expectType<null, typeof value>(value);
  }}
/>;

<RadioGroup
  defaultValue={null}
  onValueChange={(value) => {
    expectType<null, typeof value>(value);
  }}
/>;
