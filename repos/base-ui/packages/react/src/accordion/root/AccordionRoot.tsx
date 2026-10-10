'use client';
import * as React from 'react';
import { useControlled } from '@base-ui/utils/useControlled';
import { useStableCallback } from '@base-ui/utils/useStableCallback';
import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
import { warn } from '@base-ui/utils/warn';
import { BaseUIComponentProps, Orientation } from '../../internals/types';
import { CompositeList } from '../../internals/composite/list/CompositeList';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { AccordionRootContext } from './AccordionRootContext';
import { useRenderElement } from '../../internals/useRenderElement';
import { type BaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';

const rootStateAttributesMapping = {
  value: () => null,
};

/**
 * Groups all parts of the accordion.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Accordion](https://base-ui.com/react/components/accordion)
 */
export const AccordionRoot = React.forwardRef(function AccordionRoot<Value = any>(
  componentProps: AccordionRoot.Props<Value>,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const {
    render,
    className,
    disabled = false,
    hiddenUntilFound: hiddenUntilFoundProp,
    keepMounted: keepMountedProp,
    loopFocus,
    onValueChange,
    multiple = false,
    orientation = 'vertical',
    value: valueProp,
    defaultValue: defaultValueProp,
    style,
    ...elementProps
  } = componentProps;

  const direction = useDirection();

  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useIsoLayoutEffect(() => {
      if (hiddenUntilFoundProp && keepMountedProp === false) {
        warn(
          'The `keepMounted={false}` prop on `Accordion.Root` is ignored when `hiddenUntilFound` is enabled, since panels must remain mounted while closed.',
        );
      }
    }, [hiddenUntilFoundProp, keepMountedProp]);
  }

  // memoized to allow omitting both defaultValue and value
  // which would otherwise trigger a warning in useControlled
  const defaultValue = React.useMemo(() => {
    if (valueProp === undefined) {
      return defaultValueProp ?? [];
    }

    return undefined;
  }, [valueProp, defaultValueProp]);

  const accordionItemRefs = React.useRef<(HTMLElement | null)[]>([]);

  const [value, setValue] = useControlled({
    controlled: valueProp,
    default: defaultValue,
    name: 'Accordion',
    state: 'value',
  });

  const handleValueChange = useStableCallback(
    (
      newValue: AccordionRoot.Value<Value>[number],
      nextOpen: boolean,
      details: AccordionRoot.ChangeEventDetails,
    ) => {
      if (!multiple) {
        const nextValue = value[0] === newValue ? [] : [newValue];
        onValueChange?.(nextValue, details);
        if (details.isCanceled) {
          return;
        }
        setValue(nextValue);
      } else if (nextOpen) {
        const nextOpenValues = value.slice();
        nextOpenValues.push(newValue);
        onValueChange?.(nextOpenValues, details);
        if (details.isCanceled) {
          return;
        }
        setValue(nextOpenValues);
      } else {
        const nextOpenValues = value.filter((v) => v !== newValue);
        onValueChange?.(nextOpenValues, details);
        if (details.isCanceled) {
          return;
        }
        setValue(nextOpenValues);
      }
    },
  );

  const state: AccordionRoot.State<Value> = React.useMemo(
    () => ({
      value,
      disabled,
      orientation,
    }),
    [value, disabled, orientation],
  );

  const contextValue: AccordionRootContext<Value> = React.useMemo(
    () => ({
      disabled,
      handleValueChange,
      hiddenUntilFound: hiddenUntilFoundProp ?? false,
      keepMounted: keepMountedProp ?? false,
      state,
      value,
    }),
    [disabled, handleValueChange, hiddenUntilFoundProp, keepMountedProp, state, value],
  );

  const element = useRenderElement('div', componentProps, {
    state,
    ref: forwardedRef,
    props: [
      {
        dir: direction,
      },
      elementProps,
    ],
    stateAttributesMapping: rootStateAttributesMapping,
  });

  return (
    <AccordionRootContext.Provider value={contextValue}>
      <CompositeList elementsRef={accordionItemRefs}>{element}</CompositeList>
    </AccordionRootContext.Provider>
  );
}) as {
  <Value = any>(props: AccordionRoot.Props<Value>): React.JSX.Element;
};

export type AccordionValue<Value = any> = Value[];

export interface AccordionRootState<Value = any> {
  /**
   * The current value.
   */
  value: AccordionValue<Value>;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * The component orientation.
   *
   * Deprecated following the [APG guidance update](https://github.com/w3c/aria-practices/pull/3434)
   * to remove roving focus.
   *
   * This state no longer affects keyboard focus behavior.
   * @deprecated
   */
  orientation: Orientation;
}

export interface AccordionRootProps<Value = any> extends BaseUIComponentProps<
  'div',
  AccordionRoot.State<Value>
> {
  /**
   * The controlled value of the item(s) that should be expanded.
   *
   * To render an uncontrolled accordion, use the `defaultValue` prop instead.
   */
  value?: AccordionValue<Value> | undefined;
  /**
   * The uncontrolled value of the item(s) that should be initially expanded.
   *
   * To render a controlled accordion, use the `value` prop instead.
   */
  defaultValue?: AccordionValue<Value> | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Allows the browser's built-in page search to find and expand the panel contents.
   *
   * Overrides the `keepMounted` prop and uses `hidden="until-found"`
   * to hide the element without removing it from the DOM.
   * @default false
   */
  hiddenUntilFound?: boolean | undefined;
  /**
   * Whether to keep the element in the DOM while the panel is closed.
   * This prop is ignored when `hiddenUntilFound` is used.
   * @default false
   */
  keepMounted?: boolean | undefined;
  /**
   * Deprecated following the [APG guidance update](https://github.com/w3c/aria-practices/pull/3434)
   * to remove roving focus.
   *
   * This prop no longer affects keyboard focus behavior.
   * @deprecated
   */
  loopFocus?: boolean | undefined;
  /**
   * Event handler called when an accordion item is expanded or collapsed.
   * Provides the new value as an argument.
   */
  onValueChange?:
    | ((value: AccordionValue<Value>, eventDetails: AccordionRootChangeEventDetails) => void)
    | undefined;
  /**
   * Whether multiple items can be open at the same time.
   * @default false
   */
  multiple?: boolean | undefined;
  /**
   * Deprecated following the [APG guidance update](https://github.com/w3c/aria-practices/pull/3434)
   * to remove roving focus.
   *
   * This prop no longer affects keyboard focus behavior.
   * @default 'vertical'
   * @deprecated
   */
  orientation?: Orientation | undefined;
}

export type AccordionRootChangeEventReason = typeof REASONS.triggerPress | typeof REASONS.none;

export type AccordionRootChangeEventDetails =
  BaseUIChangeEventDetails<AccordionRoot.ChangeEventReason>;

export namespace AccordionRoot {
  export type Value<TValue = any> = AccordionValue<TValue>;
  export type State<TValue = any> = AccordionRootState<TValue>;
  export type Props<TValue = any> = AccordionRootProps<TValue>;
  export type ChangeEventReason = AccordionRootChangeEventReason;
  export type ChangeEventDetails = AccordionRootChangeEventDetails;
}
