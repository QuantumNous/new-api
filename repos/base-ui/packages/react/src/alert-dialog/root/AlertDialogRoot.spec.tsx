import * as React from 'react';
import { expectType } from '#test-utils';
import { AlertDialog } from '@base-ui/react/alert-dialog';
import { Dialog } from '@base-ui/react/dialog';

const numberPayloadHandle = AlertDialog.createHandle<number>();
const dialogHandle = Dialog.createHandle<number>();

const rootWithDirectChildren = (
  <AlertDialog.Root handle={numberPayloadHandle}>
    <AlertDialog.Portal />
  </AlertDialog.Root>
);

const rootWithFunctionChildren = (
  <AlertDialog.Root handle={numberPayloadHandle}>
    {({ payload }) => {
      expectType<number | undefined, typeof payload>(payload);
      return null;
    }}
  </AlertDialog.Root>
);

const triggerWithPayload = <AlertDialog.Trigger handle={numberPayloadHandle} payload={42} />;
const triggerWithoutPayload = <AlertDialog.Trigger handle={numberPayloadHandle} />;

const triggerWithInvalidPayload = (
  // @ts-expect-error
  <AlertDialog.Trigger handle={numberPayloadHandle} payload={'invalid'} />
);

const rootWithDialogHandle = (
  // @ts-expect-error Dialog handles cannot be used for alert dialogs.
  <AlertDialog.Root handle={dialogHandle}>
    <AlertDialog.Portal />
  </AlertDialog.Root>
);

const triggerWithDialogHandle = (
  // @ts-expect-error Dialog handles cannot be used for alert dialog triggers.
  <AlertDialog.Trigger handle={dialogHandle} />
);
