'use client';
import * as React from 'react';
import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
import { type FieldRootState } from '../root/FieldRoot';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { fieldValidityMapping } from '../../internals/field-constants/constants';
import { useFormContext } from '../../internals/form-context/FormContext';
import type { BaseUIComponentProps } from '../../internals/types';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { useRenderElement } from '../../internals/useRenderElement';
import { useBaseUiId } from '../../internals/useBaseUiId';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import { type TransitionStatus, useTransitionStatus } from '../../internals/useTransitionStatus';

const stateAttributesMapping: StateAttributesMapping<FieldErrorState> = {
  ...fieldValidityMapping,
  ...transitionStatusMapping,
};

/**
 * An error message displayed if the field control fails validation.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Field](https://base-ui.com/react/components/field)
 */
export const FieldError = React.forwardRef(function FieldError(
  componentProps: FieldError.Props,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const { render, id: idProp, className, match, style, ...elementProps } = componentProps;

  const id = useBaseUiId(idProp);

  const { validityData, state: fieldState, name } = useFieldRootContext(false);
  const { setMessageIds } = useLabelableContext();

  const { errors } = useFormContext();

  const formError = name && Object.hasOwn(errors, name) ? errors[name] : null;
  const hasFormError = !!(Array.isArray(formError) ? formError.length : formError);
  const hasSpecificMatch = typeof match === 'string';

  let rendered = false;
  if (match === true) {
    rendered = true;
  } else if (fieldState.disabled) {
    rendered = false;
  } else if (hasSpecificMatch) {
    rendered = Boolean(validityData.state[match]);
  } else {
    rendered = hasFormError || validityData.state.valid === false;
  }

  const { mounted, transitionStatus, setMounted } = useTransitionStatus(rendered);

  useIsoLayoutEffect(() => {
    if (!rendered || !id) {
      return undefined;
    }

    setMessageIds((v) => v.concat(id));

    return () => {
      setMessageIds((v) => v.filter((item) => item !== id));
    };
  }, [rendered, id, setMessageIds]);

  const errorRef = React.useRef<HTMLDivElement | null>(null);
  const [lastRenderedMessage, setLastRenderedMessage] = React.useState<React.ReactNode>(null);
  const [lastRenderedMessageKey, setLastRenderedMessageKey] = React.useState<string | null>(null);

  let error: string | string[] | null | undefined = validityData.error;
  if (!hasSpecificMatch && hasFormError) {
    error = formError;
  } else if (validityData.errors.length > 1) {
    error = validityData.errors;
  }

  let errorMessage: React.ReactNode = error ?? '';
  if (Array.isArray(error)) {
    errorMessage =
      error.length > 1 ? (
        <ul>
          {error.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : (
        (error[0] ?? '')
      );
  }

  const errorKey = Array.isArray(error) ? JSON.stringify(error) : error;

  if (rendered && errorKey !== lastRenderedMessageKey) {
    setLastRenderedMessageKey(errorKey);
    setLastRenderedMessage(errorMessage);
  }

  useOpenChangeComplete({
    open: rendered,
    ref: errorRef,
    onComplete() {
      if (!rendered) {
        setMounted(false);
      }
    },
  });

  const state: FieldErrorState = {
    ...fieldState,
    transitionStatus,
  };

  const element = useRenderElement('div', componentProps, {
    ref: [forwardedRef, errorRef],
    state,
    props: [
      {
        id,
        children: rendered ? errorMessage : lastRenderedMessage,
      },
      elementProps,
    ],
    stateAttributesMapping,
    enabled: mounted,
  });

  if (!mounted) {
    return null;
  }

  return element;
});

export interface FieldErrorState extends FieldRootState {
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface FieldErrorProps extends BaseUIComponentProps<'div', FieldErrorState> {
  /**
   * Determines whether to show the error message according to the field's
   * [ValidityState](https://developer.mozilla.org/en-US/docs/Web/API/ValidityState).
   * Specifying `true` will always show the error message, and lets external libraries
   * control the visibility.
   */
  match?: boolean | keyof ValidityState | undefined;
}

export namespace FieldError {
  export type State = FieldErrorState;
  export type Props = FieldErrorProps;
}
