'use client';
import * as React from 'react';
import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
import { useStableCallback } from '@base-ui/utils/useStableCallback';

export function useValueChanged<T>(value: T, onChange: (previousValue: T) => void) {
  const valueRef = React.useRef(value);
  const onChangeCallback = useStableCallback(onChange);

  useIsoLayoutEffect(() => {
    if (valueRef.current === value) {
      return;
    }

    onChangeCallback(valueRef.current);
  }, [value, onChangeCallback]);

  useIsoLayoutEffect(() => {
    valueRef.current = value;
  }, [value]);
}
