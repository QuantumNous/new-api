'use client';
import * as React from 'react';
import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
import { useFieldRootContext } from '../field-root-context/FieldRootContext';
import type { FieldControlRegistration } from './useFieldControlRegistration';

export function useRegisterFieldControl(
  controlRef: FieldControlRegistration['controlRef'],
  id: FieldControlRegistration['id'],
  value: FieldControlRegistration['value'],
  getFormValueOverride?: FieldControlRegistration['getValue'],
  enabled = true,
  name?: FieldControlRegistration['name'],
) {
  const { registerFieldControl } = useFieldRootContext();
  const sourceRef = React.useRef<symbol | null>(null);

  if (!sourceRef.current) {
    sourceRef.current = Symbol();
  }

  useIsoLayoutEffect(() => {
    const source = sourceRef.current;

    if (!source || !enabled) {
      return undefined;
    }

    const registration: FieldControlRegistration = {
      controlRef,
      getValue: getFormValueOverride,
      id,
      name,
      value,
    };

    registerFieldControl(source, registration);

    return () => {
      registerFieldControl(source, undefined);
    };
  }, [controlRef, enabled, getFormValueOverride, id, name, registerFieldControl, value]);
}
