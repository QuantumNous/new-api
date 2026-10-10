import { Menu } from '@base-ui/react/menu';

export type MenuRootProps = Menu.Root.Props;
export type MenuRootActions = Menu.Root.Actions;
export type MenuRootChangeEventReason = Menu.Root.ChangeEventReason;
export type MenuRootChangeEventDetails = Menu.Root.ChangeEventDetails;
export type MenuRootOrientation = Menu.Root.Orientation;

export interface SimpleMenuProps extends Omit<MenuRootProps, 'children'> {
  label?: string;
}
