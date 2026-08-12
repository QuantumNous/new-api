import { Menu } from '@base-ui/react/menu';
import clsx from 'clsx';
import './Menu.css';

export const Root = Menu.Root;

export const Trigger = Menu.Trigger;

export function Popup({ children, className, sideOffset = 8, ...props }: Menu.Positioner.Props) {
  return (
    <Menu.Portal>
      <Menu.Positioner sideOffset={sideOffset} className="MenuPositioner" {...props}>
        <Menu.Popup className={clsx('MenuPopup', className)}>{children}</Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  );
}

export function Item({ children, className, ...props }: Menu.Item.Props) {
  return (
    <Menu.Item className={clsx('MenuItem', className)} {...props}>
      {children}
    </Menu.Item>
  );
}

export function LinkItem({ children, className, ...props }: Menu.LinkItem.Props) {
  return (
    <Menu.LinkItem className={clsx('MenuItem', className)} {...props}>
      {children}
    </Menu.LinkItem>
  );
}

export function Separator({ className, ...props }: Menu.Separator.Props) {
  return <Menu.Separator className={clsx('MenuSeparator', className)} {...props} />;
}
