import * as React from 'react';
import { Autocomplete } from '@base-ui/react/autocomplete';

export type AutocompleteProps<Value = string> = Autocomplete.Root.Props<Value>;
export type AutocompleteActions = Autocomplete.Root.Actions;
export type AutocompleteChangeEventDetails = Autocomplete.Root.ChangeEventDetails;
export type AutocompleteChangeEventReason = Autocomplete.Root.ChangeEventReason;
export type AutocompleteHighlightEventDetails = Autocomplete.Root.HighlightEventDetails;
export type AutocompleteHighlightEventReason = Autocomplete.Root.HighlightEventReason;

export const { useFilter } = Autocomplete;

export interface SimpleAutocompleteProps extends Omit<Autocomplete.Root.Props<string>, 'children'> {
  items: readonly string[];
}

function useAutocompleteFilter(
  options?: Parameters<typeof Autocomplete.useFilter>[0],
): ReturnType<typeof Autocomplete.useFilter> {
  const filter = Autocomplete.useFilter(options);

  React.useEffect(() => {
    filter.contains('value', 'val');
    filter.startsWith('value', 'v');
    filter.endsWith('value', 'ue');
  }, [filter]);

  return filter;
}

export const AutocompleteHarness = React.forwardRef<HTMLInputElement, SimpleAutocompleteProps>(
  function AutocompleteHarness({ items, ...props }, ref) {
    const actionsRef = React.useRef<AutocompleteActions>({ unmount() {} });
    const filter = useAutocompleteFilter();

    React.useMemo(() => filter.contains(items[0] ?? '', ''), [filter, items]);

    const handleValueChange = React.useCallback(
      (value: string, details: AutocompleteChangeEventDetails) => {
        const reason: AutocompleteChangeEventReason = details.reason;
        if (reason === 'item-press') {
          details.cancel();
        }
        return value;
      },
      [],
    );

    const handleItemHighlighted = React.useCallback(
      (_value: string | undefined, details: AutocompleteHighlightEventDetails) => {
        const reason = details.reason;
        if (reason === 'keyboard') {
          void 0;
        }
      },
      [],
    );

    return (
      <Autocomplete.Root
        {...props}
        actionsRef={actionsRef}
        onValueChange={handleValueChange}
        onItemHighlighted={handleItemHighlighted}
      >
        <Autocomplete.Input ref={ref} />
        <Autocomplete.Trigger />
        <Autocomplete.Positioner>
          <Autocomplete.Popup>
            {items.map((item) => (
              <Autocomplete.Item key={item} value={item}>
                {item}
              </Autocomplete.Item>
            ))}
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Root>
    );
  },
);
