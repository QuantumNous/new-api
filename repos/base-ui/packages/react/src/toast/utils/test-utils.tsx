import { Toast } from '@base-ui/react/toast';

/**
 * @internal
 */
export function Button() {
  const { add } = Toast.useToastManager();
  return (
    <button
      type="button"
      onClick={() => {
        add({
          title: 'title',
          description: 'description',
          actionProps: {
            id: 'action',
            children: 'action',
          },
        });
      }}
    >
      add
    </button>
  );
}

/**
 * @internal
 */
export function List() {
  return Toast.useToastManager().toasts.map((toastItem) => (
    <Toast.Root key={toastItem.id} toast={toastItem} data-testid="root">
      <Toast.Title data-testid="title" />
      <Toast.Description data-testid="description" />
      <Toast.Close aria-label="close-press" />
      <Toast.Action data-testid="action" />
    </Toast.Root>
  ));
}
