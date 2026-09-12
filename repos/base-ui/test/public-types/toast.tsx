import {
  Toast,
  type UseToastManagerReturnValue,
  type ToastManagerAddOptions as BaseToastManagerAddOptions,
  type ToastManagerPromiseOptions as BaseToastManagerPromiseOptions,
  type ToastManagerUpdateOptions as BaseToastManagerUpdateOptions,
} from '@base-ui/react/toast';

export type ToastProviderProps = Toast.Provider.Props;
export type ToastViewportProps = Toast.Viewport.Props;
export type ToastRootProps = Toast.Root.Props;

export type ToastManagerReturnValue = UseToastManagerReturnValue;
export type ToastManagerAdd = UseToastManagerReturnValue['add'];
export type ToastManagerUpdate = UseToastManagerReturnValue['update'];
export type ToastManagerPromise = UseToastManagerReturnValue['promise'];

export type ToastManagerAddOptions<Data extends object> = BaseToastManagerAddOptions<Data>;
export type ToastManagerUpdateOptions<Data extends object> = BaseToastManagerUpdateOptions<Data>;
export type ToastManagerPromiseOptions<Value, Data extends object> = BaseToastManagerPromiseOptions<
  Value,
  Data
>;

export type ToastCreateManagerReturn = ReturnType<typeof Toast.createToastManager>;

export const { useToastManager, createToastManager } = Toast;
