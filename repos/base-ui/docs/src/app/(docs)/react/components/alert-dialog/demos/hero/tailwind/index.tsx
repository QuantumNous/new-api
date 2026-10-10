import { AlertDialog } from '@base-ui/react/alert-dialog';

const buttonClasses =
  'flex h-8 items-center justify-center gap-2 border border-neutral-950 dark:border-white bg-white dark:bg-neutral-950 px-3 text-sm leading-none whitespace-nowrap font-normal text-neutral-950 dark:text-white select-none hover:not-data-disabled:bg-neutral-100 dark:hover:not-data-disabled:bg-neutral-800 active:not-data-disabled:bg-neutral-200 dark:active:not-data-disabled:bg-neutral-700 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-neutral-950 dark:focus-visible:outline-white data-disabled:border-neutral-500 data-disabled:text-neutral-500 disabled:border-neutral-500 disabled:text-neutral-500 dark:data-disabled:border-neutral-400 dark:data-disabled:text-neutral-400';

const dangerButtonClasses = `${buttonClasses} text-red-700 dark:text-red-400`;

export default function ExampleAlertDialog() {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger className={dangerButtonClasses}>Discard draft</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 min-h-dvh bg-black opacity-20 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 dark:opacity-50 supports-[-webkit-touch-callout:none]:absolute" />
        <AlertDialog.Popup className="fixed top-1/2 left-1/2 -mt-8 flex w-96 max-w-[calc(100vw-3rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 bg-white dark:bg-neutral-950 p-4 text-neutral-950 dark:text-white border border-neutral-950 dark:border-white shadow-[0.25rem_0.25rem_0] shadow-black/12 dark:shadow-none transition-[scale,opacity] duration-100 ease-out data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0">
          <div className="flex flex-col gap-1">
            <AlertDialog.Title className="text-base font-bold">Discard draft?</AlertDialog.Title>
            <AlertDialog.Description className="text-sm text-neutral-600 dark:text-neutral-400">
              You can’t undo this action.
            </AlertDialog.Description>
          </div>
          <div className="flex justify-end gap-3">
            <AlertDialog.Close className={buttonClasses}>Cancel</AlertDialog.Close>
            <AlertDialog.Close className={dangerButtonClasses}>Discard</AlertDialog.Close>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
