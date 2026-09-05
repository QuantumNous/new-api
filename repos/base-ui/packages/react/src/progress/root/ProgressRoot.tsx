'use client';
import * as React from 'react';
import { useValueAsRef } from '@base-ui/utils/useValueAsRef';
import { visuallyHidden } from '@base-ui/utils/visuallyHidden';
import { formatNumberValue } from '../../utils/formatNumber';
import { useRenderElement } from '../../internals/useRenderElement';
import { ProgressRootContext } from './ProgressRootContext';
import { progressStateAttributesMapping } from './stateAttributesMapping';
import { BaseUIComponentProps, HTMLProps } from '../../internals/types';

function getDefaultAriaValueText(formattedValue: string | null, value: number | null) {
  if (value == null) {
    return 'indeterminate progress';
  }

  return formattedValue || `${value}%`;
}

/**
 * Groups all parts of the progress bar and provides the task completion status to screen readers.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Progress](https://base-ui.com/react/components/progress)
 */
export const ProgressRoot = React.forwardRef(function ProgressRoot(
  componentProps: ProgressRoot.Props,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const {
    format,
    getAriaValueText = getDefaultAriaValueText,
    locale,
    max = 100,
    min = 0,
    value,
    render,
    className,
    children,
    style,
    ...elementProps
  } = componentProps;

  const [labelId, setLabelId] = React.useState<string | undefined>();

  const formatOptionsRef = useValueAsRef(format);

  let status: ProgressStatus = 'indeterminate';
  if (Number.isFinite(value)) {
    status = value === max ? 'complete' : 'progressing';
  }

  const formattedValue = formatNumberValue(value, locale, formatOptionsRef.current);

  const state: ProgressRootState = React.useMemo(() => ({ status }), [status]);

  const defaultProps: HTMLProps = {
    'aria-labelledby': labelId,
    'aria-valuemax': max,
    'aria-valuemin': min,
    'aria-valuenow': value ?? undefined,
    'aria-valuetext': getAriaValueText(formattedValue, value),
    role: 'progressbar',
    children: (
      <React.Fragment>
        {children}
        <span role="presentation" style={visuallyHidden}>
          {/* force NVDA to read the label https://github.com/mui/base-ui/issues/4184 */}x
        </span>
      </React.Fragment>
    ),
  };

  const contextValue: ProgressRootContext = React.useMemo(
    () => ({
      formattedValue,
      max,
      min,
      setLabelId,
      state,
      status,
      value,
    }),
    [formattedValue, max, min, setLabelId, state, status, value],
  );

  const element = useRenderElement('div', componentProps, {
    state,
    ref: forwardedRef,
    props: [defaultProps, elementProps],
    stateAttributesMapping: progressStateAttributesMapping,
  });

  return (
    <ProgressRootContext.Provider value={contextValue}>{element}</ProgressRootContext.Provider>
  );
});

export type ProgressStatus = 'indeterminate' | 'progressing' | 'complete';

export interface ProgressRootState {
  /**
   * The current status.
   */
  status: ProgressStatus;
}

export interface ProgressRootProps extends BaseUIComponentProps<'div', ProgressRootState> {
  /**
   * A string value that provides a user-friendly name for `aria-valuenow`, the current value of the progress bar.
   */
  'aria-valuetext'?: React.AriaAttributes['aria-valuetext'] | undefined;
  /**
   * Options to format the value.
   */
  format?: Intl.NumberFormatOptions | undefined;
  /**
   * Accepts a function which returns a string value that provides a human-readable text alternative for the current value of the progress bar.
   */
  getAriaValueText?: ((formattedValue: string | null, value: number | null) => string) | undefined;
  /**
   * The locale used by `Intl.NumberFormat` when formatting the value.
   * Defaults to the user's runtime locale.
   */
  locale?: Intl.LocalesArgument | undefined;
  /**
   * The maximum value.
   * @default 100
   */
  max?: number | undefined;
  /**
   * The minimum value.
   * @default 0
   */
  min?: number | undefined;
  /**
   * The current value. The component is indeterminate when value is `null`.
   * @default null
   */
  value: number | null;
}

export namespace ProgressRoot {
  export type State = ProgressRootState;
  export type Props = ProgressRootProps;
}
