'use client';
import * as React from 'react';
import { AlertDialog } from '@base-ui/react/alert-dialog';
import { Dialog } from '@base-ui/react/dialog';

export default function ExampleDialog() {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [confirmationOpen, setConfirmationOpen] = React.useState(false);
  const [textareaValue, setTextareaValue] = React.useState('');
  const titleId = React.useId();

  return (
    <Dialog.Root
      open={dialogOpen}
      onOpenChange={(open) => {
        // Show the close confirmation if there’s text in the textarea
        if (!open && textareaValue) {
          setConfirmationOpen(true);
        } else {
          // Reset the text area value
          setTextareaValue('');
          // Open or close the dialog normally
          setDialogOpen(open);
        }
      }}
    >
      <Dialog.Trigger className="flex h-8 items-center justify-center gap-2 border border-neutral-950 dark:border-white bg-white dark:bg-neutral-950 px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 dark:text-white select-none hover:not-data-disabled:bg-neutral-100 dark:hover:not-data-disabled:bg-neutral-800 active:not-data-disabled:bg-neutral-200 dark:active:not-data-disabled:bg-neutral-700 data-disabled:border-neutral-500 data-disabled:text-neutral-500 disabled:border-neutral-500 disabled:text-neutral-500 dark:data-disabled:border-neutral-400 dark:data-disabled:text-neutral-400 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white">
        Tweet
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 min-h-dvh bg-black opacity-20 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 dark:opacity-50 supports-[-webkit-touch-callout:none]:absolute" />
        <Dialog.Popup className="fixed top-[calc(50%+1.25rem*var(--nested-dialogs))] left-1/2 -mt-8 flex w-96 max-w-[calc(100vw-3rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-1 scale-[calc(1-0.1*var(--nested-dialogs))] bg-white dark:bg-neutral-950 p-4 text-neutral-950 dark:text-white border border-neutral-950 dark:border-white shadow-[0.25rem_0.25rem_0] shadow-black/12 dark:shadow-none transition-[top,scale,opacity] duration-100 ease-out after:absolute after:inset-0 after:bg-black/5 after:opacity-0 after:transition-opacity after:duration-100 after:ease-out after:pointer-events-none data-ending-style:top-[calc(50%+0.25rem+1.25rem*var(--nested-dialogs))] data-ending-style:scale-[0.96] data-ending-style:opacity-0 data-nested-dialog-open:after:opacity-100 data-starting-style:top-[calc(50%+0.25rem+1.25rem*var(--nested-dialogs))] data-starting-style:scale-[0.96] data-starting-style:opacity-0">
          <Dialog.Title id={titleId} className="text-base font-bold">
            New tweet
          </Dialog.Title>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              // Close the dialog when submitting
              setDialogOpen(false);
            }}
          >
            <textarea
              aria-labelledby={titleId}
              required
              className="min-h-32 w-full border border-neutral-950 dark:border-white bg-white dark:bg-neutral-950 p-2 text-sm any-pointer-coarse:text-base font-normal text-neutral-950 dark:text-white placeholder:text-neutral-500 dark:placeholder:text-neutral-400 focus:outline-2 focus:-outline-offset-1 focus:outline-neutral-950 dark:focus:outline-white"
              placeholder="What’s on your mind?"
              value={textareaValue}
              onChange={(event) => setTextareaValue(event.target.value)}
            />
            <div className="flex justify-end gap-3">
              <Dialog.Close className="flex h-8 items-center justify-center gap-2 border border-neutral-950 dark:border-white bg-white dark:bg-neutral-950 px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 dark:text-white select-none hover:not-data-disabled:bg-neutral-100 dark:hover:not-data-disabled:bg-neutral-800 active:not-data-disabled:bg-neutral-200 dark:active:not-data-disabled:bg-neutral-700 data-disabled:border-neutral-500 data-disabled:text-neutral-500 disabled:border-neutral-500 disabled:text-neutral-500 dark:data-disabled:border-neutral-400 dark:data-disabled:text-neutral-400 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white">
                Cancel
              </Dialog.Close>
              <button
                type="submit"
                className="flex h-8 items-center justify-center gap-2 border border-neutral-950 dark:border-white bg-white dark:bg-neutral-950 px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 dark:text-white select-none hover:bg-neutral-100 dark:hover:bg-neutral-800 active:bg-neutral-200 dark:active:bg-neutral-700 disabled:border-neutral-500 disabled:text-neutral-500 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white"
              >
                Tweet
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>

      {/* Confirmation dialog */}
      <AlertDialog.Root open={confirmationOpen} onOpenChange={setConfirmationOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Popup className="fixed top-[calc(50%+1.25rem*var(--nested-dialogs))] left-1/2 -mt-8 flex w-96 max-w-[calc(100vw-3rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 scale-[calc(1-0.1*var(--nested-dialogs))] bg-white dark:bg-neutral-950 p-4 text-neutral-950 dark:text-white border border-neutral-950 dark:border-white shadow-[0.25rem_0.25rem_0] shadow-black/12 dark:shadow-none transition-[top,scale,opacity] duration-100 ease-out after:absolute after:inset-0 after:bg-black/5 after:opacity-0 after:transition-opacity after:duration-100 after:ease-out after:pointer-events-none data-ending-style:top-[calc(50%+0.25rem+1.25rem*var(--nested-dialogs))] data-ending-style:scale-[0.96] data-ending-style:opacity-0 data-nested-dialog-open:after:opacity-100 data-starting-style:top-[calc(50%+0.25rem+1.25rem*var(--nested-dialogs))] data-starting-style:scale-[0.96] data-starting-style:opacity-0">
            <div className="flex flex-col gap-1">
              <AlertDialog.Title className="text-base font-bold">Discard tweet?</AlertDialog.Title>
              <AlertDialog.Description className="text-sm text-neutral-600 dark:text-neutral-400">
                Your tweet will be lost.
              </AlertDialog.Description>
            </div>
            <div className="flex justify-end gap-3">
              <AlertDialog.Close className="flex h-8 items-center justify-center gap-2 border border-neutral-950 dark:border-white bg-white dark:bg-neutral-950 px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 dark:text-white select-none hover:not-data-disabled:bg-neutral-100 dark:hover:not-data-disabled:bg-neutral-800 active:not-data-disabled:bg-neutral-200 dark:active:not-data-disabled:bg-neutral-700 data-disabled:border-neutral-500 data-disabled:text-neutral-500 disabled:border-neutral-500 disabled:text-neutral-500 dark:data-disabled:border-neutral-400 dark:data-disabled:text-neutral-400 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white">
                Go back
              </AlertDialog.Close>
              <button
                type="button"
                className="flex h-8 items-center justify-center gap-2 border border-neutral-950 dark:border-white bg-white dark:bg-neutral-950 px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 dark:text-white select-none hover:bg-neutral-100 dark:hover:bg-neutral-800 active:bg-neutral-200 dark:active:bg-neutral-700 disabled:border-neutral-500 disabled:text-neutral-500 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white"
                onClick={() => {
                  setConfirmationOpen(false);
                  setDialogOpen(false);
                }}
              >
                Discard
              </button>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </Dialog.Root>
  );
}
