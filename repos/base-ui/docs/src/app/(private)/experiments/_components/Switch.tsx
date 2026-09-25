'use client';
import * as React from 'react';
import { Field } from '@base-ui/react/field';
import { Switch as BaseSwitch } from '@base-ui/react/switch';
import classes from './Switch.module.css';

export function Switch(props: Switch.Props) {
  const { label, checked, onCheckedChange, defaultChecked, ...otherProps } = props;

  const component = (
    <BaseSwitch.Root
      className={classes.Switch}
      checked={checked}
      onCheckedChange={onCheckedChange}
      defaultChecked={defaultChecked}
    >
      <BaseSwitch.Thumb className={classes.Thumb} />
    </BaseSwitch.Root>
  );

  return (
    <Field.Root {...otherProps}>
      {label ? (
        <Field.Label className={classes.Label}>
          {label}
          {component}
        </Field.Label>
      ) : (
        component
      )}
    </Field.Root>
  );
}

export namespace Switch {
  export interface Props extends React.HTMLAttributes<HTMLDivElement> {
    label?: string;
    checked?: boolean;
    onCheckedChange: (checked: boolean) => void;
    defaultChecked?: boolean;
  }
}
