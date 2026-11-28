import { expectType } from '#test-utils';
import { Popover } from '@base-ui/react/popover';

const numberPayloadHandle = Popover.createHandle<number>();

const rootWithDirectChildren = (
  <Popover.Root handle={numberPayloadHandle}>
    <Popover.Portal />
  </Popover.Root>
);

const rootWithFunctionChildren = (
  <Popover.Root handle={numberPayloadHandle}>
    {({ payload }) => {
      expectType<number | undefined, typeof payload>(payload);
      return null;
    }}
  </Popover.Root>
);

const triggerWithPayload = <Popover.Trigger handle={numberPayloadHandle} payload={42} />;
const triggerWithoutPayload = <Popover.Trigger handle={numberPayloadHandle} />;

const triggerWithInvalidPayload = (
  // @ts-expect-error
  <Popover.Trigger handle={numberPayloadHandle} payload={'invalid'} />
);
