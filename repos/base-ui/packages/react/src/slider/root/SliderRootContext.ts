'use client';
import * as React from 'react';
import type { Orientation } from '../../internals/types';
import type { CompositeMetadata } from '../../internals/composite/list/CompositeList';
import type { UseFieldValidationReturnValue } from '../../field/root/useFieldValidation';
import type { ThumbMetadata } from '../thumb/SliderThumb';
import type { SliderRoot, SliderRootState } from './SliderRoot';

export interface SliderRootContext {
  /**
   * The index of the active thumb.
   */
  active: number;
  /**
   * The index of the most recently interacted thumb.
   */
  lastUsedThumbIndex: number;
  controlRef: React.RefObject<HTMLElement | null>;
  dragging: boolean;
  disabled: boolean;
  validation: UseFieldValidationReturnValue;
  formatOptionsRef: React.RefObject<Intl.NumberFormatOptions | undefined>;
  handleInputChange: (
    valueInput: number,
    index: number,
    event: React.KeyboardEvent | React.ChangeEvent,
  ) => void;
  indicatorPosition: (number | undefined)[];
  inset: boolean;
  labelId?: string | undefined;
  rootLabelId?: string | undefined;
  /**
   * The large step value of the slider when incrementing or decrementing while the shift key is held,
   * or when using Page-Up or Page-Down keys. Snaps to multiples of this value.
   * @default 10
   */
  largeStep: number;
  lastChangeReasonRef: React.RefObject<SliderRoot.ChangeEventReason>;
  /**
   * The locale used by `Intl.NumberFormat` when formatting the value.
   * Defaults to the user's runtime locale.
   */
  locale?: Intl.LocalesArgument | undefined;
  /**
   * The maximum allowed value of the slider.
   */
  max: number;
  /**
   * The minimum allowed value of the slider.
   */
  min: number;
  /**
   * The minimum steps between values in a range slider.
   */
  minStepsBetweenValues: number;
  form: string | undefined;
  name: string | undefined;
  /**
   * Function to be called when drag ends and the pointer is released.
   */
  onValueCommitted: (
    newValue: number | readonly number[],
    data: SliderRoot.CommitEventDetails,
  ) => void;
  /**
   * The component orientation.
   * @default 'horizontal'
   */
  orientation: Orientation;
  pressedInputRef: React.RefObject<HTMLInputElement | null>;
  pressedThumbCenterOffsetRef: React.RefObject<number | null>;
  pressedThumbIndexRef: React.RefObject<number>;
  pressedValuesRef: React.RefObject<readonly number[] | null>;
  renderBeforeHydration: boolean;
  registerFieldControlRef: React.RefCallback<Element> | null;
  setActive: (index: number) => void;
  setDragging: React.Dispatch<React.SetStateAction<boolean>>;
  setIndicatorPosition: React.Dispatch<React.SetStateAction<(number | undefined)[]>>;
  setLabelId: React.Dispatch<React.SetStateAction<string | undefined>>;
  /**
   * Applies a new value through `onValueChange` for keyboard, input, track-press,
   * and drag interactions. Returns `true` when the value was applied, or `false`
   * when it was invalid (NaN), unchanged, or the change was canceled.
   */
  setValue: (newValue: number | number[], details?: SliderRoot.ChangeEventDetails) => boolean;
  state: SliderRootState;
  /**
   * The step increment of the slider when incrementing or decrementing. It will snap
   * to multiples of this value. Decimal values are supported.
   * @default 1
   */
  step: number;
  thumbCollisionBehavior: 'push' | 'swap' | 'none';
  thumbMap: Map<Node, CompositeMetadata<ThumbMetadata> | null>;
  thumbRefs: React.RefObject<(HTMLElement | null)[]>;
  /**
   * The value(s) of the slider
   */
  values: readonly number[];
}

export const SliderRootContext = React.createContext<SliderRootContext | undefined>(undefined);

export function useSliderRootContext() {
  const context = React.useContext(SliderRootContext);
  if (context === undefined) {
    throw new Error(
      'Base UI: SliderRootContext is missing. Slider parts must be placed within <Slider.Root>.',
    );
  }
  return context;
}
