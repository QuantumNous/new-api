import { expectType } from '#test-utils';
import { NavigationMenu } from '@base-ui/react/navigation-menu';

const stringValue = 'item-1';
const nullableValue: string | null = 'item-1';

<NavigationMenu.Root
  value={stringValue}
  onValueChange={(value) => {
    expectType<string | null, typeof value>(value);
  }}
/>;

<NavigationMenu.Root
  defaultValue={1}
  onValueChange={(value) => {
    expectType<number | null, typeof value>(value);
  }}
/>;

<NavigationMenu.Root<'a' | 'b'> value="a" />;

<NavigationMenu.Root<'a' | 'b'>
  onValueChange={(value) => {
    expectType<'a' | 'b' | null, typeof value>(value);
  }}
/>;

<NavigationMenu.Root<string | null>
  value={nullableValue}
  onValueChange={(value) => {
    expectType<string | null, typeof value>(value);
  }}
/>;

<NavigationMenu.Root
  onValueChange={(value) => {
    // Backward-compatible default: no explicit generic keeps permissive `any`.
    expectType<any, typeof value>(value);
  }}
/>;

// @ts-expect-error value must match explicit generic type
<NavigationMenu.Root<'a' | 'b'> value="c" />;

type NavigationMenuChangeHandler = NonNullable<NavigationMenu.Root.Props<'a'>['onValueChange']>;
type NavigationMenuDefaultChangeHandler = NonNullable<NavigationMenu.Root.Props['onValueChange']>;

const handleValueChange: NavigationMenuChangeHandler = (value) => {
  expectType<'a' | null, typeof value>(value);
};

<NavigationMenu.Root<'a'> onValueChange={handleValueChange} />;

const handleDefaultValueChange: NavigationMenuDefaultChangeHandler = (value) => {
  expectType<any, typeof value>(value);
};

<NavigationMenu.Root onValueChange={handleDefaultValueChange} />;

export function Wrapper<Value>(props: NavigationMenu.Root.Props<Value>) {
  return <NavigationMenu.Root {...props} />;
}
