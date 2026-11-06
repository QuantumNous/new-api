'use client';
import * as React from 'react';
import { Combobox as BaseCombobox } from '@base-ui/react/combobox';
import { useStableCallback } from '@base-ui/utils/useStableCallback';
import styles from './creatable-tags.module.css';

const INITIAL_ITEMS = [
  'Black',
  'Blue',
  'Cyan',
  'Gray',
  'Green',
  'Magenta',
  'Orange',
  'Purple',
  'Red',
  'White',
  'Yellow',
];

interface ComboboxProps {
  items?: string[];
  selectedItems: string[];
  onSelectedItemsChange: (items: string[]) => void;
  onCreate?: (label: string) => void;
  placeholder?: string;
}

export default function Experiment() {
  const [items, setItems] = React.useState(INITIAL_ITEMS);
  const [selectedItems, setSelectedItems] = React.useState<string[]>([]);

  return (
    <div className={styles.Container}>
      <h1>Creatable tags</h1>
      <p className={styles.Intro}>
        Select multiple items from the list or create new ones by typing and pressing Enter or
        comma.
      </p>
      <Combobox
        items={items}
        selectedItems={selectedItems}
        onSelectedItemsChange={setSelectedItems}
        onCreate={(label) => {
          setItems((prev) => [...prev, label].sort());
        }}
        placeholder="Red, Green, Blue…"
      />
    </div>
  );
}

function Combobox(props: ComboboxProps) {
  const {
    items = [],
    selectedItems,
    onSelectedItemsChange,
    onCreate,
    placeholder: placeholderProp,
  } = props;
  const [inputValue, setInputValue] = React.useState('');

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const comboboxInputRef = React.useRef<HTMLInputElement | null>(null);
  const highlightedItemRef = React.useRef<InternalComboboxItem | null>(null);

  const handleCreate = useStableCallback(async (labelToAdd: string) => {
    if (labelToAdd === '') {
      return;
    }

    onCreate?.(labelToAdd);
    const next = [...selectedItems, labelToAdd];
    onSelectedItemsChange(next);
    setInputValue('');
    return;
  });

  const trimmedValue = inputValue.trim();
  const exactMatchExists = items.some(
    (item) => item.trim().toLocaleLowerCase() === trimmedValue.toLocaleLowerCase(),
  );

  // Show the creatable item alongside matches if there's no exact match, and keep selections on top
  const itemsForView: InternalComboboxItem[] = React.useMemo(() => {
    const selectedSet = new Set(selectedItems);
    const normalizedItems = items.map((value) => ({ value }));
    const ordered = [
      ...normalizedItems.filter((item) => selectedSet.has(item.value)),
      ...normalizedItems.filter((item) => !selectedSet.has(item.value)),
    ];

    return trimmedValue !== '' && !exactMatchExists
      ? [...ordered, { value: trimmedValue, isNew: true }]
      : ordered;
  }, [items, selectedItems, trimmedValue, exactMatchExists]);

  const handleCommit = useStableCallback((item?: InternalComboboxItem | null) => {
    if (item) {
      if (item.isNew) {
        void handleCreate(item.value);
        return;
      }

      if (selectedItems.includes(item.value)) {
        setInputValue('');
        return;
      }

      onSelectedItemsChange([...selectedItems, item.value]);
      setInputValue('');
      return;
    }

    if (trimmedValue === '') {
      return;
    }

    const normalized = trimmedValue.toLocaleLowerCase();
    const existing = items.find((candidate) => candidate.trim().toLocaleLowerCase() === normalized);

    if (existing) {
      const next = selectedItems.some((i) => i === existing)
        ? selectedItems
        : [...selectedItems, existing];
      onSelectedItemsChange(next);
      setInputValue('');
      return;
    }

    void handleCreate(trimmedValue);
  });

  const handleInputKeyDown = useStableCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    // Treat comma as Enter
    if (event.key === ',') {
      event.preventDefault();
      if (highlightedItemRef.current) {
        handleCommit(highlightedItemRef.current);
        return;
      }
      handleCommit();
      return;
    }

    if (event.key === 'Enter' && highlightedItemRef.current == null) {
      event.preventDefault();
      handleCommit();
    }
  });

  const selectedItemsForView = React.useMemo(() => {
    const map = new Map(itemsForView.map((item) => [item.value, item] as const));
    return selectedItems
      .map((selectedValue) => map.get(selectedValue))
      .filter((item): item is InternalComboboxItem => Boolean(item));
  }, [itemsForView, selectedItems]);

  return (
    <BaseCombobox.Root
      items={itemsForView}
      multiple
      onValueChange={(nextSelectedItems: InternalComboboxItem[]) => {
        if (nextSelectedItems.length === 0) {
          onSelectedItemsChange([]);
          return;
        }

        const lastItem = nextSelectedItems[nextSelectedItems.length - 1];
        if (!lastItem) {
          return;
        }

        if (lastItem.isNew) {
          void handleCreate(lastItem.value);
          return;
        }

        const clean = nextSelectedItems.filter((item) => !item.isNew);
        onSelectedItemsChange(clean.map((i) => i.value));
        setInputValue('');
      }}
      value={selectedItemsForView}
      inputValue={inputValue}
      onInputValueChange={setInputValue}
      onItemHighlighted={(item) => {
        highlightedItemRef.current = item ?? null;
      }}
    >
      <div className={styles.Field}>
        <BaseCombobox.Chips className={styles.Chips} ref={containerRef}>
          <BaseCombobox.Value>
            {(itemsToRender: InternalComboboxItem[]) => (
              <React.Fragment>
                {itemsToRender.map((item) => (
                  <BaseCombobox.Chip
                    key={item.value}
                    className={styles.Chip}
                    aria-label={item.value}
                  >
                    {item.value}
                    <BaseCombobox.ChipRemove className={styles.ChipRemove} aria-label="Remove">
                      <XIcon />
                    </BaseCombobox.ChipRemove>
                  </BaseCombobox.Chip>
                ))}
                <BaseCombobox.Input
                  ref={comboboxInputRef}
                  placeholder={itemsToRender.length > 0 ? '' : placeholderProp}
                  className={styles.Input}
                  onKeyDown={handleInputKeyDown}
                />
              </React.Fragment>
            )}
          </BaseCombobox.Value>
        </BaseCombobox.Chips>
      </div>

      <BaseCombobox.Portal>
        <BaseCombobox.Positioner className={styles.Positioner} sideOffset={4} anchor={containerRef}>
          <BaseCombobox.Popup className={styles.Popup}>
            <BaseCombobox.List>
              {(item: InternalComboboxItem) =>
                item.isNew ? renderCreateItem(item) : renderRegularItem(item)
              }
            </BaseCombobox.List>
          </BaseCombobox.Popup>
        </BaseCombobox.Positioner>
      </BaseCombobox.Portal>
    </BaseCombobox.Root>
  );
}

function renderRegularItem(item: InternalComboboxItem) {
  return (
    <BaseCombobox.Item key={String(item.value)} className={styles.Item} value={item}>
      <BaseCombobox.ItemIndicator className={styles.ItemIndicator}>
        <CheckIcon className={styles.TinyIcon} />
      </BaseCombobox.ItemIndicator>
      <div className={styles.ItemText}>{item.value}</div>
    </BaseCombobox.Item>
  );
}

function renderCreateItem(item: InternalComboboxItem) {
  return (
    <BaseCombobox.Item key={`new:${item.value}`} className={styles.Item} value={item}>
      <span className={styles.ItemIndicator}>
        <PlusIcon className={styles.TinyIcon} />
      </span>

      <div className={styles.ItemText}>{item.value}</div>
    </BaseCombobox.Item>
  );
}

interface InternalComboboxItem {
  value: string;
  isNew?: boolean;
}

function CheckIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg fill="currentColor" width="10" height="10" viewBox="0 0 10 10" {...props}>
      <path d="M9.1603 1.12218C9.50684 1.34873 9.60427 1.81354 9.37792 2.16038L5.13603 8.66012C5.01614 8.8438 4.82192 8.96576 4.60451 8.99384C4.3871 9.02194 4.1683 8.95335 4.00574 8.80615L1.24664 6.30769C0.939709 6.02975 0.916013 5.55541 1.19372 5.24822C1.47142 4.94102 1.94536 4.91731 2.2523 5.19524L4.36085 7.10461L8.12299 1.33999C8.34934 0.993152 8.81376 0.895638 9.1603 1.12218Z" />
    </svg>
  );
}

function PlusIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="butt"
      strokeLinejoin="miter"
      aria-hidden
      {...props}
    >
      <path d="M6 1v10M1 6h10" />
    </svg>
  );
}

function XIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
