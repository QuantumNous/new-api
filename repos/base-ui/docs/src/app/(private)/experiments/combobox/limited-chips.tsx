'use client';
import * as React from 'react';
import { Combobox } from '@base-ui/react/combobox';
import styles from './limited-chips.module.css';

const CHIP_LIMIT = 3;

export default function Experiment() {
  const id = React.useId();
  const [value, setValue] = React.useState<ProgrammingLanguage[]>(() => langs.slice(0, 7));
  const [inputValue, setInputValue] = React.useState('');
  const [expandWhileFocused, setExpandWhileFocused] = React.useState(false);
  const [focusedWithin, setFocusedWithin] = React.useState(false);

  const selectedNames = value.map((language) => language.value).join(', ');

  return (
    <div className={styles.Container}>
      <h1>Limited chips combobox</h1>
      <p className={styles.Intro}>
        The combobox below renders the first {CHIP_LIMIT} selected chips and keeps the rest selected
        behind the overflow label.
      </p>

      <Combobox.Root
        items={langs}
        multiple
        value={value}
        inputValue={inputValue}
        onValueChange={setValue}
        onInputValueChange={setInputValue}
      >
        <div className={styles.Field}>
          <label className={styles.Label} htmlFor={id}>
            Programming languages
          </label>
          <Combobox.InputGroup
            className={styles.InputGroup}
            onFocusCapture={() => {
              setFocusedWithin(true);
            }}
            onBlurCapture={(event) => {
              const nextFocusedElement = event.relatedTarget;

              if (
                !(nextFocusedElement instanceof Node) ||
                !event.currentTarget.contains(nextFocusedElement)
              ) {
                setFocusedWithin(false);
              }
            }}
          >
            <Combobox.Chips className={styles.Chips}>
              <Combobox.Value>
                {(selectedValue: ProgrammingLanguage[]) => {
                  const visibleValue =
                    expandWhileFocused && focusedWithin
                      ? selectedValue
                      : selectedValue.slice(0, CHIP_LIMIT);
                  const hiddenCount = selectedValue.length - visibleValue.length;

                  return (
                    <React.Fragment>
                      {visibleValue.map((language) => (
                        <Combobox.Chip
                          key={language.id}
                          className={styles.Chip}
                          aria-label={language.value}
                        >
                          {language.value}
                          <Combobox.ChipRemove
                            className={styles.ChipRemove}
                            aria-label={`Remove ${language.value}`}
                          >
                            <XIcon />
                          </Combobox.ChipRemove>
                        </Combobox.Chip>
                      ))}
                      {hiddenCount > 0 && (
                        <span className={styles.Overflow}>+{hiddenCount} more</span>
                      )}
                      <Combobox.Input
                        id={id}
                        placeholder={selectedValue.length > 0 ? '' : 'e.g. TypeScript'}
                        className={styles.Input}
                      />
                    </React.Fragment>
                  );
                }}
              </Combobox.Value>
            </Combobox.Chips>
          </Combobox.InputGroup>
        </div>

        <Combobox.Portal>
          <Combobox.Positioner className={styles.Positioner} sideOffset={4}>
            <Combobox.Popup className={styles.Popup}>
              <Combobox.Empty>
                <div className={styles.Empty}>No languages found.</div>
              </Combobox.Empty>
              <Combobox.List>
                {(language: ProgrammingLanguage) => (
                  <Combobox.Item key={language.id} className={styles.Item} value={language}>
                    <Combobox.ItemIndicator className={styles.ItemIndicator}>
                      <CheckIcon className={styles.ItemIndicatorIcon} />
                    </Combobox.ItemIndicator>
                    <div className={styles.ItemText}>{language.value}</div>
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>

      <div className={styles.Controls}>
        <label className={styles.CheckboxLabel}>
          <input
            type="checkbox"
            checked={expandWhileFocused}
            onChange={(event) => {
              setExpandWhileFocused(event.target.checked);
            }}
          />
          Expand chips while focused
        </label>
        <div className={styles.Buttons}>
          <button
            type="button"
            className={styles.Button}
            onClick={() => {
              setValue(langs.slice(0, 7));
              setInputValue('');
            }}
          >
            Reset selection
          </button>
          <button
            type="button"
            className={styles.Button}
            onClick={() => {
              setValue([]);
              setInputValue('');
            }}
          >
            Clear
          </button>
        </div>
      </div>

      <div className={styles.Status}>
        <strong>Selected:</strong> {selectedNames || 'none'}
      </div>
    </div>
  );
}

function CheckIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg fill="currentColor" width="10" height="10" viewBox="0 0 10 10" {...props}>
      <path d="M9.1603 1.12218C9.50684 1.34873 9.60427 1.81354 9.37792 2.16038L5.13603 8.66012C5.01614 8.8438 4.82192 8.96576 4.60451 8.99384C4.3871 9.02194 4.1683 8.95335 4.00574 8.80615L1.24664 6.30769C0.939709 6.02975 0.916013 5.55541 1.19372 5.24822C1.47142 4.94102 1.94536 4.91731 2.2523 5.19524L4.36085 7.10461L8.12299 1.33999C8.34934 0.993152 8.81376 0.895638 9.1603 1.12218Z" />
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

interface ProgrammingLanguage {
  id: string;
  value: string;
}

const langs: ProgrammingLanguage[] = [
  { id: 'js', value: 'JavaScript' },
  { id: 'ts', value: 'TypeScript' },
  { id: 'py', value: 'Python' },
  { id: 'java', value: 'Java' },
  { id: 'cpp', value: 'C++' },
  { id: 'cs', value: 'C#' },
  { id: 'php', value: 'PHP' },
  { id: 'ruby', value: 'Ruby' },
  { id: 'go', value: 'Go' },
  { id: 'rust', value: 'Rust' },
  { id: 'swift', value: 'Swift' },
];
