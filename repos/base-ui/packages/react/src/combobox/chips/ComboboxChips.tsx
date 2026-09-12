'use client';
import * as React from 'react';
import { useStore } from '@base-ui/utils/store';
import { EMPTY_OBJECT } from '@base-ui/utils/empty';
import { useRenderElement } from '../../internals/useRenderElement';
import type { BaseUIComponentProps } from '../../internals/types';
import { ComboboxChipsContext } from './ComboboxChipsContext';
import { CompositeList } from '../../internals/composite/list/CompositeList';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import { selectors } from '../store';
import { handleInputPress } from '../utils/handleInputPress';

/**
 * A container for the chips in a multiselectable input.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export const ComboboxChips = React.forwardRef(function ComboboxChips(
  componentProps: ComboboxChips.Props,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const { render, className, style, ...elementProps } = componentProps;

  const store = useComboboxRootContext();

  const open = useStore(store, selectors.open);
  const hasSelectionChips = useStore(store, selectors.hasSelectionChips);

  const [highlightedChipIndex, setHighlightedChipIndex] = React.useState<number | undefined>(
    undefined,
  );

  if (open && highlightedChipIndex !== undefined) {
    setHighlightedChipIndex(undefined);
  }

  const chipsRef = React.useRef<Array<HTMLButtonElement | null>>([]);

  const element = useRenderElement('div', componentProps, {
    ref: [forwardedRef, store.state.chipsContainerRef],
    // NVDA enters browse mode instead of staying in focus mode when navigating with
    // arrow keys inside a container unless it has a toolbar role.
    props: [
      hasSelectionChips ? { role: 'toolbar' } : EMPTY_OBJECT,
      {
        onMouseDown(event) {
          handleInputPress(event, store, store.state.disabled, store.state.readOnly);
        },
      },
      elementProps,
    ],
  });

  const contextValue: ComboboxChipsContext = React.useMemo(
    () => ({
      highlightedChipIndex,
      setHighlightedChipIndex,
      chipsRef,
    }),
    [highlightedChipIndex, setHighlightedChipIndex, chipsRef],
  );

  return (
    <ComboboxChipsContext.Provider value={contextValue}>
      <CompositeList elementsRef={chipsRef}>{element}</CompositeList>
    </ComboboxChipsContext.Provider>
  );
});

export interface ComboboxChipsState {}

export interface ComboboxChipsProps extends BaseUIComponentProps<'div', ComboboxChipsState> {}

export namespace ComboboxChips {
  export type State = ComboboxChipsState;
  export type Props = ComboboxChipsProps;
}
