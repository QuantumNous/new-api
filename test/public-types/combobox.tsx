import * as React from 'react';
import { Combobox } from '@base-ui/react/combobox';

export type ComboboxProps<
  Value = string,
  Multiple extends boolean | undefined = false,
> = Combobox.Root.Props<Value, Multiple>;
export type ComboboxActions = Combobox.Root.Actions;
export type ComboboxChangeEventDetails = Combobox.Root.ChangeEventDetails;
export type ComboboxChangeEventReason = Combobox.Root.ChangeEventReason;
export type ComboboxHighlightEventDetails = Combobox.Root.HighlightEventDetails;
export type ComboboxHighlightEventReason = Combobox.Root.HighlightEventReason;

export const { useFilter } = Combobox;

export interface SimpleComboboxProps extends Omit<Combobox.Root.Props<string, false>, 'children'> {
  items: readonly string[];
}

function useComboboxFilter(
  options?: Parameters<typeof Combobox.useFilter>[0],
): ReturnType<typeof Combobox.useFilter> {
  return Combobox.useFilter(options);
}

export const ComboboxHarness = React.forwardRef<HTMLInputElement, SimpleComboboxProps>(
  function ComboboxHarness(props, ref) {
    const actionsRef = React.useRef<ComboboxActions>({ unmount() {} });
    const filter = useComboboxFilter({ value: props.value, multiple: false });

    function handleValueChange(value: string | null, details: ComboboxChangeEventDetails) {
      const reason: ComboboxChangeEventReason = details.reason;
      if (reason === 'item-press') {
        details.cancel();
      }
      void value;
    }

    function handleItemHighlighted(
      value: string | undefined,
      details: ComboboxHighlightEventDetails,
    ) {
      void value;
      const reason: ComboboxHighlightEventReason = details.reason;
      if (reason === 'keyboard') {
        void 0;
      }
    }

    return (
      <Combobox.Root
        actionsRef={actionsRef}
        onValueChange={handleValueChange}
        onItemHighlighted={handleItemHighlighted}
        filter={filter.contains}
      >
        <Combobox.Input ref={ref} />
        <Combobox.Trigger />
        <Combobox.Positioner>
          <Combobox.Popup>
            {props.items.map((item) => (
              <Combobox.Item key={item} value={item}>
                {item}
              </Combobox.Item>
            ))}
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Root>
    );
  },
);
