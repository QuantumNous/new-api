'use client';
import * as React from 'react';
import { AriaCombobox, type AriaComboboxState } from '../../combobox/root/AriaCombobox';
import { useCoreFilter } from '../../combobox/root/utils/useFilter';
import { stringifyAsLabel } from '../../internals/resolveValueLabel';
import { REASONS } from '../../internals/reasons';

/**
 * Groups all parts of the autocomplete.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Base UI Autocomplete](https://base-ui.com/react/components/autocomplete)
 */
export function AutocompleteRoot<Items extends readonly { items: readonly any[] }[]>(
  props: Omit<AutocompleteRoot.Props<Items[number]['items'][number]>, 'items'> & {
    /**
     * The items to be displayed in the list.
     * Can be either a flat array of items or an array of groups with items.
     */
    items: Items;
  },
): React.JSX.Element;
export function AutocompleteRoot<ItemValue>(
  props: Omit<AutocompleteRoot.Props<ItemValue>, 'items'> & {
    /**
     * The items to be displayed in the list.
     * Can be either a flat array of items or an array of groups with items.
     */
    items?: readonly ItemValue[] | undefined;
  },
): React.JSX.Element;
export function AutocompleteRoot<ItemValue>(
  props: AutocompleteRoot.Props<ItemValue>,
): React.JSX.Element {
  const {
    openOnInputClick = false,
    value,
    defaultValue,
    onValueChange,
    mode = 'list',
    itemToStringValue,
    ...other
  } = props;

  const enableInline = mode === 'inline' || mode === 'both';
  const staticItems = mode === 'inline' || mode === 'none';

  // Mirror the typed value for uncontrolled usage so we can compose the temporary
  // inline input value.
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? '');
  const [inlineInputValue, setInlineInputValue] = React.useState('');

  React.useEffect(() => {
    if (isControlled) {
      setInlineInputValue('');
    }
  }, [value, isControlled]);

  // Compose the input value shown to the user: inline value takes precedence when present.
  let resolvedInputValue: typeof value;
  if (enableInline && inlineInputValue !== '') {
    resolvedInputValue = inlineInputValue;
  } else if (isControlled) {
    resolvedInputValue = value ?? '';
  } else {
    resolvedInputValue = internalValue;
  }

  const collator = useCoreFilter();

  const baseFilter = React.useMemo<Exclude<typeof other.filter, undefined>>(() => {
    if (other.filter !== undefined) {
      return other.filter;
    }
    return collator.contains;
  }, [other.filter, collator]);

  const resolvedQuery = String(isControlled ? value : internalValue).trim();

  // In "both", wrap filtering to use only the typed value, ignoring the inline value.
  const resolvedFilter: typeof other.filter = React.useMemo(() => {
    if (mode !== 'both') {
      return staticItems ? null : baseFilter;
    }
    if (baseFilter === null) {
      return null;
    }
    return (item, _query, toString) => {
      return baseFilter(item, resolvedQuery, toString);
    };
  }, [baseFilter, mode, resolvedQuery, staticItems]);

  function handleValueChange(nextValue: string, eventDetails: AutocompleteRoot.ChangeEventDetails) {
    setInlineInputValue('');
    if (!isControlled) {
      setInternalValue(nextValue);
    }
    onValueChange?.(nextValue, eventDetails);
  }

  function handleItemHighlighted(
    highlightedValue: any,
    eventDetails: AriaCombobox.HighlightEventDetails,
  ) {
    props.onItemHighlighted?.(highlightedValue, eventDetails);

    if (eventDetails.reason === REASONS.pointer) {
      return;
    }

    if (enableInline) {
      if (highlightedValue == null) {
        setInlineInputValue('');
      } else {
        setInlineInputValue(stringifyAsLabel(highlightedValue, itemToStringValue));
      }
    } else {
      setInlineInputValue('');
    }
  }

  return (
    <AriaCombobox
      {...other}
      itemToStringLabel={itemToStringValue}
      openOnInputClick={openOnInputClick}
      selectionMode="none"
      fillInputOnItemPress
      filter={resolvedFilter}
      autoComplete={mode}
      inputValue={resolvedInputValue}
      defaultInputValue={defaultValue}
      onInputValueChange={handleValueChange}
      onItemHighlighted={handleItemHighlighted}
    />
  );
}

export interface AutocompleteRootState extends AriaComboboxState {}

export interface AutocompleteRootActions {
  unmount: () => void;
}

export type AutocompleteRootChangeEventReason = AriaCombobox.ChangeEventReason;
export type AutocompleteRootChangeEventDetails = AriaCombobox.ChangeEventDetails;

export type AutocompleteRootHighlightEventReason = AriaCombobox.HighlightEventReason;
export type AutocompleteRootHighlightEventDetails = AriaCombobox.HighlightEventDetails;

export interface AutocompleteRootProps<ItemValue> extends Omit<
  AriaCombobox.Props<ItemValue, 'none'>,
  | 'selectionMode'
  | 'selectedValue'
  | 'defaultSelectedValue'
  | 'onSelectedValueChange'
  | 'fillInputOnItemPress'
  | 'itemToStringValue'
  | 'isItemEqualToValue'
  // Different names
  | 'inputValue' // value
  | 'defaultInputValue' // defaultValue
  | 'onInputValueChange' // onValueChange
  | 'autoComplete' // mode
  | 'formAutoComplete'
  | 'itemToStringLabel' // itemToStringValue
  // Custom JSDoc
  | 'inline'
  | 'autoHighlight'
  | 'keepHighlight'
  | 'highlightItemOnHover'
  | 'actionsRef'
  | 'onOpenChange'
  | 'openOnInputClick'
> {
  /**
   * Controls how the autocomplete behaves with respect to list filtering and inline autocompletion.
   * - `list` (default): items are dynamically filtered based on the input value. The input value does not change based on the active item.
   * - `both`: items are dynamically filtered based on the input value, which will temporarily change based on the active item (inline autocompletion).
   * - `inline`: items are static (not filtered), and the input value will temporarily change based on the active item (inline autocompletion).
   * - `none`: items are static (not filtered), and the input value will not change based on the active item.
   * @default 'list'
   */
  mode?: 'list' | 'both' | 'inline' | 'none' | undefined;
  /**
   * Whether the list is rendered inline without using the component's own popup.
   *
   * Specify `open` unconditionally in conjunction with this prop so the list is considered
   * visible: `<Autocomplete.Root inline open>`
   * @default false
   */
  inline?: boolean | undefined;
  /**
   * Whether the first matching item is highlighted automatically.
   * - `true`: highlight after the user types and keep the highlight while the query changes.
   * - `'always'`: always highlight the first item.
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
   * The uncontrolled input value of the autocomplete when it's initially rendered.
   *
   * To render a controlled autocomplete, use the `value` prop instead.
   */
  defaultValue?:
    | AriaCombobox.Props<React.ComponentProps<'input'>['defaultValue'], 'none'>['defaultInputValue']
    | undefined;
  /**
   * The input value of the autocomplete. Use when controlled.
   */
  value?:
    | AriaCombobox.Props<React.ComponentProps<'input'>['value'], 'none'>['inputValue']
    | undefined;
  /**
   * Event handler called when the input value of the autocomplete changes.
   */
  onValueChange?:
    | ((value: string, eventDetails: AutocompleteRootChangeEventDetails) => void)
    | undefined;
  /**
   * Whether clicking an item should submit the autocomplete's owning form.
   * By default, clicking an item via a pointer or <kbd>Enter</kbd> key does not submit the owning form.
   * Useful when the autocomplete is used as a single-field form search input.
   * @default false
   */
  submitOnItemClick?: AriaCombobox.Props<ItemValue, 'none'>['submitOnItemClick'] | undefined;
  /**
   * When the item values are objects (`<Autocomplete.Item value={object}>`), this function converts the object value to a string representation for both display in the input and form submission.
   * If the shape of the object is `{ value, label }`, the label will be used automatically without needing to specify this prop.
   */
  itemToStringValue?: ((itemValue: ItemValue) => string) | undefined;
  /**
   * A ref to imperative actions.
   * - `unmount`: Manually unmounts the autocomplete.
   * Call this after any externally controlled closing animation finishes.
   */
  actionsRef?: React.RefObject<AutocompleteRootActions | null> | undefined;
  /**
   * Event handler called when the popup is opened or closed.
   */
  onOpenChange?:
    | ((open: boolean, eventDetails: AutocompleteRootChangeEventDetails) => void)
    | undefined;
  /**
   * Callback fired when an item is highlighted or unhighlighted.
   * Receives the highlighted item value (or `undefined` if no item is highlighted) and event details with a `reason` property describing why the highlight changed.
   * The `reason` can be:
   * - `'keyboard'`: the highlight changed due to keyboard navigation.
   * - `'pointer'`: the highlight changed due to pointer hovering.
   * - `'none'`: the highlight changed programmatically.
   */
  onItemHighlighted?:
    | ((
        highlightedValue: ItemValue | undefined,
        eventDetails: AutocompleteRootHighlightEventDetails,
      ) => void)
    | undefined;
  /**
   * Whether the popup opens when clicking the input.
   * @default false
   */
  openOnInputClick?: boolean | undefined;
}

export namespace AutocompleteRoot {
  export type Props<ItemValue> = AutocompleteRootProps<ItemValue>;
  export type State = AutocompleteRootState;
  export type Actions = AutocompleteRootActions;
  export type ChangeEventReason = AutocompleteRootChangeEventReason;
  export type ChangeEventDetails = AutocompleteRootChangeEventDetails;
  export type HighlightEventReason = AutocompleteRootHighlightEventReason;
  export type HighlightEventDetails = AutocompleteRootHighlightEventDetails;
}
