import * as React from 'react';
import { expectType } from '#test-utils';
import { Dialog } from '@base-ui/react/dialog';

const numberPayloadHandle = Dialog.createHandle<number>();

const rootWithDirectChildren = (
  <Dialog.Root handle={numberPayloadHandle}>
    <Dialog.Portal />
  </Dialog.Root>
);

const rootWithFunctionChildren = (
  <Dialog.Root handle={numberPayloadHandle}>
    {({ payload }) => {
      expectType<number | undefined, typeof payload>(payload);
      return null;
    }}
  </Dialog.Root>
);

const triggerWithPayload = <Dialog.Trigger handle={numberPayloadHandle} payload={42} />;
const triggerWithoutPayload = <Dialog.Trigger handle={numberPayloadHandle} />;

const triggerWithInvalidPayload = (
  // @ts-expect-error
  <Dialog.Trigger handle={numberPayloadHandle} payload={'invalid'} />
);
