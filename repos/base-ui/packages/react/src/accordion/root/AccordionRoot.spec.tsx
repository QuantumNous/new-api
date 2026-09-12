import { expectType } from '#test-utils';
import { Accordion } from '@base-ui/react/accordion';

const stringValues = ['a'];
const nullableValues: (string | null)[] = ['a', null];

<Accordion.Root
  value={stringValues}
  onValueChange={(value) => {
    expectType<string[], typeof value>(value);
  }}
/>;

<Accordion.Root
  defaultValue={[1]}
  onValueChange={(value) => {
    expectType<number[], typeof value>(value);
  }}
/>;

<Accordion.Root<'a' | 'b'> value={['a']} />;

<Accordion.Root<'a' | 'b'>
  onValueChange={(value) => {
    expectType<('a' | 'b')[], typeof value>(value);
  }}
/>;

<Accordion.Root<string | null>
  value={nullableValues}
  onValueChange={(value) => {
    expectType<(string | null)[], typeof value>(value);
  }}
/>;

<Accordion.Root
  onValueChange={(value) => {
    // Backward-compatible default: no explicit generic keeps permissive `any[]`.
    expectType<any[], typeof value>(value);
  }}
/>;

// @ts-expect-error value must match explicit generic type
<Accordion.Root<'a' | 'b'> value={['c']} />;

type AccordionChangeHandler = NonNullable<Accordion.Root.Props<'a'>['onValueChange']>;
type AccordionDefaultChangeHandler = NonNullable<Accordion.Root.Props['onValueChange']>;

const handleValueChange: AccordionChangeHandler = (value) => {
  expectType<'a'[], typeof value>(value);
};

<Accordion.Root<'a'> onValueChange={handleValueChange} />;

const handleDefaultValueChange: AccordionDefaultChangeHandler = (value) => {
  expectType<any[], typeof value>(value);
};

<Accordion.Root onValueChange={handleDefaultValueChange} />;

export function Wrapper<Value>(props: Accordion.Root.Props<Value>) {
  return <Accordion.Root {...props} />;
}
