'use client';
import * as React from 'react';
import { useControlled } from '@base-ui/utils/useControlled';
import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
import { useOnFirstRender } from '@base-ui/utils/useOnFirstRender';
import { useStableCallback } from '@base-ui/utils/useStableCallback';
import { useMergedRefs } from '@base-ui/utils/useMergedRefs';
import { useValueAsRef } from '@base-ui/utils/useValueAsRef';
import { visuallyHidden, visuallyHiddenInput } from '@base-ui/utils/visuallyHidden';
import { useRefWithInit } from '@base-ui/utils/useRefWithInit';
import { Store, useStore } from '@base-ui/utils/store';
import { EMPTY_ARRAY, EMPTY_OBJECT } from '@base-ui/utils/empty';
import {
  ElementProps,
  useDismiss,
  useFloatingRootContext,
  useListNavigation,
  useClick,
} from '../../floating-ui-react';
import { gridNavigation } from '../../floating-ui-react/hooks/gridNavigation';
import { contains, getTarget } from '../../floating-ui-react/utils';
import {
  createChangeEventDetails,
  createGenericEventDetails,
  type BaseUIChangeEventDetails,
  type BaseUIGenericEventDetails,
} from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import {
  ComboboxFloatingContext,
  ComboboxDerivedItemsContext,
  ComboboxHasItemsContext,
  ComboboxRootContext,
  ComboboxInputValueContext,
} from './ComboboxRootContext';
import { selectors, type State as StoreState } from '../store';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { useRegisterFieldControl } from '../../internals/field-register-control/useRegisterFieldControl';
import { useFormContext } from '../../internals/form-context/FormContext';
import { useLabelableId } from '../../internals/labelable-provider/useLabelableId';
import { createCollatorItemFilter, createSingleSelectionCollatorFilter } from './utils';
import { useCoreFilter } from './utils/useFilter';
import { useTransitionStatus } from '../../internals/useTransitionStatus';
import { useOpenInteractionType } from '../../utils/useOpenInteractionType';
import type { BaseUIEvent, HTMLProps } from '../../internals/types';
import { useValueChanged } from '../../internals/useValueChanged';
import { NOOP } from '../../internals/noop';
import { FOCUSABLE_POPUP_PROPS } from '../../utils/popups';
import { mergeProps } from '../../merge-props';
import {
  stringifyAsLabel,
  stringifyAsValue,
  Group,
  isGroupedItems,
} from '../../internals/resolveValueLabel';
import {
  compareItemEquality,
  defaultItemEquality,
  findItemIndex,
  removeItem,
  selectedValueIncludes,
} from '../../internals/itemEquality';
import { areArraysEqual } from '../../internals/areArraysEqual';
import { INITIAL_LAST_HIGHLIGHT, NO_ACTIVE_VALUE } from './utils/constants';
import { useDirection } from '../../internals/direction-context/DirectionContext';

/**
 * @internal
 */
export function AriaCombobox<Value, Mode extends SelectionMode = 'none'>(
  props: Omit<AriaComboboxProps<Value, Mode>, 'items'> & {
    items: readonly Group<any>[];
  },
): React.JSX.Element;
export function AriaCombobox<Value, Mode extends SelectionMode = 'none'>(
  props: Omit<AriaComboboxProps<Value, Mode>, 'items'> & {
    items?: readonly any[] | undefined;
  },
): React.JSX.Element;
export function AriaCombobox<Value = any, Mode extends SelectionMode = 'none'>(
  props: AriaComboboxProps<Value, Mode>,
): React.JSX.Element {
  const {
    id: idProp,
    onOpenChangeComplete: onOpenChangeCompleteProp,
    defaultSelectedValue = null,
    selectedValue: selectedValueProp,
    onSelectedValueChange,
    defaultInputValue: defaultInputValueProp,
    inputValue: inputValueProp,
    open: openProp,
    defaultOpen = false,
    selectionMode = 'none',
    onItemHighlighted: onItemHighlightedProp,
    name: nameProp,
    form,
    disabled: disabledProp = false,
    readOnly = false,
    required = false,
    inputRef: inputRefProp,
    grid = false,
    items,
    filteredItems: filteredItemsProp,
    filter: filterProp,
    openOnInputClick = true,
    autoHighlight = false,
    keepHighlight = false,
    highlightItemOnHover = true,
    loopFocus = true,
    itemToStringLabel,
    itemToStringValue,
    isItemEqualToValue = defaultItemEquality,
    virtualized = false,
    inline: inlineProp = false,
    fillInputOnItemPress = true,
    modal = false,
    limit = -1,
    autoComplete = 'list',
    formAutoComplete,
    locale,
    submitOnItemClick = false,
  } = props;

  const { clearErrors } = useFormContext();
  const {
    setDirty,
    validityData,
    setFilled,
    name: fieldName,
    disabled: fieldDisabled,
    setTouched,
    setFocused,
    validationMode,
    validation,
  } = useFieldRootContext();

  const direction = useDirection();
  const id = useLabelableId({ id: idProp });
  const collatorFilter = useCoreFilter({ locale });

  const [queryChangedAfterOpen, setQueryChangedAfterOpen] = React.useState(false);
  const [closeQuery, setCloseQuery] = React.useState<string | null>(null);

  const listRef = React.useRef<Array<HTMLElement | null>>([]);
  const labelsRef = React.useRef<Array<string | null>>([]);
  const popupRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const startDismissRef = React.useRef<HTMLSpanElement | null>(null);
  const endDismissRef = React.useRef<HTMLSpanElement | null>(null);
  const emptyRef = React.useRef<HTMLDivElement | null>(null);
  const keyboardActiveRef = React.useRef(true);
  const hadInputClearRef = React.useRef(false);
  const chipsContainerRef = React.useRef<HTMLDivElement | null>(null);
  const clearRef = React.useRef<HTMLButtonElement | null>(null);
  const selectionEventRef = React.useRef<MouseEvent | PointerEvent | KeyboardEvent | null>(null);
  const lastHighlightRef = React.useRef(INITIAL_LAST_HIGHLIGHT);
  const pendingQueryHighlightRef = React.useRef<null | { hasQuery: boolean }>(null);

  /**
   * Contains the currently visible list of item values post-filtering.
   */
  const valuesRef = React.useRef<any[]>([]);
  /**
   * Contains all item values in a stable, unfiltered order.
   * This is only used when `items` prop is not provided.
   * It accumulates values on first mount and does not remove them on unmount due to
   * filtering, providing a stable index for selected value tracking.
   */
  const allValuesRef = React.useRef<any[]>([]);

  const disabled = fieldDisabled || disabledProp;
  const name = fieldName ?? nameProp;
  const multiple = selectionMode === 'multiple';
  const single = selectionMode === 'single';
  const hasInputValue = inputValueProp !== undefined || defaultInputValueProp !== undefined;
  const hasItems = items !== undefined;
  const hasFilteredItemsProp = filteredItemsProp !== undefined;

  let autoHighlightMode: false | 'input-change' | 'always';
  if (autoHighlight === 'always') {
    autoHighlightMode = 'always';
  } else {
    autoHighlightMode = autoHighlight ? 'input-change' : false;
  }

  const [selectedValue, setSelectedValueUnwrapped] = useControlled<any>({
    controlled: selectedValueProp,
    default: multiple ? (defaultSelectedValue ?? EMPTY_ARRAY) : defaultSelectedValue,
    name: 'Combobox',
    state: 'selectedValue',
  });

  const filter = React.useMemo(() => {
    if (filterProp === null) {
      return () => true;
    }
    if (filterProp !== undefined) {
      return filterProp;
    }
    if (single && !queryChangedAfterOpen) {
      return createSingleSelectionCollatorFilter(collatorFilter, itemToStringLabel, selectedValue);
    }
    return createCollatorItemFilter(collatorFilter, itemToStringLabel);
  }, [filterProp, single, selectedValue, queryChangedAfterOpen, collatorFilter, itemToStringLabel]);

  // If neither inputValue nor defaultInputValue are provided, derive it from the
  // selected value for single mode so the input reflects the selection on mount.
  const initialDefaultInputValue = useRefWithInit<React.ComponentProps<'input'>['defaultValue']>(
    () => {
      if (hasInputValue) {
        return defaultInputValueProp ?? '';
      }
      if (single) {
        return stringifyAsLabel(selectedValue, itemToStringLabel);
      }
      return '';
    },
  ).current;

  const [inputValue, setInputValueUnwrapped] = useControlled({
    controlled: inputValueProp,
    default: initialDefaultInputValue,
    name: 'Combobox',
    state: 'inputValue',
  });

  const [open, setOpenUnwrapped] = useControlled({
    controlled: openProp,
    default: defaultOpen,
    name: 'Combobox',
    state: 'open',
  });

  const isGrouped = isGroupedItems(items);
  const query = closeQuery ?? (inputValue === '' ? '' : String(inputValue).trim());

  const selectedLabelString = single ? stringifyAsLabel(selectedValue, itemToStringLabel) : '';

  const shouldBypassFiltering =
    single &&
    !queryChangedAfterOpen &&
    query !== '' &&
    selectedLabelString !== '' &&
    selectedLabelString.length === query.length &&
    collatorFilter.contains(selectedLabelString, query);

  const filterQuery = shouldBypassFiltering ? '' : query;
  const shouldIgnoreExternalFiltering = hasItems && hasFilteredItemsProp && shouldBypassFiltering;

  const flatItems: readonly any[] = React.useMemo(() => {
    if (!items) {
      return EMPTY_ARRAY;
    }

    if (isGrouped) {
      return items.flatMap((group) => group.items);
    }

    return items;
  }, [items, isGrouped]);

  const filteredItems: Value[] | Group<Value>[] = React.useMemo(() => {
    if (filteredItemsProp && !shouldIgnoreExternalFiltering) {
      return filteredItemsProp as Value[] | Group<Value>[];
    }

    if (!items) {
      return EMPTY_ARRAY as Value[];
    }

    if (isGrouped) {
      const groupedItems = items;
      const resultingGroups: Group<Value>[] = [];
      let currentCount = 0;

      for (const group of groupedItems) {
        if (limit > -1 && currentCount >= limit) {
          break;
        }

        const candidateItems =
          filterQuery === ''
            ? group.items
            : group.items.filter((item) => filter(item, filterQuery, itemToStringLabel));

        if (candidateItems.length === 0) {
          continue;
        }

        const remainingLimit = limit > -1 ? limit - currentCount : Infinity;
        const itemsToTake = candidateItems.slice(0, remainingLimit);

        if (itemsToTake.length > 0) {
          const newGroup = { ...group, items: itemsToTake };
          resultingGroups.push(newGroup);
          currentCount += itemsToTake.length;
        }
      }

      return resultingGroups;
    }

    if (filterQuery === '') {
      return limit > -1
        ? flatItems.slice(0, limit)
        : // The cast here is done as `flatItems` is readonly.
          // valuesRef.current, a mutable ref, can be set to `flatFilteredItems`, which may
          // reference this exact readonly value, creating a mutation risk.
          // However, <Combobox.Item> can never mutate this value as the mutating effect
          // bails early when `items` is provided, and this is only ever returned
          // when `items` is provided due to the early return at the top of this hook.
          (flatItems as Value[]);
    }

    const limitedItems: Value[] = [];
    for (const item of flatItems) {
      if (limit > -1 && limitedItems.length >= limit) {
        break;
      }
      if (filter(item, filterQuery, itemToStringLabel)) {
        limitedItems.push(item);
      }
    }

    return limitedItems;
  }, [
    filteredItemsProp,
    shouldIgnoreExternalFiltering,
    items,
    isGrouped,
    filterQuery,
    limit,
    filter,
    itemToStringLabel,
    flatItems,
  ]);

  const flatFilteredItems: Value[] = React.useMemo(() => {
    if (isGrouped) {
      const groups = filteredItems as Group<Value>[];
      return groups.flatMap((g) => g.items);
    }
    return filteredItems as Value[];
  }, [filteredItems, isGrouped]);

  const store = useRefWithInit(
    () =>
      new Store<StoreState>({
        id,
        labelId: undefined,
        selectedValue,
        open,
        filter,
        query,
        items,
        selectionMode,
        listRef,
        labelsRef,
        popupRef,
        emptyRef,
        inputRef,
        startDismissRef,
        endDismissRef,
        keyboardActiveRef,
        chipsContainerRef,
        clearRef,
        valuesRef,
        allValuesRef,
        selectionEventRef,
        name,
        form,
        disabled,
        readOnly,
        required,
        grid,
        isGrouped,
        virtualized,
        openOnInputClick,
        itemToStringLabel,
        isItemEqualToValue,
        modal,
        autoHighlight: autoHighlightMode,
        submitOnItemClick,
        hasInputValue,
        mounted: false,
        forceMounted: false,
        transitionStatus: 'idle',
        inline: inlineProp,
        activeIndex: null,
        selectedIndex: null,
        popupProps: {},
        inputProps: {},
        triggerProps: {},
        itemProps: EMPTY_OBJECT,
        positionerElement: null,
        listElement: null,
        popupId: undefined,
        triggerElement: null,
        inputElement: null,
        inputGroupElement: null,
        popupSide: null,
        openMethod: null,
        inputInsidePopup: true,
        // Avoid duplicate names in the server HTML. Popup inputs aren't rendered
        // until after hydration, so the hidden input takes over then if needed.
        inputOwnsFormValue: selectionMode === 'none',
        onOpenChangeComplete: onOpenChangeCompleteProp || NOOP,
        // Placeholder callbacks replaced on first render
        setOpen: NOOP,
        setInputValue: NOOP,
        setSelectedValue: NOOP,
        setIndices: NOOP,
        onItemHighlighted: NOOP,
        handleSelection: NOOP,
        forceMount: NOOP,
        requestSubmit: NOOP,
      }),
  ).current;

  const fieldRawValue = selectionMode === 'none' ? inputValue : selectedValue;
  const fieldStringValue = React.useMemo(() => {
    if (selectionMode === 'none') {
      return fieldRawValue;
    }
    if (Array.isArray(selectedValue)) {
      return selectedValue.map((value) => stringifyAsValue(value, itemToStringValue));
    }
    return stringifyAsValue(selectedValue, itemToStringValue);
  }, [fieldRawValue, itemToStringValue, selectionMode, selectedValue]);

  const onItemHighlighted = useStableCallback(onItemHighlightedProp);
  const onOpenChangeComplete = useStableCallback(onOpenChangeCompleteProp);

  const activeIndex = useStore(store, selectors.activeIndex);
  const selectedIndex = useStore(store, selectors.selectedIndex);
  const positionerElement = useStore(store, selectors.positionerElement);
  const listElement = useStore(store, selectors.listElement);
  const triggerElement = useStore(store, selectors.triggerElement);
  const inputElement = useStore(store, selectors.inputElement);
  const inputGroupElement = useStore(store, selectors.inputGroupElement);
  const inline = useStore(store, selectors.inline);
  const inputInsidePopup = useStore(store, selectors.inputInsidePopup);
  const inputOwnsFormValue = useStore(store, selectors.inputOwnsFormValue);

  const triggerRef = useValueAsRef(triggerElement);

  const { mounted, setMounted, transitionStatus } = useTransitionStatus(open);
  const { openMethod, triggerProps } = useOpenInteractionType(open);

  const getStringifiedValueForForm = useStableCallback(() => fieldStringValue);

  useRegisterFieldControl(
    inputInsidePopup ? triggerRef : inputRef,
    id,
    fieldRawValue,
    getStringifiedValueForForm,
    !disabled,
    nameProp,
  );

  const forceMount = useStableCallback(() => {
    if (items) {
      // Ensure typeahead works on a closed list.
      labelsRef.current = flatFilteredItems.map((item) =>
        stringifyAsLabel(item, itemToStringLabel),
      );
    } else {
      store.set('forceMounted', true);
    }
  });

  const initialSelectedValueRef = React.useRef(selectedValue);
  useIsoLayoutEffect(() => {
    // Ensure the values and labels are registered for programmatic value changes.
    if (selectedValue !== initialSelectedValueRef.current) {
      forceMount();
    }
  }, [forceMount, selectedValue]);

  const setIndices = useStableCallback(
    (options: {
      activeIndex?: number | null | undefined;
      selectedIndex?: number | null | undefined;
      type?: 'none' | 'keyboard' | 'pointer' | undefined;
    }) => {
      store.update(options);
      const type: AriaCombobox.HighlightEventReason = options.type || 'none';
      if (options.activeIndex === undefined) {
        return;
      }

      if (options.activeIndex === null) {
        if (lastHighlightRef.current !== INITIAL_LAST_HIGHLIGHT) {
          lastHighlightRef.current = INITIAL_LAST_HIGHLIGHT;
          onItemHighlighted(undefined, createGenericEventDetails(type, undefined, { index: -1 }));
        }
      } else {
        const activeValue = valuesRef.current[options.activeIndex];
        lastHighlightRef.current = { value: activeValue, index: options.activeIndex };
        onItemHighlighted(
          activeValue,
          createGenericEventDetails(type, undefined, {
            index: options.activeIndex,
          }),
        );
      }
    },
  );

  const setInputValue = useStableCallback(
    (next: string, eventDetails: AriaCombobox.ChangeEventDetails) => {
      hadInputClearRef.current = eventDetails.reason === REASONS.inputClear;

      props.onInputValueChange?.(next, eventDetails);

      if (eventDetails.isCanceled) {
        return;
      }

      // If user is typing, ensure we don't auto-highlight on open due to a race
      // with the post-open effect that sets this flag.
      if (eventDetails.reason === REASONS.inputChange) {
        const event = eventDetails.event as Event;
        const inputType = (event as InputEvent).inputType;
        // Treat composition commits as typed input; autofill may omit `inputType` or
        // report `insertReplacementText`.
        const isTypedInput =
          event.type === 'compositionend' ||
          (inputType != null && inputType !== '' && inputType !== 'insertReplacementText');
        if (isTypedInput) {
          const hasQuery = next.trim() !== '';
          if (hasQuery) {
            setQueryChangedAfterOpen(true);
          }
          // Defer index updates until after the filtered items have been derived to ensure
          // `onItemHighlighted` receives the latest item.
          pendingQueryHighlightRef.current = { hasQuery };
          if (hasQuery && autoHighlightMode && store.state.activeIndex == null) {
            store.set('activeIndex', 0);
          }
        }
      }

      setInputValueUnwrapped(next);
    },
  );

  const setOpen = useStableCallback(
    (nextOpen: boolean, eventDetails: AriaCombobox.ChangeEventDetails) => {
      if (open === nextOpen) {
        return;
      }

      // If the `Empty` component is not used, the positioner or popup should be hidden
      // with CSS. In this case, allow the Escape key to bubble to close a parent popup
      // if there are no items to show.
      if (
        eventDetails.reason === 'escape-key' &&
        hasItems &&
        flatFilteredItems.length === 0 &&
        !store.state.emptyRef.current
      ) {
        eventDetails.allowPropagation();
      }

      props.onOpenChange?.(nextOpen, eventDetails);

      if (eventDetails.isCanceled) {
        return;
      }

      // If reopening interrupts the close animation, handleUnmount won't run to clear the
      // frozen closeQuery and pending popup input.
      if (nextOpen && multiple && inputInsidePopup && !inline && closeQuery !== null) {
        setQueryChangedAfterOpen(false);
        setCloseQuery(null);

        if (inputValue !== '') {
          setInputValue('', createChangeEventDetails(REASONS.inputClear, eventDetails.event));
        }
      }

      if (!nextOpen && queryChangedAfterOpen) {
        if (single) {
          if (!inline) {
            setCloseQuery(query);
          }
          // Avoid a flicker when closing the popup with an empty query.
          if (query === '') {
            setQueryChangedAfterOpen(false);
          }
        } else if (multiple) {
          if (!inline) {
            // Freeze the current query so filtering remains stable while exiting.
            setCloseQuery(query);
          }

          if (inputInsidePopup) {
            setIndices({ activeIndex: null });
          }

          // Clear the input immediately on close while retaining filtering via closeQuery for exit animations
          // if the input is outside the popup. When the input is inside the popup, defer the clear until
          // unmount so the filtered list doesn't flash to unfiltered during the exit animation.
          if (!inputInsidePopup || inline) {
            setInputValue('', createChangeEventDetails(REASONS.inputClear, eventDetails.event));
          }
        }
      }

      setOpenUnwrapped(nextOpen);

      if (
        !nextOpen &&
        inputInsidePopup &&
        (eventDetails.reason === REASONS.focusOut || eventDetails.reason === REASONS.outsidePress)
      ) {
        setTouched(true);
        setFocused(false);

        if (validationMode === 'onBlur') {
          const valueToValidate = selectionMode === 'none' ? inputValue : selectedValue;
          validation.commit(valueToValidate);
        }
      }
    },
  );

  const setSelectedValue = useStableCallback(
    (nextValue: Value | Value[] | null, eventDetails: AriaCombobox.ChangeEventDetails) => {
      // Cast to `any` due to conditional value type (single vs. multiple).
      // The runtime implementation already ensures the correct value shape.
      onSelectedValueChange?.(nextValue as any, eventDetails);

      if (eventDetails.isCanceled) {
        return;
      }

      setSelectedValueUnwrapped(nextValue);

      const shouldFillInput =
        (selectionMode === 'none' && popupRef.current && fillInputOnItemPress) ||
        (single && !store.state.inputInsidePopup);

      if (shouldFillInput) {
        setInputValue(
          stringifyAsLabel(nextValue, itemToStringLabel),
          createChangeEventDetails(eventDetails.reason, eventDetails.event),
        );
      }

      if (
        single &&
        nextValue != null &&
        eventDetails.reason !== REASONS.inputChange &&
        queryChangedAfterOpen &&
        !inline
      ) {
        setCloseQuery(query);
      }
    },
  );

  const handleSelection = useStableCallback(
    (event: MouseEvent | PointerEvent | KeyboardEvent, passedValue?: any) => {
      let itemValue = passedValue;
      if (itemValue === undefined) {
        if (activeIndex === null) {
          return;
        }
        itemValue = valuesRef.current[activeIndex];
      }

      const targetEl = getTarget(event) as HTMLElement | null;
      const overrideEvent = selectionEventRef.current ?? event;
      selectionEventRef.current = null;
      const eventDetails = createChangeEventDetails(REASONS.itemPress, overrideEvent);

      // Let the link handle the click.
      const href = targetEl?.closest('a')?.getAttribute('href');
      if (href) {
        if (href.startsWith('#')) {
          setOpen(false, eventDetails);
        }
        return;
      }

      if (multiple) {
        const currentSelectedValue = Array.isArray(selectedValue) ? selectedValue : [];
        const isCurrentlySelected = selectedValueIncludes(
          currentSelectedValue,
          itemValue,
          store.state.isItemEqualToValue,
        );
        const nextValue = isCurrentlySelected
          ? removeItem(currentSelectedValue, itemValue, store.state.isItemEqualToValue)
          : [...currentSelectedValue, itemValue];

        setSelectedValue(nextValue, eventDetails);

        if (eventDetails.isCanceled) {
          return;
        }

        const wasFiltering = inputRef.current ? inputRef.current.value.trim() !== '' : false;
        if (!wasFiltering) {
          return;
        }

        if (store.state.inputInsidePopup) {
          setInputValue('', createChangeEventDetails(REASONS.inputClear, eventDetails.event));
        } else {
          setOpen(false, eventDetails);
        }
      } else {
        setSelectedValue(itemValue, eventDetails);

        if (eventDetails.isCanceled) {
          return;
        }

        setOpen(false, eventDetails);
      }
    },
  );

  const requestSubmit = useStableCallback(() => {
    if (!store.state.submitOnItemClick) {
      return;
    }

    const formElement = validation.inputRef.current?.form ?? store.state.inputElement?.form;
    if (formElement && typeof formElement.requestSubmit === 'function') {
      formElement.requestSubmit();
    }
  });

  const handleUnmount = useStableCallback(() => {
    setMounted(false);
    onOpenChangeComplete?.(false);
    setQueryChangedAfterOpen(false);
    setCloseQuery(null);

    if (selectionMode === 'none') {
      setIndices({ activeIndex: null, selectedIndex: null });
    } else {
      setIndices({ activeIndex: null });
    }

    // Multiple selection mode:
    // If the user typed a filter and didn't select in multiple mode, clear the input
    // after close completes to avoid mid-exit flicker and start fresh on next open.
    if (
      multiple &&
      inputRef.current &&
      inputRef.current.value !== '' &&
      !hadInputClearRef.current
    ) {
      setInputValue('', createChangeEventDetails(REASONS.inputClear));
    }

    // Single selection mode:
    // - If input is rendered inside the popup, clear it so the next open is blank
    // - If input is outside the popup, sync it to the selected value
    if (single) {
      if (store.state.inputInsidePopup) {
        if (inputRef.current && inputRef.current.value !== '') {
          setInputValue('', createChangeEventDetails(REASONS.inputClear));
        }
      } else {
        const stringVal = stringifyAsLabel(selectedValue, itemToStringLabel);
        if (inputRef.current && inputRef.current.value !== stringVal) {
          // If no selection was made, treat this as clearing the typed filter.
          const reason = stringVal === '' ? REASONS.inputClear : REASONS.none;
          setInputValue(stringVal, createChangeEventDetails(reason));
        }
      }
    }
  });

  // Support composing the Dialog component around an inline combobox.
  // `[role="dialog"]` is more interoperable than using a context, e.g. it can work
  // with third-party modal libraries, though the limitation is that the closest
  // `role=dialog` part must be the animated element.
  const resolvedPopupRef: React.RefObject<HTMLElement | null> = React.useMemo(() => {
    if (inline && positionerElement) {
      return { current: positionerElement.closest('[role="dialog"]') };
    }
    return popupRef;
  }, [inline, positionerElement]);

  useOpenChangeComplete({
    enabled: !props.actionsRef,
    open,
    ref: resolvedPopupRef,
    onComplete() {
      if (!open) {
        handleUnmount();
      }
    },
  });

  React.useImperativeHandle(props.actionsRef, () => ({ unmount: handleUnmount }), [handleUnmount]);

  useIsoLayoutEffect(
    function syncSelectedIndex() {
      if (open || selectionMode === 'none') {
        return;
      }

      const registry = items ? flatItems : allValuesRef.current;

      if (multiple) {
        const currentValue = Array.isArray(selectedValue) ? selectedValue : [];
        const lastValue = currentValue[currentValue.length - 1];
        const lastIndex = findItemIndex(registry, lastValue, isItemEqualToValue);
        setIndices({ selectedIndex: lastIndex === -1 ? null : lastIndex });
      } else {
        const index = findItemIndex(registry, selectedValue, isItemEqualToValue);
        setIndices({ selectedIndex: index === -1 ? null : index });
      }
    },
    [
      open,
      selectedValue,
      items,
      selectionMode,
      flatItems,
      multiple,
      isItemEqualToValue,
      setIndices,
    ],
  );

  useIsoLayoutEffect(() => {
    if (items) {
      valuesRef.current = flatFilteredItems;
      listRef.current.length = flatFilteredItems.length;
    }
  }, [items, flatFilteredItems]);

  useIsoLayoutEffect(() => {
    const pendingHighlight = pendingQueryHighlightRef.current;
    if (pendingHighlight) {
      if (pendingHighlight.hasQuery) {
        if (autoHighlightMode) {
          store.set('activeIndex', 0);
        }
      } else if (autoHighlightMode === 'always') {
        store.set('activeIndex', 0);
      }
      pendingQueryHighlightRef.current = null;
    }

    if (!open && !inline) {
      return;
    }

    const shouldUseFlatFilteredItems = hasItems || hasFilteredItemsProp;
    const candidateItems = shouldUseFlatFilteredItems ? flatFilteredItems : valuesRef.current;
    const storeActiveIndex = store.state.activeIndex;

    if (storeActiveIndex == null) {
      if (autoHighlightMode === 'always' && candidateItems.length > 0) {
        store.set('activeIndex', 0);
        return;
      }
      if (lastHighlightRef.current !== INITIAL_LAST_HIGHLIGHT) {
        lastHighlightRef.current = INITIAL_LAST_HIGHLIGHT;
        store.state.onItemHighlighted(
          undefined,
          createGenericEventDetails(REASONS.none, undefined, { index: -1 }),
        );
      }
      return;
    }

    if (storeActiveIndex >= candidateItems.length) {
      if (lastHighlightRef.current !== INITIAL_LAST_HIGHLIGHT) {
        lastHighlightRef.current = INITIAL_LAST_HIGHLIGHT;
        store.state.onItemHighlighted(
          undefined,
          createGenericEventDetails(REASONS.none, undefined, { index: -1 }),
        );
      }
      store.set('activeIndex', null);
      return;
    }

    const itemValue = candidateItems[storeActiveIndex];
    const previouslyHighlightedItemValue = lastHighlightRef.current.value;
    const isSameItem =
      previouslyHighlightedItemValue !== NO_ACTIVE_VALUE &&
      compareItemEquality(
        itemValue,
        previouslyHighlightedItemValue,
        store.state.isItemEqualToValue,
      );

    if (lastHighlightRef.current.index !== storeActiveIndex || !isSameItem) {
      lastHighlightRef.current = { value: itemValue, index: storeActiveIndex };
      store.state.onItemHighlighted(
        itemValue,
        createGenericEventDetails(REASONS.none, undefined, { index: storeActiveIndex }),
      );
    }
  }, [
    activeIndex,
    autoHighlightMode,
    hasFilteredItemsProp,
    hasItems,
    flatFilteredItems,
    inline,
    open,
    store,
  ]);

  useIsoLayoutEffect(() => {
    if (selectionMode === 'none') {
      setFilled(String(inputValue) !== '');
      return;
    }
    setFilled(
      multiple ? Array.isArray(selectedValue) && selectedValue.length > 0 : selectedValue != null,
    );
  }, [setFilled, selectionMode, inputValue, selectedValue, multiple]);

  // Ensures that the active index is not set to 0 when the list is empty.
  // This avoids needing to press ArrowDown twice under certain conditions.
  React.useEffect(() => {
    if (hasItems && autoHighlightMode && flatFilteredItems.length === 0) {
      setIndices({ activeIndex: null });
    }
  }, [hasItems, autoHighlightMode, flatFilteredItems.length, setIndices]);

  function isSelectedValueDirty(value: Value | Value[] | null) {
    const initialValue = validityData.initialValue;

    if (Array.isArray(value) && Array.isArray(initialValue)) {
      return !areArraysEqual(value, initialValue, (itemValue, initialItemValue) =>
        compareItemEquality(itemValue, initialItemValue, isItemEqualToValue),
      );
    }

    return value !== initialValue;
  }

  useValueChanged(query, () => {
    if (!open || query === '' || query === String(initialDefaultInputValue)) {
      return;
    }
    setQueryChangedAfterOpen(true);
  });

  useValueChanged(selectedValue, () => {
    if (selectionMode === 'none') {
      return;
    }

    clearErrors(name);
    setDirty(isSelectedValueDirty(selectedValue));

    validation.change(selectedValue);

    if (single && !hasInputValue && !inputInsidePopup) {
      const nextInputValue = stringifyAsLabel(selectedValue, itemToStringLabel);

      if (inputValue !== nextInputValue) {
        setInputValue(nextInputValue, createChangeEventDetails(REASONS.none));
      }
    }
  });

  useValueChanged(inputValue, () => {
    if (selectionMode !== 'none') {
      return;
    }

    clearErrors(name);
    setDirty(inputValue !== validityData.initialValue);

    validation.change(inputValue);
  });

  useValueChanged(items, () => {
    if (!single || hasInputValue || inputInsidePopup || queryChangedAfterOpen) {
      return;
    }

    const nextInputValue = stringifyAsLabel(selectedValue, itemToStringLabel);

    if (inputValue !== nextInputValue) {
      setInputValue(nextInputValue, createChangeEventDetails(REASONS.none));
    }
  });

  const floatingRootContext = useFloatingRootContext({
    open: inline ? true : open,
    onOpenChange: setOpen,
    elements: {
      reference: inputInsidePopup ? triggerElement : inputElement,
      floating: positionerElement,
    },
  });

  let ariaHasPopup: 'grid' | 'listbox' | undefined;
  let ariaExpanded: 'true' | 'false' | undefined;
  if (!inline) {
    ariaHasPopup = grid ? 'grid' : 'listbox';
    ariaExpanded = open ? 'true' : 'false';
  }

  const role: ElementProps = React.useMemo(() => {
    const isPlainInput = inputElement?.tagName === 'INPUT';
    // During SSR and initial hydration, the input ref is not available yet.
    // Assume an input-like control so combobox ARIA attributes are present.
    const shouldTreatAsInput = inputElement == null || isPlainInput;
    const shouldApplyAria = shouldTreatAsInput || open;

    const reference = shouldTreatAsInput
      ? ({
          autoComplete: 'off',
          spellCheck: 'false',
          autoCorrect: 'off',
          autoCapitalize: 'none',
        } as HTMLProps<HTMLInputElement>)
      : {};

    if (shouldApplyAria) {
      reference.role = 'combobox';
      reference['aria-expanded'] = ariaExpanded;
      reference['aria-haspopup'] = ariaHasPopup;
      reference['aria-controls'] = open ? listElement?.id : undefined;
      reference['aria-autocomplete'] = autoComplete;
    }

    return {
      reference,
      floating: { role: 'presentation' },
    };
  }, [inputElement, open, ariaExpanded, ariaHasPopup, listElement?.id, autoComplete]);

  const click = useClick(floatingRootContext, {
    enabled: !readOnly && !disabled && openOnInputClick,
    event: 'mousedown-only',
    toggle: false,
    // Apply a small delay for touch to let mobile viewport/keyboard positioning settle.
    // This avoids top-bottom flip flickers if the preferred position is "top" when first tapping.
    touchOpenDelay: inputInsidePopup ? 0 : 100,
    reason: REASONS.inputPress,
  });

  const dismiss = useDismiss(floatingRootContext, {
    enabled: !readOnly && !disabled && !inline,
    outsidePressEvent: {
      mouse: 'sloppy',
      // The visual viewport (affected by the mobile software keyboard) can be
      // somewhat small. The user may want to scroll the screen to see more of
      // the popup.
      touch: 'intentional',
    },
    // Without a popup, let the Escape key bubble the event up to other popups' handlers.
    bubbles: inline ? true : undefined,
    outsidePress(event) {
      const target = getTarget(event) as Element | null;
      return (
        !contains(triggerElement, target) &&
        !contains(clearRef.current, target) &&
        !contains(chipsContainerRef.current, target) &&
        !contains(inputGroupElement, target)
      );
    },
  });

  const listNavigation = useListNavigation(floatingRootContext, {
    enabled: !readOnly && !disabled,
    id,
    listRef,
    activeIndex,
    selectedIndex,
    virtual: true,
    loopFocus,
    allowEscape: loopFocus && !autoHighlightMode,
    focusItemOnOpen:
      queryChangedAfterOpen || (selectionMode === 'none' && !autoHighlightMode) ? false : 'auto',
    focusItemOnHover: highlightItemOnHover,
    resetOnPointerLeave: !keepHighlight,
    orientation: grid ? 'horizontal' : undefined,
    rtl: direction === 'rtl',
    disabledIndices: EMPTY_ARRAY as number[],
    grid: grid ? gridNavigation : undefined,
    onNavigate(nextActiveIndex, event) {
      // Retain the highlight only while actually transitioning out or closed.
      if ((!event && !open) || transitionStatus === 'ending') {
        return;
      }

      if (!event) {
        setIndices({
          activeIndex: nextActiveIndex,
        });
      } else {
        setIndices({
          activeIndex: nextActiveIndex,
          type: keyboardActiveRef.current ? 'keyboard' : 'pointer',
        });
      }
    },
  });

  const inputProps = React.useMemo(
    () =>
      mergeProps(
        listNavigation.reference,
        {
          onKeyDown(event: BaseUIEvent<React.KeyboardEvent>) {
            // In grid mode the navigation hook treats ArrowLeft/ArrowRight as horizontal
            // grid movement. When the input has focus and no item is highlighted the user
            // is still editing the query, so let the input keep its native caret behavior.
            if (
              grid &&
              store.state.activeIndex == null &&
              (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
            ) {
              event.preventBaseUIHandler();
            }
          },
        },
        dismiss.reference,
        click.reference,
        role.reference,
      ),
    [listNavigation.reference, dismiss.reference, click.reference, role.reference, grid, store],
  );

  const popupProps = React.useMemo(
    () =>
      mergeProps(FOCUSABLE_POPUP_PROPS, listNavigation.floating, dismiss.floating, role.floating),
    [listNavigation.floating, dismiss.floating, role.floating],
  );

  const itemProps = React.useMemo<HTMLProps>(() => {
    const listNavigationItemProps = listNavigation.item as HTMLProps | undefined;
    if (!listNavigationItemProps) {
      return EMPTY_OBJECT;
    }

    // Combobox keeps focus on the input; item focus would incorrectly sync
    // list navigation state from DOM focus.
    return { ...listNavigationItemProps, onFocus: undefined };
  }, [listNavigation.item]);

  useOnFirstRender(() => {
    store.update({
      inline: inlineProp,
      popupProps,
      inputProps,
      triggerProps,
      itemProps,
      setOpen,
      setInputValue,
      setSelectedValue,
      setIndices,
      onItemHighlighted,
      handleSelection,
      forceMount,
      requestSubmit,
    });
  });

  useIsoLayoutEffect(() => {
    store.update({
      id,
      selectedValue,
      open,
      mounted,
      transitionStatus,
      items,
      inline: inlineProp,
      popupProps,
      inputProps,
      triggerProps,
      openMethod,
      itemProps,
      selectionMode,
      name,
      form,
      disabled,
      readOnly,
      required,
      grid,
      isGrouped,
      virtualized,
      onOpenChangeComplete,
      openOnInputClick,
      itemToStringLabel,
      modal,
      autoHighlight: autoHighlightMode,
      isItemEqualToValue,
      submitOnItemClick,
      hasInputValue,
      requestSubmit,
      inputOwnsFormValue: selectionMode === 'none' && (inlineProp || !store.state.inputInsidePopup),
    });
  }, [
    store,
    id,
    selectedValue,
    open,
    mounted,
    transitionStatus,
    items,
    popupProps,
    inputProps,
    itemProps,
    openMethod,
    triggerProps,
    selectionMode,
    name,
    disabled,
    readOnly,
    required,
    validation,
    grid,
    isGrouped,
    virtualized,
    onOpenChangeComplete,
    openOnInputClick,
    itemToStringLabel,
    modal,
    isItemEqualToValue,
    submitOnItemClick,
    hasInputValue,
    inlineProp,
    requestSubmit,
    autoHighlightMode,
    form,
  ]);

  const hiddenInputRef = useMergedRefs(inputRefProp, validation.inputRef);

  const itemsContextValue: ComboboxDerivedItemsContext = React.useMemo(
    () => ({
      query,
      hasItems,
      filteredItems,
      flatFilteredItems,
    }),
    [query, hasItems, filteredItems, flatFilteredItems],
  );

  const serializedValue = React.useMemo(() => {
    if (Array.isArray(fieldRawValue)) {
      return '';
    }
    return stringifyAsValue(fieldRawValue, itemToStringValue);
  }, [fieldRawValue, itemToStringValue]);

  const hasMultipleSelection = multiple && Array.isArray(selectedValue) && selectedValue.length > 0;
  const hiddenInputName =
    multiple || (selectionMode === 'none' && inputOwnsFormValue) ? undefined : name;

  const hiddenInputs = React.useMemo(() => {
    if (!multiple || !Array.isArray(selectedValue) || !name) {
      return null;
    }

    return selectedValue.map((value: Value) => {
      const currentSerializedValue = stringifyAsValue(value, itemToStringValue);
      return (
        <input
          key={currentSerializedValue}
          type="hidden"
          form={form}
          name={name}
          value={currentSerializedValue}
          disabled={disabled}
        />
      );
    });
  }, [multiple, selectedValue, form, name, itemToStringValue, disabled]);

  const children = (
    <React.Fragment>
      {props.children}
      <input
        {...validation.getValidationProps(disabled, {
          // Move focus when the hidden input is focused.
          onFocus() {
            if (inputInsidePopup) {
              triggerElement?.focus();
              return;
            }

            (inputRef.current || triggerElement)?.focus();
          },
          // Handle browser autofill.
          onChange(event: React.ChangeEvent<HTMLInputElement>) {
            // Workaround for https://github.com/facebook/react/issues/9023
            if (event.nativeEvent.defaultPrevented || disabled || readOnly) {
              return;
            }

            const nextValue = event.currentTarget.value;
            const nextValueLower = nextValue.toLowerCase();
            const details = createChangeEventDetails(REASONS.none, event.nativeEvent);

            const findSerializedMatchIndex = () =>
              valuesRef.current.findIndex(
                (candidate) =>
                  stringifyAsValue(candidate, itemToStringValue).toLowerCase() === nextValueLower ||
                  stringifyAsLabel(candidate, itemToStringLabel).toLowerCase() === nextValueLower,
              );

            function handleChange() {
              // Browser autofill only writes a single scalar value.
              if (multiple) {
                return;
              }

              if (selectionMode === 'none') {
                setInputValue(nextValue, details);
                return;
              }

              // Preserve the original serialized matching, then fall back to rendered text,
              // which browsers can autofill for primitive values like `value="US">United States`.
              let matchingIndex = findSerializedMatchIndex();

              if (matchingIndex === -1) {
                matchingIndex = valuesRef.current.findIndex((_, index) => {
                  const renderedLabel = labelsRef.current[index];
                  return renderedLabel != null && renderedLabel.toLowerCase() === nextValueLower;
                });
              }

              const matchingValue =
                matchingIndex === -1 ? undefined : valuesRef.current[matchingIndex];
              if (matchingValue != null) {
                // `setSelectedValue` may be canceled by `onValueChange`; rely on
                // `useValueChanged` to mark the field dirty and run validation only
                // when the value actually changes.
                setSelectedValue?.(matchingValue, details);
              }
            }

            // Only single-selection autofill matches against the registered values/labels.
            // `multiple` ignores autofill and `none` just writes the input value, so avoid the
            // sticky `forceMounted` mount (which never resets) for those modes.
            if (single) {
              forceMount();
              if (items && findSerializedMatchIndex() === -1) {
                // `forceMount` only refreshes the derived labels for the `items` prop. When
                // serialized matching misses, also mount the list so rendered labels (which can
                // differ from the serialized values) are registered for autofill matching.
                store.set('forceMounted', true);
              }
            }
            queueMicrotask(handleChange);
          },
        })}
        id={id && hiddenInputName == null ? `${id}-hidden-input` : undefined}
        form={form}
        name={hiddenInputName}
        autoComplete={formAutoComplete}
        disabled={disabled}
        required={required && !hasMultipleSelection}
        readOnly={readOnly}
        value={serializedValue}
        ref={hiddenInputRef}
        style={hiddenInputName ? visuallyHiddenInput : visuallyHidden}
        tabIndex={-1}
        aria-hidden
        suppressHydrationWarning
      />
      {hiddenInputs}
    </React.Fragment>
  );

  return (
    <ComboboxRootContext.Provider value={store}>
      <ComboboxFloatingContext.Provider value={floatingRootContext}>
        <ComboboxHasItemsContext.Provider value={hasItems}>
          <ComboboxDerivedItemsContext.Provider value={itemsContextValue}>
            <ComboboxInputValueContext.Provider value={inputValue}>
              {children}
            </ComboboxInputValueContext.Provider>
          </ComboboxDerivedItemsContext.Provider>
        </ComboboxHasItemsContext.Provider>
      </ComboboxFloatingContext.Provider>
    </ComboboxRootContext.Provider>
  );
}

type SelectionMode = 'single' | 'multiple' | 'none';

type ComboboxItemValueType<ItemValue, Mode extends SelectionMode> = Mode extends 'multiple'
  ? ItemValue[]
  : ItemValue;

interface ComboboxRootProps<ItemValue> {
  children?: React.ReactNode;
  /**
   * Identifies the field when a form is submitted.
   */
  name?: string | undefined;
  /**
   * Identifies the form that owns the internal input.
   * Useful when the combobox is rendered outside the form.
   */
  form?: string | undefined;
  /**
   * The id of the component.
   */
  id?: string | undefined;
  /**
   * Whether the user must choose a value before submitting a form.
   * @default false
   */
  required?: boolean | undefined;
  /**
   * Whether the user should be unable to choose a different option from the popup.
   * @default false
   */
  readOnly?: boolean | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Whether the popup is initially open.
   *
   * To render a controlled popup, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Whether the popup is currently open. Use when controlled.
   */
  open?: boolean | undefined;
  /**
   * Event handler called when the popup is opened or closed.
   */
  onOpenChange?:
    | ((open: boolean, eventDetails: AriaCombobox.ChangeEventDetails) => void)
    | undefined;
  /**
   * Event handler called after any animations complete when the popup is opened or closed.
   */
  onOpenChangeComplete?: ((open: boolean) => void) | undefined;
  /**
   * Whether the popup opens when clicking the input.
   * @default true
   */
  openOnInputClick?: boolean | undefined;
  /**
   * Whether the first matching item is highlighted automatically.
   * - `false`: do not highlight automatically.
   * - `true`: highlight after the user types and keep the highlight while the query changes.
   * - `'always'`: highlight the first item as soon as the list opens.
   * @default false
   */
  autoHighlight?: boolean | 'always' | undefined;
  /**
   * Whether the highlighted item should be preserved when the pointer leaves the list.
   * @default false
   */
  keepHighlight?: boolean | undefined;
  /**
   * Whether moving the pointer over items should highlight them.
   * Disabling this prop allows CSS `:hover` to be differentiated from the `:focus` (`data-highlighted`) state.
   * @default true
   */
  highlightItemOnHover?: boolean | undefined;
  /**
   * Whether to loop keyboard focus back to the input when the end of the list is reached while using the arrow keys. The first item can then be reached by pressing <kbd>ArrowDown</kbd> again from the input, or the last item can be reached by pressing <kbd>ArrowUp</kbd> from the input.
   * The input is always included in the focus loop per [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/).
   * When disabled, focus does not move when on the last element and the user presses <kbd>ArrowDown</kbd>, or when on the first element and the user presses <kbd>ArrowUp</kbd>.
   * @default true
   */
  loopFocus?: boolean | undefined;
  /**
   * The input value of the combobox. Use when controlled.
   */
  inputValue?: React.ComponentProps<'input'>['value'] | undefined;
  /**
   * Callback fired when the input value of the combobox changes.
   */
  onInputValueChange?:
    | ((value: string, eventDetails: AriaCombobox.ChangeEventDetails) => void)
    | undefined;
  /**
   * The uncontrolled input value when initially rendered.
   *
   * To render a controlled input, use the `inputValue` prop instead.
   */
  defaultInputValue?: React.ComponentProps<'input'>['defaultValue'] | undefined;
  /**
   * A ref to imperative actions.
   * - `unmount`: Manually unmounts the combobox.
   * Call this after any externally controlled closing animation finishes.
   */
  actionsRef?: React.RefObject<AriaCombobox.Actions | null> | undefined;
  /**
   * Callback fired when an item is highlighted or unhighlighted.
   * Receives the highlighted item value (or `undefined` if no item is highlighted) and event details with a `reason` property describing why the highlight changed.
   * The `reason` can be:
   * - `'keyboard'`: the highlight changed due to keyboard navigation.
   * - `'pointer'`: the highlight changed due to pointer hovering.
   * - `'none'`: the highlight changed programmatically.
   */
  onItemHighlighted?:
    | ((itemValue: ItemValue | undefined, eventDetails: AriaCombobox.HighlightEventDetails) => void)
    | undefined;
  /**
   * A ref to the hidden input element.
   */
  inputRef?: React.Ref<HTMLInputElement> | undefined;
  /**
   * Whether list items are presented in a grid layout.
   * When enabled, arrow keys navigate across rows and columns inferred from DOM rows.
   * @default false
   */
  grid?: boolean | undefined;
  /**
   * The items to be displayed in the list.
   * Can be either a flat array of items or an array of groups with items.
   */
  items?: readonly any[] | readonly Group<any>[] | undefined;
  /**
   * Filtered items to display in the list.
   * When provided, the list will use these items instead of filtering the `items` prop internally.
   * Use when you want to control filtering logic externally with the `useFilter()` hook.
   */
  filteredItems?: readonly any[] | readonly Group<any>[] | undefined;
  /**
   * Filter function used to match items vs input query.
   */
  filter?:
    | null
    | ((
        itemValue: ItemValue,
        query: string,
        itemToString?: (itemValue: ItemValue) => string,
      ) => boolean)
    | undefined;
  /**
   * When the item values are objects (`<Combobox.Item value={object}>`), this function converts the object value to a string representation for display in the input.
   * If the shape of the object is `{ value, label }`, the label will be used automatically without needing to specify this prop.
   */
  itemToStringLabel?: ((itemValue: ItemValue) => string) | undefined;
  /**
   * When the item values are objects (`<Combobox.Item value={object}>`), this function converts the object value to a string representation for form submission.
   * If the shape of the object is `{ value, label }`, the value will be used automatically without needing to specify this prop.
   */
  itemToStringValue?: ((itemValue: ItemValue) => string) | undefined;
  /**
   * Custom comparison logic used to determine if a combobox item value matches the current selected value. Useful when item values are objects without matching referentially.
   * Defaults to `Object.is` comparison.
   */
  isItemEqualToValue?: ((itemValue: ItemValue, value: ItemValue) => boolean) | undefined;
  /**
   * Whether the items are being externally virtualized.
   * @default false
   */
  virtualized?: boolean | undefined;
  /**
   * Whether the list is rendered inline without using the component's own popup.
   *
   * Specify `open` unconditionally in conjunction with this prop so the list is considered
   * visible: `<Combobox.Root inline open>`
   *
   * In a `Combobox.Root` > `Dialog.Root` composition, bind the Combobox's `open` and
   * `onOpenChange` props to the `Dialog`'s `open` and `onOpenChange` state instead so the
   * component resets its transient state (filter query, highlighted item, and input value) when
   * the dialog closes.
   * @default false
   */
  inline?: boolean | undefined;
  /**
   * Determines if the popup enters a modal state when open.
   * - `true`: user interaction is limited to the popup: document page scroll is locked and pointer interactions on outside elements are disabled.
   * - `false`: user interaction with the rest of the document is allowed.
   * @default false
   */
  modal?: boolean | undefined;
  /**
   * The maximum number of items to display in the list.
   * @default -1
   */
  limit?: number | undefined;
  /**
   * Controls how the component behaves with respect to list filtering and inline autocompletion.
   * - `list` (default): items are dynamically filtered based on the input value. The input value does not change based on the active item.
   * - `both`: items are dynamically filtered based on the input value, which will temporarily change based on the active item (inline autocompletion).
   * - `inline`: items are static (not filtered), and the input value will temporarily change based on the active item (inline autocompletion).
   * - `none`: items are static (not filtered), and the input value will not change based on the active item.
   * @default 'list'
   */
  autoComplete?: 'list' | 'both' | 'inline' | 'none' | undefined;
  /**
   * Provides a hint to the browser for autofill on the hidden input element.
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/autocomplete
   */
  formAutoComplete?: string | undefined;
  /**
   * The locale to use for string comparison.
   * Defaults to the user's runtime locale.
   */
  locale?: Intl.LocalesArgument | undefined;
  /**
   * Whether clicking an item should submit the owning form.
   * @default false
   */
  submitOnItemClick?: boolean | undefined;
  /**
   * INTERNAL: When `selectionMode` is `none`, controls whether selecting an item fills the input.
   */
  fillInputOnItemPress?: boolean | undefined;
}

export interface AriaComboboxState {}

export type AriaComboboxProps<
  Value,
  Mode extends SelectionMode = 'none',
> = ComboboxRootProps<Value> & {
  /**
   * How the combobox should remember the selected value.
   * - `single`: Remembers the last selected value.
   * - `multiple`: Remember all selected values.
   * - `none`: Do not remember the selected value.
   * @default 'none'
   */
  selectionMode?: Mode | undefined;
  /**
   * The selected value of the combobox. Use when controlled.
   */
  selectedValue?: ComboboxItemValueType<Value, Mode> | undefined;
  /**
   * The uncontrolled selected value of the combobox when it's initially rendered.
   *
   * To render a controlled combobox, use the `selectedValue` prop instead.
   */
  defaultSelectedValue?: ComboboxItemValueType<Value, Mode> | null | undefined;
  /**
   * Callback fired when the selected value of the combobox changes.
   */
  onSelectedValueChange?:
    | ((
        value: ComboboxItemValueType<Value, Mode>,
        eventDetails: AriaCombobox.ChangeEventDetails,
      ) => void)
    | undefined;
};

export namespace AriaCombobox {
  export type Props<Value, Mode extends SelectionMode = 'none'> = AriaComboboxProps<Value, Mode>;
  export type State = AriaComboboxState;

  export interface Actions {
    unmount: () => void;
  }

  export type HighlightEventReason = 'keyboard' | 'pointer' | 'none';
  export type HighlightEventDetails = BaseUIGenericEventDetails<
    HighlightEventReason,
    { index: number }
  >;

  export type ChangeEventReason =
    | typeof REASONS.triggerPress
    | typeof REASONS.outsidePress
    | typeof REASONS.itemPress
    | typeof REASONS.closePress
    | typeof REASONS.escapeKey
    | typeof REASONS.listNavigation
    | typeof REASONS.focusOut
    | typeof REASONS.inputChange
    | typeof REASONS.inputClear
    | typeof REASONS.clearPress
    | typeof REASONS.chipRemovePress
    | typeof REASONS.none;
  export type ChangeEventDetails = BaseUIChangeEventDetails<ChangeEventReason>;
}
