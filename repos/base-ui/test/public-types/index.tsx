import * as React from 'react';
import { Menu } from '@base-ui/react/menu';
import { Toast } from '@base-ui/react/toast';
import type { CheckboxProps } from './checkbox';
import type { SeparatorProps } from './separator';
import type { SimpleAutocompleteProps } from './autocomplete';
import { AutocompleteHarness } from './autocomplete';
import type { SimpleComboboxProps } from './combobox';
import { ComboboxHarness } from './combobox';
import type {
  MenuRootActions,
  MenuRootChangeEventDetails,
  MenuRootChangeEventReason,
  SimpleMenuProps,
} from './menu';
import type {
  ToastCreateManagerReturn,
  ToastManagerReturnValue,
  ToastManagerAddOptions,
  ToastManagerPromiseOptions,
  ToastManagerUpdateOptions,
  ToastProviderProps,
} from './toast';

export const MyCheckbox = React.forwardRef<HTMLDivElement, CheckboxProps>(() => {
  return <div />;
});

export const MySeparator = React.forwardRef<HTMLHRElement, SeparatorProps>(() => {
  return <hr />;
});

export const SimpleCombobox = React.forwardRef<HTMLInputElement, SimpleComboboxProps>(
  function SimpleCombobox(props, ref) {
    return <ComboboxHarness ref={ref} {...props} />;
  },
);

export const SimpleAutocomplete = React.forwardRef<HTMLInputElement, SimpleAutocompleteProps>(
  function SimpleAutocomplete(props, ref) {
    return <AutocompleteHarness ref={ref} {...props} />;
  },
);

export const SimpleMenu = React.forwardRef<HTMLButtonElement, SimpleMenuProps>(function SimpleMenu(
  { label = 'Menu', ...rest },
  ref,
) {
  const actionsRef = React.useRef<MenuRootActions>(null);

  function handleMenuOpenChange(
    open: boolean,
    details: MenuRootChangeEventDetails,
  ): MenuRootChangeEventReason | undefined {
    if (details.reason === 'trigger-hover') {
      return details.reason;
    }
    return undefined;
  }

  return (
    <Menu.Root {...rest} actionsRef={actionsRef} onOpenChange={handleMenuOpenChange}>
      <Menu.Trigger ref={ref}>{label}</Menu.Trigger>
      <Menu.Positioner>
        <Menu.Popup>
          <Menu.Item>Item 1</Menu.Item>
          <Menu.Item>Item 2</Menu.Item>
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Root>
  );
});

function exerciseToastManager(manager: ToastManagerReturnValue) {
  const id = manager.add({ title: 'Toast', description: 'Created' });
  manager.update(id, { description: 'Updated description', timeout: 4000 });
  const promiseOptions: ToastManagerPromiseOptions<string, { info: string }> = {
    loading: { description: 'Loading…', data: { info: 'loading' } },
    success: (value) => ({ description: value, data: { info: value } }),
    error: (error) => ({ description: String(error), data: { info: 'failed' } }),
  };

  void manager.promise(Promise.resolve('done'), promiseOptions);
  manager.close(id);
}

export function ToastHarness(props: ToastProviderProps) {
  const externalManagerRef = React.useRef<ToastCreateManagerReturn>(Toast.createToastManager());

  React.useEffect(() => {
    const manager = externalManagerRef.current;
    const addOptions: ToastManagerAddOptions<{ details: string }> = {
      title: 'External toast',
      description: 'Created via external manager',
      data: { details: 'payload' },
    };
    const toastId = manager.add(addOptions);

    const updateOptions: ToastManagerUpdateOptions<{ details: string }> = {
      description: 'Updated externally',
      data: { details: 'updated' },
    };
    manager.update(toastId, updateOptions);

    const externalPromiseOptions: ToastManagerPromiseOptions<string, { details: string }> = {
      loading: { description: 'Loading external…', data: { details: 'loading' } },
      success: (value) => ({ description: value, data: { details: value } }),
      error: (error) => ({ description: String(error), data: { details: 'error' } }),
    };
    void manager.promise(Promise.resolve('value'), externalPromiseOptions);
  }, []);

  return (
    <Toast.Provider {...props} toastManager={externalManagerRef.current}>
      <Toast.Viewport />
      <ToastUsage />
    </Toast.Provider>
  );
}

function ToastUsage() {
  const manager = Toast.useToastManager();

  React.useEffect(() => {
    exerciseToastManager(manager);
  }, [manager]);

  return null;
}
