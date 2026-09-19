import * as React from 'react';
import { Combobox } from '@base-ui/react/combobox';
import { benchmark, ElementTiming } from '@mui/internal-benchmark';
import { createRows } from './shared';

const largeItems = createRows(500, 'Row');

/**
 * Types `text` into the combobox input one character at a time, mimicking a user.
 * Each keystroke sets the controlled value via the native setter and dispatches a real
 * `InputEvent` (with `inputType`) so the component's `onChange` runs exactly as it would for a
 * typed character. Awaits a macrotask between keystrokes so React commits each keystroke's
 * render before the next, keeping the recorded render events deterministic across iterations.
 */
async function typeInto(input: HTMLInputElement, text: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  )!.set!;

  for (let i = 1; i <= text.length; i += 1) {
    const next = text.slice(0, i);
    valueSetter.call(input, next);
    input.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text[i - 1] }),
    );
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  }
}

function getBenchInput() {
  const input = document.querySelector<HTMLInputElement>('input[aria-label="combobox-bench"]');
  if (input == null) {
    throw new Error('Missing combobox benchmark input');
  }
  return input;
}

/**
 * A large, open combobox built with the documented function-children pattern. Item values and
 * labels are referentially stable, so `React.memo` on `<Combobox.Item>` can legitimately bail —
 * the only thing forcing the already-mounted items to re-render on each keystroke is whether they
 * subscribe to a context that changes per keystroke.
 */
function LargeCombobox() {
  return (
    <Combobox.Root items={largeItems} defaultOpen>
      <Combobox.Input aria-label="combobox-bench" />
      <div>
        <ElementTiming name="combobox-open" />
      </div>
      <Combobox.List>
        {(item: (typeof largeItems)[number]) => (
          <Combobox.Item key={item.id} value={item}>
            {item.label}
          </Combobox.Item>
        )}
      </Combobox.List>
    </Combobox.Root>
  );
}

// Typing a common prefix keeps every item in the filtered set, so all 500 stay mounted across
// keystrokes. This isolates the per-keystroke re-render cost of the already-rendered items
// (no mount/unmount churn): the exact work the derived-items-context split removes.
benchmark(
  'Combobox type — 500 items, all stay mounted (type "Row ")',
  () => <LargeCombobox />,
  async ({ waitForElementTiming }) => {
    await waitForElementTiming('combobox-open');
    await typeInto(getBenchInput(), 'Row ');
  },
);

// Typing a specific query narrows the list from 500 down to ~11 items. This mixes unmount cost
// (paid on both master and the fix) with re-renders of the surviving items.
benchmark(
  'Combobox type — 500 items, narrows to ~11 (type "Row 25")',
  () => <LargeCombobox />,
  async ({ waitForElementTiming }) => {
    await waitForElementTiming('combobox-open');
    await typeInto(getBenchInput(), 'Row 25');
  },
);
