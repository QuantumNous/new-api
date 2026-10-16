'use client';
import * as React from 'react';
import { isHTMLElement } from '@floating-ui/utils/dom';
import { ownerDocument } from '@base-ui/utils/owner';
import { focusElementWithVisible, useLabel } from '../../internals/labelable-provider/useLabel';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import type { SliderRoot } from '../root/SliderRoot';
import { useSliderRootContext } from '../root/SliderRootContext';
import { sliderStateAttributesMapping } from '../root/stateAttributesMapping';

/**
 * An accessible label that is automatically associated with the slider thumbs.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Slider](https://base-ui.com/react/components/slider)
 */
export const SliderLabel = React.forwardRef(function SliderLabel(
  componentProps: SliderLabel.Props,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const { render, className, style, ...elementProps } = componentProps;
  // Keep label id derived from the root and ignore runtime `id` overrides from untyped consumers.
  const elementPropsWithoutId = elementProps as typeof elementProps & { id?: string | undefined };
  delete elementPropsWithoutId.id;

  const { state, setLabelId, controlRef, rootLabelId } = useSliderRootContext();

  function focusControl(event: React.MouseEvent, controlId: string | null | undefined) {
    if (controlId) {
      const controlElement = ownerDocument(event.currentTarget).getElementById(controlId);
      if (isHTMLElement(controlElement)) {
        focusElementWithVisible(controlElement);
        return;
      }
    }

    const fallbackInputs = controlRef.current?.querySelectorAll('input[type="range"]');
    const fallbackInput = fallbackInputs?.length === 1 ? fallbackInputs[0] : null;
    if (isHTMLElement(fallbackInput)) {
      focusElementWithVisible(fallbackInput);
    }
  }

  const labelProps = useLabel({
    id: rootLabelId,
    setLabelId,
    focusControl,
  });

  return useRenderElement('div', componentProps, {
    ref: forwardedRef,
    state,
    props: [labelProps, elementProps],
    stateAttributesMapping: sliderStateAttributesMapping,
  });
});

export type SliderLabelState = SliderRoot.State;

export interface SliderLabelProps extends Omit<
  BaseUIComponentProps<'div', SliderLabel.State>,
  'id'
> {}

export namespace SliderLabel {
  export type State = SliderLabelState;
  export type Props = SliderLabelProps;
}
