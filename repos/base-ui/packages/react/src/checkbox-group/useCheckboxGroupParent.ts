'use client';
import * as React from 'react';
import { useStableCallback } from '@base-ui/utils/useStableCallback';
import { useBaseUiId } from '../internals/useBaseUiId';
import type { BaseUIChangeEventDetails } from '../internals/createBaseUIEventDetails';
import type { BaseUIEventReasons } from '../internals/reasons';

const EMPTY: string[] = [];

export function useCheckboxGroupParent(
  params: UseCheckboxGroupParentParameters,
): UseCheckboxGroupParentReturnValue {
  const { allValues = EMPTY, value = EMPTY, onValueChange: onValueChangeProp } = params;

  const uncontrolledStateRef = React.useRef(value);
  const disabledStatesRef = React.useRef(new Map<string, boolean>());

  const [status, setStatus] = React.useState<'on' | 'off' | 'mixed'>('mixed');

  const id = useBaseUiId();
  const checked = value.length === allValues.length;
  const indeterminate = value.length !== allValues.length && value.length > 0;

  const onValueChange = useStableCallback(onValueChangeProp);

  const getParentProps: UseCheckboxGroupParentReturnValue['getParentProps'] = React.useCallback(
    () => ({
      id,
      indeterminate,
      checked,
      // TODO: custom `id` on child checkboxes breaks this
      // https://github.com/mui/base-ui/issues/2691
      'aria-controls': allValues.map((v) => `${id}-${v}`).join(' '),
      onCheckedChange(_, eventDetails) {
        const uncontrolledState = uncontrolledStateRef.current;

        // None except the disabled ones that are checked, which can't be changed.
        const none = allValues.filter(
          (v) => disabledStatesRef.current.get(v) && uncontrolledState.includes(v),
        );
        // "All" that are valid:
        // - any that aren't disabled
        // - disabled ones that are checked
        const all = allValues.filter(
          (v) =>
            !disabledStatesRef.current.get(v) ||
            (disabledStatesRef.current.get(v) && uncontrolledState.includes(v)),
        );

        const allOnOrOff =
          uncontrolledState.length === all.length || uncontrolledState.length === 0;

        if (allOnOrOff) {
          if (value.length === all.length) {
            onValueChange(none, eventDetails);
          } else {
            onValueChange(all, eventDetails);
          }
          return;
        }

        let nextStatus: 'on' | 'off' | 'mixed' = 'mixed';
        let nextValue = uncontrolledState;

        if (status === 'mixed') {
          nextStatus = 'on';
          nextValue = all;
        } else if (status === 'on') {
          nextStatus = 'off';
          nextValue = none;
        }

        onValueChange(nextValue, eventDetails);

        if (!eventDetails.isCanceled) {
          setStatus(nextStatus);
        }
      },
    }),
    [allValues, checked, id, indeterminate, onValueChange, status, value.length],
  );

  const getChildProps: UseCheckboxGroupParentReturnValue['getChildProps'] = React.useCallback(
    (childValue: string) => ({
      checked: value.includes(childValue),
      onCheckedChange(nextChecked, eventDetails) {
        const newValue = value.slice();
        if (nextChecked) {
          newValue.push(childValue);
        } else {
          newValue.splice(newValue.indexOf(childValue), 1);
        }

        onValueChange(newValue, eventDetails);

        if (!eventDetails.isCanceled) {
          uncontrolledStateRef.current = newValue;
          setStatus('mixed');
        }
      },
    }),
    [onValueChange, value],
  );

  return React.useMemo(
    () => ({
      id,
      indeterminate,
      getParentProps,
      getChildProps,
      disabledStatesRef,
    }),
    [id, indeterminate, getParentProps, getChildProps],
  );
}

export interface UseCheckboxGroupParentParameters {
  allValues?: string[] | undefined;
  value?: string[] | undefined;
  onValueChange?:
    | ((
        value: string[],
        eventDetails: BaseUIChangeEventDetails<BaseUIEventReasons['none']>,
      ) => void)
    | undefined;
}

export interface UseCheckboxGroupParentReturnValue {
  id: string | undefined;
  indeterminate: boolean;
  disabledStatesRef: React.RefObject<Map<string, boolean>>;
  getParentProps: () => {
    id: string | undefined;
    indeterminate: boolean;
    checked: boolean;
    'aria-controls': string;
    onCheckedChange: (
      checked: boolean,
      eventDetails: BaseUIChangeEventDetails<BaseUIEventReasons['none']>,
    ) => void;
  };
  getChildProps: (value: string) => {
    checked: boolean;
    onCheckedChange: (
      checked: boolean,
      eventDetails: BaseUIChangeEventDetails<BaseUIEventReasons['none']>,
    ) => void;
  };
}

export interface UseCheckboxGroupParentState {}
