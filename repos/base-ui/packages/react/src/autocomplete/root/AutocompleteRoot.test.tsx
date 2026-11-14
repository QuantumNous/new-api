import { expect, vi } from 'vitest';
import * as React from 'react';
import { act, fireEvent, flushMicrotasks, screen, waitFor } from '@mui/internal-test-utils';
import { createRenderer, isJSDOM } from '#test-utils';
import { Autocomplete } from '@base-ui/react/autocomplete';
import { Field } from '@base-ui/react/field';
import { Form } from '@base-ui/react/form';
import { Input } from '@base-ui/react/input';

describe('<Autocomplete.Root />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  const { render, renderToString } = createRenderer();

  describe('keyboard interactions', () => {
    it('closes popup on Tab after selecting with Enter and typing again', async () => {
      const { user } = await render(
        <Autocomplete.Root items={['alpha', 'alpine', 'beta']} autoHighlight>
          <Autocomplete.Input />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List>
                  {(item: string) => (
                    <Autocomplete.Item key={item} value={item}>
                      {item}
                    </Autocomplete.Item>
                  )}
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
          <button />
        </Autocomplete.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');

      await user.click(input);
      await user.type(input, 'al');

      const firstOption = await screen.findByRole('option', { name: 'alpha' });
      expect(firstOption).toHaveAttribute('data-highlighted');

      await user.keyboard('{Enter}');
      expect(input.value).toBe('alpha');

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });

      await user.clear(input);
      await user.type(input, 'a');

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBe(null);
      });

      await user.tab();

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });
    });
  });

  it('should handle browser autofill', async () => {
    await render(
      <Field.Root name="auto">
        <Autocomplete.Root defaultValue="">
          <Autocomplete.Input data-testid="input" />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List>
                  <Autocomplete.Item value="alpha">alpha</Autocomplete.Item>
                  <Autocomplete.Item value="beta">beta</Autocomplete.Item>
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>
      </Field.Root>,
    );

    // Hidden inputs are rendered without a name for selectionMode='none', but Field provides the form input.
    // Simulate browser autofill by changing the hidden field control input for this Field.
    const hidden = screen.getByRole('textbox', {
      hidden: true,
    });
    fireEvent.change(hidden!, { target: { value: 'beta' } });
    await flushMicrotasks();

    const input = screen.getByTestId<HTMLInputElement>('input');
    expect(input.value).toBe('beta');
  });

  it('ignores hidden-input autofill when readOnly', async () => {
    const onValueChange = vi.fn();
    await render(
      <Field.Root name="auto">
        <Autocomplete.Root defaultValue="" readOnly onValueChange={onValueChange}>
          <Autocomplete.Input data-testid="input" />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List>
                  <Autocomplete.Item value="alpha">alpha</Autocomplete.Item>
                  <Autocomplete.Item value="beta">beta</Autocomplete.Item>
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>
      </Field.Root>,
    );

    const hidden = screen.getByRole<HTMLInputElement>('textbox', { hidden: true });
    fireEvent.change(hidden, { target: { value: 'beta' } });
    await flushMicrotasks();

    const input = screen.getByTestId<HTMLInputElement>('input');
    expect(onValueChange).not.toHaveBeenCalled();
    expect(input.value).toBe('');
  });

  it('ignores hidden-input autofill when disabled', async () => {
    const onValueChange = vi.fn();
    await render(
      <Field.Root name="auto">
        <Autocomplete.Root defaultValue="" disabled onValueChange={onValueChange}>
          <Autocomplete.Input data-testid="input" />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List>
                  <Autocomplete.Item value="alpha">alpha</Autocomplete.Item>
                  <Autocomplete.Item value="beta">beta</Autocomplete.Item>
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>
      </Field.Root>,
    );

    const hidden = screen.getByRole<HTMLInputElement>('textbox', { hidden: true });
    fireEvent.change(hidden, { target: { value: 'beta' } });
    await flushMicrotasks();

    const input = screen.getByTestId<HTMLInputElement>('input');
    expect(onValueChange).not.toHaveBeenCalled();
    expect(input.value).toBe('');
  });

  it('should pass autoComplete to the visible input', async () => {
    await render(
      <Autocomplete.Root name="search">
        <Autocomplete.Input autoComplete="on" />
        <Autocomplete.Portal>
          <Autocomplete.Positioner>
            <Autocomplete.Popup>
              <Autocomplete.List>
                <Autocomplete.Item value="alpha">alpha</Autocomplete.Item>
                <Autocomplete.Item value="beta">beta</Autocomplete.Item>
              </Autocomplete.List>
            </Autocomplete.Popup>
          </Autocomplete.Positioner>
        </Autocomplete.Portal>
      </Autocomplete.Root>,
    );

    const input = screen.getByRole('combobox');
    const hiddenInput = screen.getByRole('textbox', { hidden: true });

    expect(input).toHaveAttribute('name', 'search');
    expect(input).toHaveAttribute('autocomplete', 'on');
    expect(hiddenInput).not.toHaveAttribute('name');
    expect(hiddenInput).toHaveAttribute('id');
    expect(hiddenInput).not.toHaveAttribute('autocomplete');
  });

  it('does not expose data-placeholder on Trigger or InputGroup', async () => {
    const { user } = await render(
      <Autocomplete.Root items={['alpha', 'beta']} openOnInputClick>
        <Autocomplete.InputGroup data-testid="group">
          <Autocomplete.Input data-testid="input" />
          <Autocomplete.Trigger data-testid="trigger" />
        </Autocomplete.InputGroup>
        <Autocomplete.Portal>
          <Autocomplete.Positioner>
            <Autocomplete.Popup>
              <Autocomplete.List>
                {(item: string) => (
                  <Autocomplete.Item key={item} value={item}>
                    {item}
                  </Autocomplete.Item>
                )}
              </Autocomplete.List>
            </Autocomplete.Popup>
          </Autocomplete.Positioner>
        </Autocomplete.Portal>
      </Autocomplete.Root>,
    );

    const group = screen.getByTestId('group');
    const input = screen.getByTestId('input');
    const trigger = screen.getByTestId('trigger');

    expect(group).not.toHaveAttribute('data-placeholder');
    expect(trigger).not.toHaveAttribute('data-placeholder');

    await user.type(input, 'al');

    expect(group).not.toHaveAttribute('data-placeholder');
    expect(trigger).not.toHaveAttribute('data-placeholder');
  });

  describe('prop: autoHighlight', () => {
    it('calls onItemHighlighted when the popup auto highlights on open', async () => {
      const onItemHighlighted = vi.fn();

      const { user } = await render(
        <Autocomplete.Root
          items={['alpha', 'alpine', 'beta']}
          autoHighlight
          onItemHighlighted={onItemHighlighted}
        >
          <Autocomplete.Input data-testid="input" />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List>
                  {(item: string) => (
                    <Autocomplete.Item key={item} value={item}>
                      {item}
                    </Autocomplete.Item>
                  )}
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      const input = screen.getByTestId<HTMLInputElement>('input');
      await user.type(input, 'a');

      const firstOption = await screen.findByRole('option', { name: 'alpha' });
      expect(onItemHighlighted.mock.calls.length).toBeGreaterThan(0);

      const [value, eventDetails] = onItemHighlighted.mock.lastCall ?? [];
      expect(value).toBe('alpha');
      expect(eventDetails.reason).toBe('none');

      await waitFor(() => {
        expect(firstOption).toHaveAttribute('data-highlighted');
      });
    });

    it('highlights the first item when typing and keeps it during filtering', async () => {
      const { user } = await render(
        <Autocomplete.Root autoHighlight>
          <Autocomplete.Input />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List>
                  <Autocomplete.Item value="new york">new york</Autocomplete.Item>
                  <Autocomplete.Item value="new york city">new york city</Autocomplete.Item>
                  <Autocomplete.Item value="newcastle">newcastle</Autocomplete.Item>
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.type(input, 'new');

      const newYorkOption = screen.getByRole('option', { name: 'new york' });
      expect(newYorkOption).toHaveAttribute('data-highlighted');
      expect(input.getAttribute('aria-activedescendant')).toBe(newYorkOption.id);

      // Trailing space should not clear highlight if matches remain
      await user.type(input, ' ');

      expect(newYorkOption).toHaveAttribute('data-highlighted');
      expect(input.getAttribute('aria-activedescendant')).toBe(newYorkOption.id);
    });

    it('does not highlight on open via click or when pressing arrow keys initially', async () => {
      const { user } = await render(
        <Autocomplete.Root items={['apple', 'banana']} autoHighlight openOnInputClick>
          <Autocomplete.Input />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List>
                  {(item: string) => (
                    <Autocomplete.Item key={item} value={item}>
                      {item}
                    </Autocomplete.Item>
                  )}
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      fireEvent.click(input);

      await waitFor(() => {
        expect(input).not.toHaveAttribute('aria-activedescendant');
      });

      await user.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(input).not.toHaveAttribute('aria-activedescendant');
      });

      await user.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(input).not.toHaveAttribute('aria-activedescendant');
      });

      await user.keyboard('{Escape}');
      await user.click(input);

      expect(input).not.toHaveAttribute('aria-activedescendant');

      await user.keyboard('{ArrowUp}');
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant');
      });
    });

    it('highlights the first item when opening via ArrowDown', async () => {
      const { user } = await render(
        <Autocomplete.Root items={['alpha', 'beta', 'gamma']} autoHighlight>
          <Autocomplete.Input />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List>
                  {(item: string) => (
                    <Autocomplete.Item key={item} value={item}>
                      {item}
                    </Autocomplete.Item>
                  )}
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');

      await user.click(input);
      await user.keyboard('{ArrowDown}');

      const firstOption = await screen.findByRole('option', { name: 'alpha' });
      expect(firstOption).toHaveAttribute('data-highlighted');
      expect(input.getAttribute('aria-activedescendant')).toBe(firstOption.id);
    });

    it('links aria-activedescendant to the highlighted item after filtering', async () => {
      const { user } = await render(
        <Autocomplete.Root items={['feature', 'fix']} autoHighlight>
          <Autocomplete.Input />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List>
                  {(item) => (
                    <Autocomplete.Item key={item} value={item}>
                      {item}
                    </Autocomplete.Item>
                  )}
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      const input = screen.getByRole('combobox');
      await user.click(input);

      // Type 'f' — both items remain, first should be highlighted
      await user.type(input, 'f');
      const firstOption = screen.getByRole('option', { name: 'feature' });
      expect(firstOption).toHaveAttribute('data-highlighted');
      expect(input.getAttribute('aria-activedescendant')).toBe(firstOption.id);

      // Type 'i' — filters to "fix" and highlight should follow, with ids stable
      await user.type(input, 'i');
      const fixOption = screen.getByRole('option', { name: 'fix' });
      expect(fixOption).toHaveAttribute('data-highlighted');
      expect(input.getAttribute('aria-activedescendant')).toBe(fixOption.id);
    });

    it('does not highlight first/last item when pressing ArrowDown/ArrowUp initially', async () => {
      const { user } = await render(
        <Autocomplete.Root items={['alpha', 'beta', 'gamma']}>
          <Autocomplete.Input data-testid="input" />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List>
                  {(item: string) => (
                    <Autocomplete.Item key={item} value={item}>
                      {item}
                    </Autocomplete.Item>
                  )}
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      const input = screen.getByTestId<HTMLInputElement>('input');

      await user.click(input);
      expect(input).not.toHaveAttribute('aria-activedescendant');

      await user.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(input).not.toHaveAttribute('aria-activedescendant');
      });

      await user.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant');
      });
    });

    it('retains highlight when clearing the query with autoHighlight enabled', async () => {
      const { user } = await render(
        <Autocomplete.Root items={['apple', 'banana', 'cherry']} autoHighlight openOnInputClick>
          <Autocomplete.Input />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List>
                  {(item: string) => (
                    <Autocomplete.Item key={item} value={item}>
                      {item}
                    </Autocomplete.Item>
                  )}
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');

      await user.click(input);
      await user.type(input, 'ban');

      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      expect(input).toHaveAttribute('aria-activedescendant');

      const highlightedBefore = input.getAttribute('aria-activedescendant');
      expect(highlightedBefore).not.toBe(null);

      await user.clear(input);

      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      expect(input.getAttribute('aria-activedescendant')).toBe(highlightedBefore);
    });

    it('highlights the first item immediately when behavior is "always"', async () => {
      await render(
        <Autocomplete.Root items={['alpha', 'beta', 'gamma']} autoHighlight="always" defaultOpen>
          <Autocomplete.Input />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List>
                  {(item: string) => (
                    <Autocomplete.Item key={item} value={item}>
                      {item}
                    </Autocomplete.Item>
                  )}
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      const firstOption = screen.getByRole('option', { name: 'alpha' });

      expect(input).toHaveAttribute('aria-activedescendant', firstOption.id);
      expect(firstOption).toHaveAttribute('data-highlighted');
    });

    it('keeps the latest pointer highlight on outside blur when behavior is "always"', async () => {
      const { user } = await render(
        <React.Fragment>
          <Autocomplete.Root
            items={['apple', 'banana', 'cherry']}
            autoHighlight="always"
            keepHighlight
            open
            inline
          >
            <Autocomplete.Input data-testid="input" />
            <Autocomplete.List>
              {(item: string) => (
                <Autocomplete.Item key={item} value={item}>
                  {item}
                </Autocomplete.Item>
              )}
            </Autocomplete.List>
          </Autocomplete.Root>
          <button data-testid="outside">outside</button>
        </React.Fragment>,
      );

      const input = screen.getByTestId<HTMLInputElement>('input');
      const banana = screen.getByRole('option', { name: 'banana' });

      await act(async () => {
        input.focus();
      });

      await user.hover(banana);

      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', banana.id);
        expect(banana).toHaveAttribute('data-highlighted');
      });

      const outside = screen.getByTestId('outside');
      fireEvent.pointerDown(outside);
      fireEvent.blur(input, { relatedTarget: outside });
      fireEvent.focus(outside);

      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', banana.id);
        expect(banana).toHaveAttribute('data-highlighted');
      });

      expect(screen.getByRole('option', { name: 'apple' })).not.toHaveAttribute('data-highlighted');
    });
  });

  describe('prop: keepHighlight', () => {
    it('keeps the current highlight when the pointer leaves the list', async () => {
      const { user } = await render(
        <Autocomplete.Root items={['apple', 'banana']} autoHighlight keepHighlight>
          <Autocomplete.Input data-testid="input" />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List>
                  {(item: string) => (
                    <Autocomplete.Item key={item} value={item}>
                      {item}
                    </Autocomplete.Item>
                  )}
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await user.click(input);
      await user.type(input, 'ap');

      const apple = await screen.findByRole('option', { name: 'apple' });
      await waitFor(() => expect(apple).toHaveAttribute('data-highlighted'));

      const outside = document.createElement('div');
      document.body.appendChild(outside);
      fireEvent.pointerLeave(apple, { pointerType: 'mouse', relatedTarget: outside });

      await waitFor(() => expect(apple).toHaveAttribute('data-highlighted'));
      outside.remove();
    });

    it('continues keyboard navigation from the kept highlight after pointer leave', async () => {
      const { user } = await render(
        <Autocomplete.Root items={['apple', 'banana', 'carrot']} autoHighlight keepHighlight>
          <Autocomplete.Input />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List>
                  {(item: string) => (
                    <Autocomplete.Item key={item} value={item}>
                      {item}
                    </Autocomplete.Item>
                  )}
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await user.click(input);
      await user.type(input, 'a');

      const apple = await screen.findByRole('option', { name: 'apple' });
      await waitFor(() => expect(apple).toHaveAttribute('data-highlighted'));

      const outside = document.createElement('div');
      document.body.appendChild(outside);
      fireEvent.pointerLeave(apple, { pointerType: 'mouse', relatedTarget: outside });

      await user.keyboard('{ArrowDown}');

      const banana = screen.getByRole('option', { name: 'banana' });
      await waitFor(() => expect(banana).toHaveAttribute('data-highlighted'));
      outside.remove();
    });
  });

  describe('prop: mode', () => {
    it('mode="list" (default): no inline overlay, consumer handles filtering', async () => {
      const items = ['apple', 'banana', 'cherry'];

      const { user } = await render(
        <Autocomplete.Root mode="list" items={items}>
          <Autocomplete.Input data-testid="input" />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List>
                  {(item) => (
                    <Autocomplete.Item key={item} value={item}>
                      {item}
                    </Autocomplete.Item>
                  )}
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');

      await user.click(input);
      await user.type(input, 'a');

      expect(screen.getAllByRole('option')).toHaveLength(2); // apple, banana

      await user.keyboard('{ArrowDown}');

      expect(input.value).toBe('a');
      expect(screen.getAllByRole('option')).toHaveLength(2);
    });

    it('mode="both": inline overlay + autocomplete handles filtering', async () => {
      const items = ['apple', 'banana', 'cherry'];

      const { user } = await render(
        <Autocomplete.Root mode="both" items={items}>
          <Autocomplete.Input data-testid="input" />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List>
                  {(item) => (
                    <Autocomplete.Item key={item} value={item}>
                      {item}
                    </Autocomplete.Item>
                  )}
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      const input = screen.getByTestId<HTMLInputElement>('input');

      await user.click(input);
      await user.type(input, 'a');

      expect(screen.getAllByRole('option')).toHaveLength(2); // apple, banana

      await user.keyboard('{ArrowDown}');

      expect(input.value).toBe('apple');
      expect(screen.getAllByRole('option')).toHaveLength(2);
    });

    it('mode="both": hovering items should not change the inline overlay (preserve temporary value)', async () => {
      const items = ['alpha', 'alpine', 'beta'];

      const { user } = await render(
        <Autocomplete.Root mode="both" items={items}>
          <Autocomplete.Input data-testid="input" />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List>
                  {(item) => (
                    <Autocomplete.Item key={item} value={item}>
                      {item}
                    </Autocomplete.Item>
                  )}
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await user.click(input);
      await user.type(input, 'al');

      await user.keyboard('{ArrowDown}');
      expect(input.value).toBe('alpha');

      await user.hover(screen.getByRole('option', { name: 'alpine' }));
      expect(input.value).toBe('alpha');
    });

    it('mode="inline": static items with inline overlay', async () => {
      const { user } = await render(
        <Autocomplete.Root mode="inline" openOnInputClick>
          <Autocomplete.Input data-testid="input" />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List>
                  <Autocomplete.Item value="apple">apple</Autocomplete.Item>
                  <Autocomplete.Item value="banana">banana</Autocomplete.Item>
                  <Autocomplete.Item value="cherry">cherry</Autocomplete.Item>
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');

      await user.click(input);

      await waitFor(() => {
        expect(screen.getAllByRole('option')).toHaveLength(3);
      });

      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(input.value).toBe('apple');
      });

      await user.type(input, 'b');

      expect(input.value).toBe('appleb');
      expect(screen.getAllByRole('option')).toHaveLength(3);
    });

    it('mode="none": static items without inline overlay', async () => {
      const { user } = await render(
        <Autocomplete.Root mode="none" openOnInputClick>
          <Autocomplete.Input data-testid="input" />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List>
                  <Autocomplete.Item value="apple">apple</Autocomplete.Item>
                  <Autocomplete.Item value="banana">banana</Autocomplete.Item>
                  <Autocomplete.Item value="cherry">cherry</Autocomplete.Item>
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');

      await user.click(input);
      await user.keyboard('{ArrowDown}');

      expect(input.value).toBe('');
      expect(screen.getAllByRole('option')).toHaveLength(3);

      await user.type(input, 'x');
      await user.keyboard('{ArrowDown}');

      expect(input.value).toBe('x');
      expect(screen.getAllByRole('option')).toHaveLength(3);
    });
  });

  describe('prop: filter', () => {
    it('does not apply default filtering when filter is null', async () => {
      interface Movie {
        id: string;
        title: string;
        year: number;
      }

      const asyncResults: Movie[] = [
        { id: '1', title: 'Pulp Fiction', year: 1994 },
        { id: '2', title: 'The Godfather', year: 1972 },
        { id: '3', title: 'The Dark Knight', year: 2008 },
      ];

      const { user } = await render(
        <Autocomplete.Root
          items={asyncResults}
          filter={null}
          itemToStringValue={(movie: Movie) => movie.title}
        >
          <Autocomplete.Input data-testid="input" />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List>
                  {(movie: Movie) => (
                    <Autocomplete.Item key={movie.id} value={movie}>
                      {movie.title}
                    </Autocomplete.Item>
                  )}
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      const input = screen.getByTestId<HTMLInputElement>('input');
      await user.type(input, '1994');

      await waitFor(() => {
        expect(screen.getAllByRole('option')).toHaveLength(3);
      });
      expect(screen.getByRole('option', { name: 'Pulp Fiction' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'The Godfather' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'The Dark Knight' })).not.toBe(null);
    });
  });

  describe('prop: submitOnItemClick', () => {
    it('prevents submit on Enter when an item is highlighted by default (false)', async () => {
      let submitted = 0;

      const handleSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
        event.preventDefault();
        submitted += 1;
      };

      const { user } = await render(
        <form onSubmit={handleSubmit}>
          <Field.Root name="search">
            <Autocomplete.Root items={['apple', 'banana']} autoHighlight>
              <Autocomplete.Input />
              <Autocomplete.Portal>
                <Autocomplete.Positioner>
                  <Autocomplete.Popup>
                    <Autocomplete.List>
                      {(item) => (
                        <Autocomplete.Item key={item} value={item}>
                          {item}
                        </Autocomplete.Item>
                      )}
                    </Autocomplete.List>
                  </Autocomplete.Popup>
                </Autocomplete.Positioner>
              </Autocomplete.Portal>
            </Autocomplete.Root>
          </Field.Root>
        </form>,
      );

      const input = screen.getByRole('combobox');
      await user.click(screen.getByRole('combobox'));
      await user.type(input, 'a'); // open and highlight first
      await user.keyboard('{Enter}');

      expect(submitted).toBe(0);
    });

    it('when true, clicking with pointer submits the owning form', async () => {
      let submitValue: string | null = null;
      let submitCount = 0;

      const handleSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        submitValue = (data.get('q') as string) ?? null;
        submitCount += 1;
      };

      const { user } = await render(
        <form onSubmit={handleSubmit}>
          <Field.Root name="q">
            <Autocomplete.Root items={['alpha', 'alpine']} submitOnItemClick>
              <Autocomplete.Input />
              <Autocomplete.Portal>
                <Autocomplete.Positioner>
                  <Autocomplete.Popup>
                    <Autocomplete.List>
                      {(item) => (
                        <Autocomplete.Item key={item} value={item}>
                          {item}
                        </Autocomplete.Item>
                      )}
                    </Autocomplete.List>
                  </Autocomplete.Popup>
                </Autocomplete.Positioner>
              </Autocomplete.Portal>
            </Autocomplete.Root>
          </Field.Root>
        </form>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await user.type(input, 'al');

      const alphaButton = screen.getByRole('option', { name: 'alpha' });
      await user.click(alphaButton);

      expect(submitValue).toBe('alpha');
      expect(submitCount).toBe(1);
    });

    it('when true, pressing Enter in the Input submits the owning form when an item is highlighted', async () => {
      let submitValue: string | null = null;
      let submitCount = 0;

      const handleSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        submitValue = (data.get('q') as string) ?? null;
        submitCount += 1;
      };

      const { user } = await render(
        <form onSubmit={handleSubmit}>
          <Field.Root name="q">
            <Autocomplete.Root items={['alpha', 'alpine']} submitOnItemClick>
              <Autocomplete.Input />
              <Autocomplete.Portal>
                <Autocomplete.Positioner>
                  <Autocomplete.Popup>
                    <Autocomplete.List>
                      {(item) => (
                        <Autocomplete.Item key={item} value={item}>
                          {item}
                        </Autocomplete.Item>
                      )}
                    </Autocomplete.List>
                  </Autocomplete.Popup>
                </Autocomplete.Positioner>
              </Autocomplete.Portal>
            </Autocomplete.Root>
          </Field.Root>
        </form>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await user.type(input, 'al');
      await user.keyboard('{ArrowDown}');

      const alphaButton = screen.getByRole('option', { name: 'alpha' });
      expect(alphaButton).toHaveAttribute('data-highlighted');

      await user.keyboard('{Enter}');

      expect(submitValue).toBe('alpha');
      expect(submitCount).toBe(1);
    });

    it.skipIf(isJSDOM)(
      'when true, clicking with pointer submits an associated external form when `form` is provided',
      async () => {
        let submitValue: string | null = null;
        let submitCount = 0;

        const handleSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          submitValue = (data.get('q') as string) ?? null;
          submitCount += 1;
        };

        const { user } = await render(
          <React.Fragment>
            <form id="external-form" onSubmit={handleSubmit} />
            <Autocomplete.Root
              items={['alpha', 'alpine']}
              name="q"
              form="external-form"
              submitOnItemClick
            >
              <Autocomplete.Input />
              <Autocomplete.Portal>
                <Autocomplete.Positioner>
                  <Autocomplete.Popup>
                    <Autocomplete.List>
                      {(item) => (
                        <Autocomplete.Item key={item} value={item}>
                          {item}
                        </Autocomplete.Item>
                      )}
                    </Autocomplete.List>
                  </Autocomplete.Popup>
                </Autocomplete.Positioner>
              </Autocomplete.Portal>
            </Autocomplete.Root>
          </React.Fragment>,
        );

        const input = screen.getByRole<HTMLInputElement>('combobox');
        await user.type(input, 'al');
        await user.click(screen.getByRole('option', { name: 'alpha' }));

        expect(submitValue).toBe('alpha');
        expect(submitCount).toBe(1);
      },
    );

    it('focusing the listbox should keep the input focused and maintain functionality', async () => {
      let submitValue: string | null = null;
      let submitCount = 0;

      const handleSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        submitValue = (data.get('q') as string) ?? null;
        submitCount += 1;
      };

      const { user } = await render(
        <form onSubmit={handleSubmit}>
          <Field.Root name="q">
            <Autocomplete.Root items={['alpha', 'alpine']} submitOnItemClick>
              <Autocomplete.Input />
              <Autocomplete.Portal>
                <Autocomplete.Positioner>
                  <Autocomplete.Popup>
                    <Autocomplete.List data-testid="listbox">
                      {(item) => (
                        <Autocomplete.Item key={item} value={item}>
                          {item}
                        </Autocomplete.Item>
                      )}
                    </Autocomplete.List>
                  </Autocomplete.Popup>
                </Autocomplete.Positioner>
              </Autocomplete.Portal>
            </Autocomplete.Root>
          </Field.Root>
        </form>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await user.type(input, 'al');
      await user.keyboard('{ArrowDown}');

      const listbox = screen.getByRole('listbox');
      const alphaOption = screen.getByRole('option', { name: 'alpha' });
      await waitFor(() => {
        expect(alphaOption).toHaveAttribute('data-highlighted');
      });

      await act(() => {
        listbox.focus();
      });
      expect(input).toHaveFocus();

      await user.keyboard('{Enter}');

      expect(submitValue).toBe('alpha');
      expect(submitCount).toBe(1);
    });
  });

  describe('Form', () => {
    const { render: renderFakeTimers, clock } = createRenderer({
      clockOptions: {
        shouldAdvanceTime: true,
      },
    });

    clock.withFakeTimers();

    it('submits the typed input value when wrapped in Field.Root', async () => {
      let submitted: string | null = null;

      const handleSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        submitted = (data.get('search') as string) ?? null;
      };

      const { user } = await render(
        <Form onSubmit={handleSubmit}>
          <Field.Root name="search">
            <Autocomplete.Root>
              <Autocomplete.Input data-testid="input" />
            </Autocomplete.Root>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      const input = screen.getByTestId('input');
      await user.type(input, 'hello world');
      await user.click(screen.getByText('Submit'));

      expect(submitted).toBe('hello world');
    });

    it('submits the typed input value when name is provided on Autocomplete.Root', async () => {
      let submitted: FormDataEntryValue | null = null;

      const handleSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        submitted = data.get('query');
      };

      const { user } = await render(
        <Form onSubmit={handleSubmit}>
          <Field.Root name="query">
            <Autocomplete.Root>
              <Autocomplete.Input data-testid="input" />
              <Autocomplete.Portal>
                <Autocomplete.Positioner>
                  <Autocomplete.Popup>
                    <Autocomplete.List>
                      <Autocomplete.Item value="base-ui">base-ui</Autocomplete.Item>
                    </Autocomplete.List>
                  </Autocomplete.Popup>
                </Autocomplete.Positioner>
              </Autocomplete.Portal>
            </Autocomplete.Root>
          </Field.Root>
          <button type="submit" data-testid="submit-btn">
            Submit
          </button>
        </Form>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await user.type(input, 'base ui');

      expect(input.getAttribute('name'), 'input should have name attribute').toBe('query');
      expect(input.value, 'input should have typed value').toBe('base ui');

      await user.click(screen.getByText('Submit'));

      expect(submitted).toBe('base ui');
    });

    it('submits the popup input value through native FormData when rendering a field-aware input', async () => {
      let submitted: FormDataEntryValue | null = null;

      const handleSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        submitted = data.get('search');
      };

      const { user } = await render(
        <Form onSubmit={handleSubmit}>
          <Field.Root name="search">
            <Autocomplete.Root items={['alpha', 'alpine']}>
              <Autocomplete.Trigger>
                <Autocomplete.Value />
              </Autocomplete.Trigger>
              <Autocomplete.Portal>
                <Autocomplete.Positioner>
                  <Autocomplete.Popup>
                    <Autocomplete.Input render={<Input data-testid="input" />} />
                    <Autocomplete.List>
                      {(item) => (
                        <Autocomplete.Item key={item} value={item}>
                          {item}
                        </Autocomplete.Item>
                      )}
                    </Autocomplete.List>
                  </Autocomplete.Popup>
                </Autocomplete.Positioner>
              </Autocomplete.Portal>
            </Autocomplete.Root>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      await user.click(screen.getByRole('combobox'));
      const input = await screen.findByTestId('input');
      expect(input).not.toHaveAttribute('name');

      await user.click(screen.getByRole('option', { name: 'alpha' }));

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toHaveTextContent('alpha');
      });

      await user.click(screen.getByText('Submit'));

      expect(submitted).toBe('alpha');
    });

    it('submits the inline input value through native FormData', async () => {
      let submitted: FormDataEntryValue | null = null;

      const handleSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        submitted = data.get('search');
      };

      const { user } = await render(
        <Form onSubmit={handleSubmit}>
          <Field.Root name="search">
            <Autocomplete.Root items={['alpha', 'alpine']} inline>
              <Autocomplete.Input data-testid="input" />
              <Autocomplete.List>
                {(item) => (
                  <Autocomplete.Item key={item} value={item}>
                    {item}
                  </Autocomplete.Item>
                )}
              </Autocomplete.List>
            </Autocomplete.Root>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('name', 'search');

      const hiddenInput = screen.getByRole('textbox', { hidden: true });
      expect(hiddenInput).not.toHaveAttribute('name');

      await user.type(input, 'alp');
      await user.click(screen.getByText('Submit'));

      expect(submitted).toBe('alp');
    });

    it('server-renders only the inline input name for native FormData', () => {
      renderToString(
        <Form>
          <Field.Root name="search">
            <Autocomplete.Root items={['alpha', 'alpine']} inline>
              <Autocomplete.Input data-testid="input" />
              <Autocomplete.List>
                {(item) => (
                  <Autocomplete.Item key={item} value={item}>
                    {item}
                  </Autocomplete.Item>
                )}
              </Autocomplete.List>
            </Autocomplete.Root>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      const namedInputs = screen
        .getAllByDisplayValue('')
        .filter((element) => element.getAttribute('name') === 'search');
      expect(namedInputs).toHaveLength(1);
      expect(screen.getByTestId('input')).toHaveAttribute('name', 'search');
    });

    it('server-renders only the outside-popup input name for native FormData', () => {
      renderToString(
        <Form>
          <Field.Root name="search">
            <Autocomplete.Root items={['alpha', 'alpine']}>
              <Autocomplete.InputGroup>
                <Autocomplete.Input data-testid="input" />
                <Autocomplete.Trigger>Open</Autocomplete.Trigger>
              </Autocomplete.InputGroup>
              <Autocomplete.Portal>
                <Autocomplete.Positioner>
                  <Autocomplete.Popup>
                    <Autocomplete.List>
                      {(item) => (
                        <Autocomplete.Item key={item} value={item}>
                          {item}
                        </Autocomplete.Item>
                      )}
                    </Autocomplete.List>
                  </Autocomplete.Popup>
                </Autocomplete.Positioner>
              </Autocomplete.Portal>
            </Autocomplete.Root>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      const namedInputs = screen
        .getAllByDisplayValue('')
        .filter((element) => element.getAttribute('name') === 'search');
      expect(namedInputs).toHaveLength(1);
      expect(screen.getByTestId('input')).toHaveAttribute('name', 'search');
    });

    it('submits a default popup input value through native FormData before the popup opens', async () => {
      let submitted: FormDataEntryValue | null = null;

      const handleSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        submitted = data.get('search');
      };

      const { user } = await render(
        <Form onSubmit={handleSubmit}>
          <Field.Root name="search">
            <Autocomplete.Root items={['alpha', 'alpine']} defaultValue="alpha">
              <Autocomplete.Trigger>
                <Autocomplete.Value />
              </Autocomplete.Trigger>
              <Autocomplete.Portal>
                <Autocomplete.Positioner>
                  <Autocomplete.Popup>
                    <Autocomplete.Input render={<Input data-testid="input" />} />
                    <Autocomplete.List>
                      {(item) => (
                        <Autocomplete.Item key={item} value={item}>
                          {item}
                        </Autocomplete.Item>
                      )}
                    </Autocomplete.List>
                  </Autocomplete.Popup>
                </Autocomplete.Positioner>
              </Autocomplete.Portal>
            </Autocomplete.Root>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      await user.click(screen.getByText('Submit'));

      expect(submitted).toBe('alpha');
    });

    it('server-renders the default popup input value without a form name before hydration', () => {
      renderToString(
        <Form>
          <Field.Root name="search">
            <Autocomplete.Root items={['alpha', 'alpine']} defaultValue="alpha">
              <Autocomplete.Trigger>
                <Autocomplete.Value />
              </Autocomplete.Trigger>
              <Autocomplete.Portal>
                <Autocomplete.Positioner>
                  <Autocomplete.Popup>
                    <Autocomplete.Input render={<Input data-testid="input" />} />
                    <Autocomplete.List>
                      {(item) => (
                        <Autocomplete.Item key={item} value={item}>
                          {item}
                        </Autocomplete.Item>
                      )}
                    </Autocomplete.List>
                  </Autocomplete.Popup>
                </Autocomplete.Positioner>
              </Autocomplete.Portal>
            </Autocomplete.Root>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      const namedInputs = screen
        .getAllByDisplayValue('alpha')
        .filter((element) => element.getAttribute('name') === 'search');
      expect(namedInputs).toHaveLength(0);
      expect(screen.queryByTestId('input')).toBe(null);
    });

    it.skipIf(isJSDOM)('submits to an external form when `form` is provided', async () => {
      let submitted: FormDataEntryValue | null = null;

      const handleSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        submitted = data.get('query');
      };

      const { user } = await render(
        <React.Fragment>
          <form id="external-form" onSubmit={handleSubmit}>
            <button type="submit">Submit</button>
          </form>
          <Autocomplete.Root name="query" form="external-form">
            <Autocomplete.Input data-testid="input" />
          </Autocomplete.Root>
        </React.Fragment>,
      );

      await user.type(screen.getByTestId('input'), 'base ui');
      await user.click(screen.getByText('Submit'));

      expect(submitted).toBe('base ui');
    });

    it('triggers native validation when required and empty', async () => {
      const { user } = await render(
        <Form>
          <Field.Root name="auto" data-testid="field">
            <Autocomplete.Root required>
              <Autocomplete.Input data-testid="input" />
            </Autocomplete.Root>
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      expect(screen.queryByTestId('error')).toBe(null);

      await user.click(screen.getByText('Submit'));

      const error = screen.getByTestId('error');
      expect(error).toHaveTextContent('required');
    });

    it('clears external errors on change', async () => {
      const { user } = await renderFakeTimers(
        <Form
          errors={{
            autocomplete: 'test',
          }}
        >
          <Field.Root name="autocomplete">
            <Autocomplete.Root>
              <Autocomplete.Input data-testid="input" />
              <Autocomplete.Portal>
                <Autocomplete.Positioner>
                  <Autocomplete.Popup>
                    <Autocomplete.List>
                      <Autocomplete.Item value="a">a</Autocomplete.Item>
                      <Autocomplete.Item value="b">b</Autocomplete.Item>
                    </Autocomplete.List>
                  </Autocomplete.Popup>
                </Autocomplete.Positioner>
              </Autocomplete.Portal>
            </Autocomplete.Root>
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>,
      );

      expect(screen.getByTestId('error')).toHaveTextContent('test');

      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('aria-invalid', 'true');

      await user.type(input, 'test input');
      await flushMicrotasks();

      expect(screen.queryByTestId('error')).toBe(null);
      expect(input).not.toHaveAttribute('aria-invalid');
    });

    it('submits the input value directly (not selection value)', async () => {
      let submitted: string | null = null;

      const handleSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        submitted = data.get('search') as string;
      };

      const { user } = await render(
        <Form onSubmit={handleSubmit}>
          <Field.Root name="search">
            <Autocomplete.Root>
              <Autocomplete.Input data-testid="input" />
              <Autocomplete.Portal>
                <Autocomplete.Positioner>
                  <Autocomplete.Popup>
                    <Autocomplete.List>
                      <Autocomplete.Item value="apple">apple</Autocomplete.Item>
                      <Autocomplete.Item value="banana">banana</Autocomplete.Item>
                    </Autocomplete.List>
                  </Autocomplete.Popup>
                </Autocomplete.Positioner>
              </Autocomplete.Portal>
            </Autocomplete.Root>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      const input = screen.getByTestId('input');
      // Type something that doesn't exactly match any option
      await user.type(input, 'appl');
      await user.click(screen.getByText('Submit'));

      expect(submitted).toBe('appl');
    });

    it('Enter submits when no item is highlighted', async () => {
      let submitted = 0;

      const handleSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
        event.preventDefault();
        submitted += 1;
      };

      const { user } = await render(
        <Form onSubmit={handleSubmit}>
          <Field.Root name="search">
            <Autocomplete.Root items={['alpha', 'beta']} openOnInputClick>
              <Autocomplete.Input />
              <Autocomplete.Portal>
                <Autocomplete.Positioner>
                  <Autocomplete.Popup>
                    <Autocomplete.List>
                      {(item) => (
                        <Autocomplete.Item key={item} value={item}>
                          {item}
                        </Autocomplete.Item>
                      )}
                    </Autocomplete.List>
                  </Autocomplete.Popup>
                </Autocomplete.Positioner>
              </Autocomplete.Portal>
            </Autocomplete.Root>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      await user.click(screen.getByRole('combobox'));
      await user.keyboard('{Enter}');

      expect(submitted).toBe(1);
    });

    it('pressing Enter in the Input submits the owning form when no item is highlighted', async () => {
      let submitValue: string | null = null;
      let submitCount = 0;

      const handleSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        submitValue = (data.get('q') as string) ?? null;
        submitCount += 1;
      };

      const { user } = await render(
        <Form onSubmit={handleSubmit}>
          <Field.Root name="q">
            <Autocomplete.Root items={['alpha', 'alpine']} submitOnItemClick>
              <Autocomplete.Input />
              <Autocomplete.Portal>
                <Autocomplete.Positioner>
                  <Autocomplete.Popup>
                    <Autocomplete.List>
                      {(item) => (
                        <Autocomplete.Item key={item} value={item}>
                          {item}
                        </Autocomplete.Item>
                      )}
                    </Autocomplete.List>
                  </Autocomplete.Popup>
                </Autocomplete.Positioner>
              </Autocomplete.Portal>
            </Autocomplete.Root>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');

      await user.type(input, 'xyz');
      await user.keyboard('{Enter}');

      expect(submitValue).toBe('xyz');
      expect(submitCount).toBe(1);
    });

    it('pressing Enter in the List when it has focus submits the owning form', async () => {
      let submitValue: string | null = null;
      let submitCount = 0;

      const handleSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        submitValue = (data.get('q') as string) ?? null;
        submitCount += 1;
      };

      const { user } = await render(
        <Form onSubmit={handleSubmit}>
          <Field.Root name="q">
            <Autocomplete.Root items={['alpha', 'alpine']} submitOnItemClick>
              <Autocomplete.Input />
              <Autocomplete.Portal>
                <Autocomplete.Positioner>
                  <Autocomplete.Popup>
                    <Autocomplete.List>
                      {(item) => (
                        <Autocomplete.Item key={item} value={item}>
                          {item}
                        </Autocomplete.Item>
                      )}
                    </Autocomplete.List>
                  </Autocomplete.Popup>
                </Autocomplete.Positioner>
              </Autocomplete.Portal>
            </Autocomplete.Root>
          </Field.Root>
        </Form>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await user.type(input, 'al');
      await user.keyboard('{ArrowDown}');

      const alphaButton = screen.getByRole('option', { name: 'alpha' });
      expect(alphaButton).toHaveAttribute('data-highlighted');

      const list = screen.getByRole('listbox');
      act(() => {
        list.focus();
      });

      await user.keyboard('{Enter}');

      expect(submitValue).toBe('alpha');
      expect(submitCount).toBe(1);
    });
  });

  describe('object item stringification', () => {
    it('filters and displays using label for {label} objects', async () => {
      const items = [{ label: 'United States' }, { label: 'Canada' }, { label: 'Australia' }];

      const { user } = await render(
        <Autocomplete.Root items={items}>
          <Autocomplete.Input data-testid="input" />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List>
                  {(item: { label: string }) => (
                    <Autocomplete.Item key={item.label} value={item}>
                      {item.label}
                    </Autocomplete.Item>
                  )}
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      const input = screen.getByTestId('input');
      await user.click(input);
      await user.type(input, 'can');

      // Should match the item by its label, not its value
      await waitFor(() => {
        expect(screen.getAllByRole('option')).toHaveLength(1);
      });
      expect(screen.getByRole('option', { name: 'Canada' })).not.toBe(null);
    });

    it('uses itemToStringValue when object lacks label', async () => {
      const items = [{ country: 'United States' }, { country: 'Canada' }, { country: 'Australia' }];

      const { user } = await render(
        <Autocomplete.Root items={items} itemToStringValue={(i) => i.country}>
          <Autocomplete.Input data-testid="input" />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List>
                  {(item: { country: string }) => (
                    <Autocomplete.Item key={item.country} value={item}>
                      {item.country}
                    </Autocomplete.Item>
                  )}
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      const input = screen.getByTestId('input');
      await user.click(input);
      await user.type(input, 'can');

      // Should match by the provided itemToStringValue mapping
      await waitFor(() => {
        expect(screen.getAllByRole('option')).toHaveLength(1);
      });
      expect(screen.getByRole('option', { name: 'Canada' })).not.toBe(null);
    });

    it('filters and displays using value for {value} objects', async () => {
      const items = [{ value: 'United States' }, { value: 'Canada' }, { value: 'Australia' }];

      const { user } = await render(
        <Autocomplete.Root items={items}>
          <Autocomplete.Input data-testid="input" />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List>
                  {(item: { value: string }) => (
                    <Autocomplete.Item key={item.value} value={item}>
                      {item.value}
                    </Autocomplete.Item>
                  )}
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>,
      );

      const input = screen.getByTestId('input');
      await user.type(input, 'can');

      await waitFor(() => {
        expect(screen.getAllByRole('option')).toHaveLength(1);
      });
      expect(screen.getByRole('option', { name: 'Canada' })).not.toBe(null);
    });
  });

  describe('Field', () => {
    const { render: renderFakeTimers, clock } = createRenderer({
      clockOptions: {
        shouldAdvanceTime: true,
      },
    });

    clock.withFakeTimers();

    it('sets `required` on the visible input', async () => {
      await render(
        <Field.Root>
          <Autocomplete.Root required>
            <Autocomplete.Input data-testid="input" />
            <Autocomplete.Portal>
              <Autocomplete.Positioner />
            </Autocomplete.Portal>
          </Autocomplete.Root>
        </Field.Root>,
      );

      expect(screen.getByTestId('input')).toHaveAttribute('required');
    });

    it('[data-touched]', async () => {
      await render(
        <Field.Root>
          <Autocomplete.Root>
            <Autocomplete.Input data-testid="input" />
            <Autocomplete.Portal>
              <Autocomplete.Positioner>
                <Autocomplete.Popup>
                  <Autocomplete.List>
                    <Autocomplete.Item value="">Select</Autocomplete.Item>
                    <Autocomplete.Item value="1">Option 1</Autocomplete.Item>
                  </Autocomplete.List>
                </Autocomplete.Popup>
              </Autocomplete.Positioner>
            </Autocomplete.Portal>
          </Autocomplete.Root>
        </Field.Root>,
      );

      const input = screen.getByTestId('input');

      expect(input).not.toHaveAttribute('data-touched');

      fireEvent.focus(input);
      fireEvent.blur(input);

      await flushMicrotasks();

      expect(input).toHaveAttribute('data-touched', '');
    });

    it('[data-dirty]', async () => {
      const { user } = await renderFakeTimers(
        <Field.Root>
          <Autocomplete.Root>
            <Autocomplete.Input data-testid="input" />
            <Autocomplete.Portal>
              <Autocomplete.Positioner>
                <Autocomplete.Popup>
                  <Autocomplete.List>
                    <Autocomplete.Item value="">Select</Autocomplete.Item>
                    <Autocomplete.Item value="1">Option 1</Autocomplete.Item>
                  </Autocomplete.List>
                </Autocomplete.Popup>
              </Autocomplete.Positioner>
            </Autocomplete.Portal>
          </Autocomplete.Root>
        </Field.Root>,
      );

      const input = screen.getByTestId('input');

      expect(input).not.toHaveAttribute('data-dirty');

      await user.type(input, 'test');
      await flushMicrotasks();

      expect(input).toHaveAttribute('data-dirty', '');
    });

    describe('[data-filled]', () => {
      it('adds [data-filled] attribute when input has content', async () => {
        const { user } = await renderFakeTimers(
          <Field.Root>
            <Autocomplete.Root>
              <Autocomplete.Input data-testid="input" />
              <Autocomplete.Portal>
                <Autocomplete.Positioner>
                  <Autocomplete.Popup>
                    <Autocomplete.List>
                      <Autocomplete.Item value="">Select</Autocomplete.Item>
                      <Autocomplete.Item value="1">Option 1</Autocomplete.Item>
                    </Autocomplete.List>
                  </Autocomplete.Popup>
                </Autocomplete.Positioner>
              </Autocomplete.Portal>
            </Autocomplete.Root>
          </Field.Root>,
        );

        const input = screen.getByTestId('input');

        expect(input).not.toHaveAttribute('data-filled');

        await user.type(input, 'test input');
        await flushMicrotasks();

        expect(input).toHaveAttribute('data-filled', '');
      });

      it('adds [data-filled] attribute when already filled with defaultValue', async () => {
        await render(
          <Field.Root>
            <Autocomplete.Root defaultValue="initial value">
              <Autocomplete.Input data-testid="input" />
              <Autocomplete.Portal>
                <Autocomplete.Positioner>
                  <Autocomplete.Popup>
                    <Autocomplete.List>
                      <Autocomplete.Item value="1">Option 1</Autocomplete.Item>
                    </Autocomplete.List>
                  </Autocomplete.Popup>
                </Autocomplete.Positioner>
              </Autocomplete.Portal>
            </Autocomplete.Root>
          </Field.Root>,
        );

        const input = screen.getByTestId('input');

        expect(input).toHaveAttribute('data-filled');
      });
    });

    it('[data-focused]', async () => {
      await render(
        <Field.Root>
          <Autocomplete.Root>
            <Autocomplete.Input data-testid="input" />
            <Autocomplete.Portal>
              <Autocomplete.Positioner>
                <Autocomplete.Popup>
                  <Autocomplete.List>
                    <Autocomplete.Item value="">Select</Autocomplete.Item>
                    <Autocomplete.Item value="1">Option 1</Autocomplete.Item>
                  </Autocomplete.List>
                </Autocomplete.Popup>
              </Autocomplete.Positioner>
            </Autocomplete.Portal>
          </Autocomplete.Root>
        </Field.Root>,
      );

      const input = screen.getByTestId('input');

      expect(input).not.toHaveAttribute('data-focused');

      fireEvent.focus(input);

      expect(input).toHaveAttribute('data-focused', '');

      fireEvent.blur(input);

      expect(input).not.toHaveAttribute('data-focused');
    });

    it('[data-invalid]', async () => {
      await render(
        <Field.Root invalid>
          <Autocomplete.Root>
            <Autocomplete.Input data-testid="input" />
            <Autocomplete.Portal>
              <Autocomplete.Positioner>
                <Autocomplete.Popup>
                  <Autocomplete.List>
                    <Autocomplete.Item value="1">Option 1</Autocomplete.Item>
                  </Autocomplete.List>
                </Autocomplete.Popup>
              </Autocomplete.Positioner>
            </Autocomplete.Portal>
          </Autocomplete.Root>
        </Field.Root>,
      );

      const input = screen.getByTestId('input');

      expect(input).toHaveAttribute('data-invalid', '');
    });

    it('[data-valid]', async () => {
      const { user } = await render(
        <Field.Root validationMode="onBlur">
          <Autocomplete.Root required>
            <Autocomplete.Input data-testid="input" />
            <Autocomplete.Portal>
              <Autocomplete.Positioner>
                <Autocomplete.Popup>
                  <Autocomplete.List>
                    <Autocomplete.Item value="1">Option 1</Autocomplete.Item>
                  </Autocomplete.List>
                </Autocomplete.Popup>
              </Autocomplete.Positioner>
            </Autocomplete.Portal>
          </Autocomplete.Root>
        </Field.Root>,
      );

      const input = screen.getByRole('combobox');
      expect(input).not.toHaveAttribute('data-valid');
      expect(input).not.toHaveAttribute('data-invalid');

      await user.type(input, 'ok');
      await act(async () => input.blur());
      await flushMicrotasks();

      expect(input).toHaveAttribute('data-valid', '');
      expect(input).not.toHaveAttribute('data-invalid');
    });

    it('prop: validate', async () => {
      await render(
        <Field.Root validationMode="onBlur" validate={() => 'error'}>
          <Autocomplete.Root>
            <Autocomplete.Input data-testid="input" />
            <Autocomplete.Portal>
              <Autocomplete.Positioner />
            </Autocomplete.Portal>
          </Autocomplete.Root>
        </Field.Root>,
      );

      const input = screen.getByTestId('input');
      expect(input).not.toHaveAttribute('aria-invalid');

      fireEvent.focus(input);
      fireEvent.blur(input);
      await flushMicrotasks();
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('prop: validationMode=onSubmit', async () => {
      const { user } = await render(
        <Form>
          <Field.Root
            validate={(value) => {
              return value === 'one' ? 'error' : null;
            }}
          >
            <Autocomplete.Root required>
              <Autocomplete.Input data-testid="input" />
              <Autocomplete.Portal>
                <Autocomplete.Positioner>
                  <Autocomplete.Popup>
                    <Autocomplete.List>
                      <Autocomplete.Item value="one">Option 1</Autocomplete.Item>
                      <Autocomplete.Item value="two">Option 2</Autocomplete.Item>
                    </Autocomplete.List>
                  </Autocomplete.Popup>
                </Autocomplete.Positioner>
              </Autocomplete.Portal>
            </Autocomplete.Root>
          </Field.Root>
          <button type="submit">submit</button>
        </Form>,
      );

      const input = screen.getByTestId('input');
      expect(input).not.toHaveAttribute('aria-invalid');

      await user.click(screen.getByText('submit'));
      expect(input).toHaveAttribute('aria-invalid', 'true');

      await user.type(input, 'two');
      expect(input).not.toHaveAttribute('aria-invalid');

      await user.clear(input);
      await user.type(input, 'one');
      expect(input).toHaveAttribute('aria-invalid', 'true');

      await user.clear(input);
      await user.type(input, 'three');
      expect(input).not.toHaveAttribute('aria-invalid');
    });

    // flaky in real browser
    it.skipIf(!isJSDOM)('prop: validationMode=onChange', async () => {
      const { user } = await render(
        <Field.Root
          validationMode="onChange"
          validate={(value) => {
            return value === 'invalid' ? 'error' : null;
          }}
        >
          <Autocomplete.Root>
            <Autocomplete.Input data-testid="input" />
            <Autocomplete.Portal>
              <Autocomplete.Positioner>
                <Autocomplete.Popup>
                  <Autocomplete.List>
                    <Autocomplete.Item value="valid">Valid Option</Autocomplete.Item>
                  </Autocomplete.List>
                </Autocomplete.Popup>
              </Autocomplete.Positioner>
            </Autocomplete.Portal>
          </Autocomplete.Root>
        </Field.Root>,
      );

      const input = screen.getByTestId('input');

      expect(input).not.toHaveAttribute('aria-invalid');

      await user.type(input, 'invalid');

      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    // flaky in real browser
    it.skipIf(!isJSDOM)('prop: validationMode=onBlur', async () => {
      const { user } = await render(
        <Field.Root
          validationMode="onBlur"
          validate={(value) => {
            return value === 'invalid' ? 'error' : null;
          }}
        >
          <Autocomplete.Root>
            <Autocomplete.Input data-testid="input" />
            <Autocomplete.Portal>
              <Autocomplete.Positioner>
                <Autocomplete.Popup>
                  <Autocomplete.List>
                    <Autocomplete.Item value="valid">Valid Option</Autocomplete.Item>
                  </Autocomplete.List>
                </Autocomplete.Popup>
              </Autocomplete.Positioner>
            </Autocomplete.Portal>
          </Autocomplete.Root>
          <Field.Error data-testid="error" />
        </Field.Root>,
      );

      const input = screen.getByTestId('input');

      expect(input).not.toHaveAttribute('aria-invalid');

      await user.type(input, 'invalid');

      fireEvent.blur(input);

      await waitFor(() => {
        expect(input).toHaveAttribute('aria-invalid', 'true');
      });
    });

    it('Field.Label', async () => {
      await render(
        <Field.Root>
          <Autocomplete.Root>
            <Autocomplete.Input data-testid="input" />
            <Autocomplete.Portal>
              <Autocomplete.Positioner />
            </Autocomplete.Portal>
          </Autocomplete.Root>
          <Field.Label data-testid="label" render={<span />} nativeLabel={false} />
        </Field.Root>,
      );

      expect(screen.getByTestId('input')).toHaveAttribute(
        'aria-labelledby',
        screen.getByTestId('label').id,
      );
    });

    it('Field.Description', async () => {
      await render(
        <Field.Root>
          <Autocomplete.Root>
            <Autocomplete.Input data-testid="input" />
            <Autocomplete.Portal>
              <Autocomplete.Positioner />
            </Autocomplete.Portal>
          </Autocomplete.Root>
          <Field.Description data-testid="description" />
        </Field.Root>,
      );

      expect(screen.getByTestId('input')).toHaveAttribute(
        'aria-describedby',
        screen.getByTestId('description').id,
      );
    });
  });
});
