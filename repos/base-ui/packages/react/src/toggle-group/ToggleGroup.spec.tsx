import { expectType } from '#test-utils';
import { ToggleGroup } from '@base-ui/react/toggle-group';

const toggleDefaultValueReadonly = (value: NonNullable<ToggleGroup.Props['defaultValue']>) =>
  expectType<readonly string[], typeof value>(value);

const toggleValueReadonly = (value: NonNullable<ToggleGroup.Props['value']>) =>
  expectType<readonly string[], typeof value>(value);

const values = ['a', 'b', 'c'];

<ToggleGroup
  value={values}
  onValueChange={(value) => {
    expectType<string[], typeof value>(value);
  }}
/>;

const narrowedValues = ['a', 'b', 'c'] as const;
type ReadonlyValue = (typeof narrowedValues)[number];

<ToggleGroup
  value={narrowedValues}
  onValueChange={(value) => {
    expectType<ReadonlyValue[], typeof value>(value);
  }}
/>;
