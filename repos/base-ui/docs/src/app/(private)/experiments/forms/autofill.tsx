'use client';
import * as React from 'react';
import { Autocomplete } from '@base-ui/react/autocomplete';
import { Combobox } from '@base-ui/react/combobox';
import { Field } from '@base-ui/react/field';
import { Select } from '@base-ui/react/select';
import styles from './autofill.module.css';

const states = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];
const suburbs = ['Darlinghurst', 'Sydney', 'Surry Hills', 'Paddington', 'Redfern'];
const addressLines = [
  '4/59 Test Street',
  '21 King Street',
  '88 George Street',
  '12 Crown Street',
  '9 Oxford Street',
];

export default function Page() {
  const [stateValue, setStateValue] = React.useState<string | null>(null);
  const [suburbValue, setSuburbValue] = React.useState<string | null>(null);

  return (
    <div className={styles.Page}>
      <div>
        <h1 className={styles.Title}>Autofill (real browser)</h1>
        <p className={styles.Description}>
          This page mirrors an Australian address profile (Australia, NSW, Darlinghurst, 2000). Use
          Chrome&apos;s saved address profiles to autofill the hidden inputs used by Select and
          Combobox.
        </p>
      </div>

      <form autoComplete="on" className={styles.Form}>
        <div className={styles.Section}>
          <div className={styles.SectionTitle}>Address profile fields</div>
          <div className={styles.Field}>
            <label className={styles.Label} htmlFor="country-name">
              Country/Region
            </label>
            <input
              id="country-name"
              name="country"
              autoComplete="country-name"
              className={styles.TextInput}
              placeholder="Australia"
            />
          </div>
          <div className={styles.Field}>
            <label className={styles.Label} htmlFor="organization">
              Organisation
            </label>
            <input
              id="organization"
              name="organization"
              autoComplete="organization"
              className={styles.TextInput}
              placeholder="Software"
            />
          </div>
          <div className={styles.Field}>
            <label className={styles.Label} htmlFor="full-name">
              Name
            </label>
            <input
              id="full-name"
              name="name"
              autoComplete="name"
              className={styles.TextInput}
              placeholder="Jane Doe"
            />
          </div>
          <div className={styles.Field}>
            <label className={styles.Label} htmlFor="street-address">
              Street address
            </label>
            <input
              id="street-address"
              name="street-address"
              autoComplete="street-address"
              className={styles.TextInput}
              placeholder="4/59 Test Street"
            />
          </div>
          <div className={styles.Row}>
            <div className={styles.Field}>
              <Autocomplete.Root items={addressLines} name="address-line1" openOnInputClick={false}>
                <div className={styles.ComboboxLabel}>
                  <label htmlFor="address-line1-autocomplete">Address line 1 (Autocomplete)</label>
                  <div className={styles.ComboboxInputWrapper}>
                    <Autocomplete.Input
                      id="address-line1-autocomplete"
                      className={styles.ComboboxInput}
                      placeholder="4/59 Test Street"
                      autoComplete="address-line1"
                    />
                    <div className={styles.ComboboxActionButtons}>
                      <Autocomplete.Trigger
                        className={styles.ComboboxTrigger}
                        aria-label="Open address line list"
                      >
                        <ChevronDownIcon className={styles.ComboboxTriggerIcon} />
                      </Autocomplete.Trigger>
                    </div>
                  </div>
                </div>
                <Autocomplete.Portal>
                  <Autocomplete.Positioner className={styles.ComboboxPositioner} sideOffset={4}>
                    <Autocomplete.Popup className={styles.ComboboxPopup}>
                      <Autocomplete.Empty className={styles.ComboboxEmpty}>
                        No addresses found.
                      </Autocomplete.Empty>
                      <Autocomplete.List className={styles.ComboboxList}>
                        {(addressLine: string) => (
                          <Autocomplete.Item
                            key={addressLine}
                            value={addressLine}
                            className={styles.ComboboxItem}
                          >
                            <span className={styles.ComboboxItemIndicator} />
                            <div className={styles.ComboboxItemText}>{addressLine}</div>
                          </Autocomplete.Item>
                        )}
                      </Autocomplete.List>
                    </Autocomplete.Popup>
                  </Autocomplete.Positioner>
                </Autocomplete.Portal>
              </Autocomplete.Root>
            </div>
            <div className={styles.Field}>
              <Combobox.Root
                items={suburbs}
                name="address-level2"
                autoComplete="address-level2"
                openOnInputClick={false}
                value={suburbValue}
                onValueChange={setSuburbValue}
              >
                <div className={styles.ComboboxLabel}>
                  <label htmlFor="suburb-combobox">Suburb</label>
                  <div className={styles.ComboboxInputWrapper}>
                    <Combobox.Input
                      id="suburb-combobox"
                      className={styles.ComboboxInput}
                      placeholder="Darlinghurst"
                      autoComplete="off"
                    />
                    <div className={styles.ComboboxActionButtons}>
                      <Combobox.Clear className={styles.ComboboxClear} aria-label="Clear suburb">
                        <ClearIcon className={styles.ComboboxClearIcon} />
                      </Combobox.Clear>
                      <Combobox.Trigger
                        className={styles.ComboboxTrigger}
                        aria-label="Open suburb list"
                      >
                        <ChevronDownIcon className={styles.ComboboxTriggerIcon} />
                      </Combobox.Trigger>
                    </div>
                  </div>
                </div>
                <Combobox.Portal>
                  <Combobox.Positioner className={styles.ComboboxPositioner} sideOffset={4}>
                    <Combobox.Popup className={styles.ComboboxPopup}>
                      <Combobox.Empty className={styles.ComboboxEmpty}>
                        No suburbs found.
                      </Combobox.Empty>
                      <Combobox.List className={styles.ComboboxList}>
                        {(suburb: string) => (
                          <Combobox.Item
                            key={suburb}
                            value={suburb}
                            className={styles.ComboboxItem}
                          >
                            <Combobox.ItemIndicator className={styles.ComboboxItemIndicator}>
                              <CheckIcon className={styles.ComboboxItemIndicatorIcon} />
                            </Combobox.ItemIndicator>
                            <div className={styles.ComboboxItemText}>{suburb}</div>
                          </Combobox.Item>
                        )}
                      </Combobox.List>
                    </Combobox.Popup>
                  </Combobox.Positioner>
                </Combobox.Portal>
              </Combobox.Root>
            </div>
            <Field.Root className={styles.Field}>
              <Field.Label className={styles.Label} nativeLabel={false} render={<div />}>
                State
              </Field.Label>
              <Select.Root
                name="address-level1"
                autoComplete="address-level1"
                value={stateValue}
                onValueChange={setStateValue}
              >
                <Select.Trigger className={styles.SelectTrigger}>
                  <Select.Value className={styles.SelectValue} placeholder="Select state" />
                  <Select.Icon className={styles.SelectIcon}>
                    <ChevronUpDownIcon />
                  </Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Positioner className={styles.SelectPositioner} sideOffset={8}>
                    <Select.Popup className={styles.SelectPopup}>
                      <Select.ScrollUpArrow className={styles.SelectScrollArrow} />
                      <Select.List className={styles.SelectList}>
                        {states.map((state) => (
                          <Select.Item key={state} value={state} className={styles.SelectItem}>
                            <Select.ItemIndicator className={styles.SelectItemIndicator}>
                              <CheckIcon className={styles.SelectItemIndicatorIcon} />
                            </Select.ItemIndicator>
                            <Select.ItemText className={styles.SelectItemText}>
                              {state}
                            </Select.ItemText>
                          </Select.Item>
                        ))}
                      </Select.List>
                      <Select.ScrollDownArrow className={styles.SelectScrollArrow} />
                    </Select.Popup>
                  </Select.Positioner>
                </Select.Portal>
              </Select.Root>
            </Field.Root>
            <div className={styles.Field}>
              <label className={styles.Label} htmlFor="postal-code">
                Postcode
              </label>
              <input
                id="postal-code"
                name="postal-code"
                autoComplete="postal-code"
                className={styles.TextInput}
                placeholder="2000"
              />
            </div>
          </div>
          <div className={styles.Row}>
            <div className={styles.Field}>
              <label className={styles.Label} htmlFor="phone">
                Phone
              </label>
              <input
                id="phone"
                name="tel"
                autoComplete="tel"
                className={styles.TextInput}
                placeholder="04199000199"
              />
            </div>
            <div className={styles.Field}>
              <label className={styles.Label} htmlFor="email">
                Email
              </label>
              <input
                id="email"
                name="email"
                autoComplete="email"
                className={styles.TextInput}
                placeholder="test@example.com"
              />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

function ChevronUpDownIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      width="8"
      height="12"
      viewBox="0 0 8 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      {...props}
    >
      <path d="M0.5 4.5L4 1.5L7.5 4.5" />
      <path d="M0.5 7.5L4 10.5L7.5 7.5" />
    </svg>
  );
}

function CheckIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg fill="currentColor" width="10" height="10" viewBox="0 0 10 10" {...props}>
      <path d="M9.1603 1.12218C9.50684 1.34873 9.60427 1.81354 9.37792 2.16038L5.13603 8.66012C5.01614 8.8438 4.82192 8.96576 4.60451 8.99384C4.3871 9.02194 4.1683 8.95335 4.00574 8.80615L1.24664 6.30769C0.939709 6.02975 0.916013 5.55541 1.19372 5.24822C1.47142 4.94102 1.94536 4.91731 2.2523 5.19524L4.36085 7.10461L8.12299 1.33999C8.34934 0.993152 8.81376 0.895638 9.1603 1.12218Z" />
    </svg>
  );
}

function ClearIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}

function ChevronDownIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
