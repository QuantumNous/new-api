import { Select } from '@base-ui/react/select';
import clsx from 'clsx';
import { CaretSortIcon } from '../icons/CaretSortIcon';
import { CheckIcon } from '../icons/CheckIcon';
import './Select.css';

export const Root = Select.Root;

interface TriggerProps extends Omit<Select.Trigger.Props, 'children'> {
  children?: Select.Value.Props['children'];
}

export function Trigger({ className, children, ...props }: TriggerProps) {
  return (
    // Implicitly relying on <GhostButton>, keep it in sync
    <Select.Trigger data-layout="text" className="GhostButton" type={undefined} {...props}>
      <Select.Value>{children}</Select.Value>
      <Select.Icon render={<CaretSortIcon className="bui-ml--0.5" />} />
    </Select.Trigger>
  );
}

export function Popup({ children, className, ...props }: Select.Positioner.Props) {
  return (
    <Select.Portal>
      <Select.Positioner align="center" sideOffset={7} className="SelectPositioner" {...props}>
        <Select.Popup className={clsx('SelectPopup', className)}>{children}</Select.Popup>
      </Select.Positioner>
    </Select.Portal>
  );
}

export function Item({ children, className, ...props }: Select.Item.Props) {
  return (
    <Select.Item className={clsx('SelectItem', className)} {...props}>
      <Select.ItemIndicator className="SelectItemIndicator" render={<CheckIcon />} />
      <Select.ItemText className="SelectItemText">{children}</Select.ItemText>
    </Select.Item>
  );
}
