'use client';
import * as React from 'react';
import { Combobox } from '@base-ui/react/combobox';
import { Dialog } from '@base-ui/react/dialog';
import styles from './index.module.css';

export default function ExampleCreatableCombobox() {
  const id = React.useId();

  const [labels, setLabels] = React.useState<LabelItem[]>(initialLabels);
  const [selected, setSelected] = React.useState<LabelItem[]>([]);
  const [query, setQuery] = React.useState('');
  const [openDialog, setOpenDialog] = React.useState(false);

  const createInputRef = React.useRef<HTMLInputElement | null>(null);
  const comboboxInputRef = React.useRef<HTMLInputElement | null>(null);
  const pendingQueryRef = React.useRef('');
  const highlightedItemRef = React.useRef<LabelItem | undefined>(undefined);

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter' || highlightedItemRef.current) {
      return;
    }

    const currentTrimmed = query.trim();
    if (currentTrimmed === '') {
      return;
    }

    const normalized = currentTrimmed.toLocaleLowerCase();
    const existing = labels.find((label) => label.value.trim().toLocaleLowerCase() === normalized);

    if (existing) {
      setSelected((prev) =>
        prev.some((item) => item.id === existing.id) ? prev : [...prev, existing],
      );
      setQuery('');
      return;
    }

    pendingQueryRef.current = currentTrimmed;
    setOpenDialog(true);
  }

  function handleCreate() {
    const input = createInputRef.current || comboboxInputRef.current;
    const value = input ? input.value.trim() : '';
    if (!value) {
      return;
    }

    const normalized = value.toLocaleLowerCase();
    const baseId = normalized.replace(/\s+/g, '-');
    const existing = labels.find((l) => l.value.trim().toLocaleLowerCase() === normalized);

    if (existing) {
      setSelected((prev) => (prev.some((i) => i.id === existing.id) ? prev : [...prev, existing]));
      setOpenDialog(false);
      setQuery('');
      return;
    }

    // Ensure we don't collide with an existing id (e.g., value "docs" vs. existing id "docs")
    const existingIds = new Set(labels.map((l) => l.id));
    let uniqueId = baseId;
    if (existingIds.has(uniqueId)) {
      let i = 2;
      while (existingIds.has(`${baseId}-${i}`)) {
        i += 1;
      }
      uniqueId = `${baseId}-${i}`;
    }

    const newItem: LabelItem = { id: uniqueId, value };

    if (!selected.find((item) => item.id === newItem.id)) {
      setLabels((prev) => [...prev, newItem]);
      setSelected((prev) => [...prev, newItem]);
    }

    setOpenDialog(false);
    setQuery('');
  }

  function handleCreateSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    handleCreate();
  }

  const trimmed = query.trim();
  const lowered = trimmed.toLocaleLowerCase();
  const exactExists = labels.some((l) => l.value.trim().toLocaleLowerCase() === lowered);
  // Show the creatable item alongside matches if there's no exact match
  const itemsForView: Array<LabelItem> =
    trimmed !== '' && !exactExists
      ? [...labels, { creatable: trimmed, id: `create:${lowered}`, value: `Create "${trimmed}"` }]
      : labels;

  return (
    <React.Fragment>
      <Combobox.Root
        items={itemsForView}
        multiple
        onValueChange={(next) => {
          const creatableSelection = next.find(
            (item) => item.creatable && !selected.some((current) => current.id === item.id),
          );

          if (creatableSelection && creatableSelection.creatable) {
            pendingQueryRef.current = creatableSelection.creatable;
            setOpenDialog(true);
            return;
          }
          const clean = next.filter((i) => !i.creatable);
          setSelected(clean);
          setQuery('');
        }}
        value={selected}
        inputValue={query}
        onInputValueChange={setQuery}
        onItemHighlighted={(item) => {
          highlightedItemRef.current = item;
        }}
      >
        <div className={styles.Container}>
          <label className={styles.Label} htmlFor={id}>
            Labels
          </label>
          <Combobox.InputGroup className={styles.InputGroup}>
            <Combobox.Chips className={styles.Chips}>
              <Combobox.Value>
                {(value: LabelItem[]) => (
                  <React.Fragment>
                    {value.map((label) => (
                      <Combobox.Chip
                        key={label.id}
                        className={styles.Chip}
                        aria-label={label.value}
                      >
                        {label.value}
                        <Combobox.ChipRemove
                          className={styles.ChipRemove}
                          aria-label={`Remove ${label.value}`}
                        >
                          <XIcon />
                        </Combobox.ChipRemove>
                      </Combobox.Chip>
                    ))}
                    <Combobox.Input
                      ref={comboboxInputRef}
                      id={id}
                      placeholder={value.length > 0 ? '' : 'e.g. bug'}
                      className={styles.Input}
                      onKeyDown={handleInputKeyDown}
                    />
                  </React.Fragment>
                )}
              </Combobox.Value>
            </Combobox.Chips>
          </Combobox.InputGroup>
        </div>

        <Combobox.Portal>
          <Combobox.Positioner className={styles.Positioner} sideOffset={4}>
            <Combobox.Popup className={styles.Popup}>
              <Combobox.Empty>
                <div className={styles.Empty}>No labels found.</div>
              </Combobox.Empty>
              <Combobox.List>
                {(item: LabelItem) =>
                  item.creatable ? (
                    <Combobox.Item key={item.id} className={styles.Item} value={item}>
                      <span className={styles.ItemIndicator}>
                        <PlusIcon />
                      </span>
                      <span className={styles.ItemText}>Create "{item.creatable}"</span>
                    </Combobox.Item>
                  ) : (
                    <Combobox.Item key={item.id} className={styles.Item} value={item}>
                      <Combobox.ItemIndicator className={styles.ItemIndicator}>
                        <CheckIcon />
                      </Combobox.ItemIndicator>
                      <span className={styles.ItemText}>{item.value}</span>
                    </Combobox.Item>
                  )
                }
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>

      <Dialog.Root open={openDialog} onOpenChange={setOpenDialog}>
        <Dialog.Portal>
          <Dialog.Backdrop className={styles.Backdrop} />
          <Dialog.Popup className={styles.DialogPopup} initialFocus={createInputRef}>
            <Dialog.Title className={styles.Title}>Create new label</Dialog.Title>
            <Dialog.Description className={styles.Description}>
              Add a new label to select.
            </Dialog.Description>
            <form onSubmit={handleCreateSubmit}>
              <input
                ref={createInputRef}
                className={styles.TextField}
                placeholder="Label name"
                defaultValue={pendingQueryRef.current}
              />
              <div className={styles.Actions}>
                <Dialog.Close className={styles.Button}>Cancel</Dialog.Close>
                <button type="submit" className={styles.Button}>
                  Create
                </button>
              </div>
            </form>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </React.Fragment>
  );
}

function CheckIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      {...props}
      style={{ display: 'block', ...props.style }}
    >
      <path d="m2.5 8.5 4 4 7-9" />
    </svg>
  );
}

function PlusIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      {...props}
      style={{ display: 'block', ...props.style }}
    >
      <path d="M1.5 8h13M8 14.5v-13" />
    </svg>
  );
}

function XIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      {...props}
      style={{ display: 'block', ...props.style }}
    >
      <path d="m4.5 4.5 7 7m-7 0 7-7" />
    </svg>
  );
}

interface LabelItem {
  creatable?: string;
  id: string;
  value: string;
}

const initialLabels: LabelItem[] = [
  { id: 'bug', value: 'bug' },
  { id: 'docs', value: 'documentation' },
  { id: 'enhancement', value: 'enhancement' },
  { id: 'help-wanted', value: 'help wanted' },
  { id: 'good-first-issue', value: 'good first issue' },
];
