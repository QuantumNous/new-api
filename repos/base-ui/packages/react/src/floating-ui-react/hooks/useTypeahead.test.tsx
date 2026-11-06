import { vi, expect } from 'vitest';
import * as React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useTestInteractions } from '#test-utils';
import { useClick, useFloating, useTypeahead } from '../index';
import type { UseTypeaheadProps } from './useTypeahead';

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

const useImpl = ({
  addUseClick = false,
  ...props
}: Pick<UseTypeaheadProps, 'onMatch' | 'onTyping'> & {
  list?: Array<string>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  addUseClick?: boolean;
}) => {
  const [open, setOpen] = React.useState(true);
  const [activeIndex, setActiveIndex] = React.useState<null | number>(null);
  const { refs, context } = useFloating({
    open: props.open ?? open,
    onOpenChange: props.onOpenChange ?? setOpen,
  });
  const listRef = React.useRef(props.list ?? ['one', 'two', 'three']);
  const typeahead = useTypeahead(context, {
    listRef,
    activeIndex,
    onMatch(index) {
      setActiveIndex(index);
      props.onMatch?.(index);
    },
    onTyping: props.onTyping,
  });
  const click = useClick(context, {
    enabled: addUseClick,
  });

  const { getReferenceProps, getFloatingProps } = useTestInteractions([typeahead, click]);

  return {
    activeIndex,
    open,
    getReferenceProps: (userProps?: React.HTMLProps<Element>) =>
      getReferenceProps({
        role: 'combobox',
        ...userProps,
        ref: refs.setReference,
      }),
    getFloatingProps: () =>
      getFloatingProps({
        role: 'listbox',
        ref: refs.setFloating,
      }),
  };
};

function Combobox(
  props: Pick<UseTypeaheadProps, 'onMatch' | 'onTyping'> & {
    list?: Array<string>;
  },
) {
  const { getReferenceProps, getFloatingProps } = useImpl(props);
  return (
    <React.Fragment>
      <input {...getReferenceProps()} />
      <div {...getFloatingProps()} />
    </React.Fragment>
  );
}

function ComboboxWithElementsRef(
  props: Pick<UseTypeaheadProps, 'onMatch'> & {
    list?: Array<string>;
    hiddenIndices?: Array<number>;
  },
) {
  const [activeIndex, setActiveIndex] = React.useState<null | number>(null);
  const [open, setOpen] = React.useState(true);
  const { refs, context } = useFloating({
    open,
    onOpenChange: setOpen,
  });
  const listRef = React.useRef(props.list ?? ['apple', 'apricot', 'banana']);
  const elementsRef = React.useRef<Array<HTMLElement | null>>([]);
  const typeahead = useTypeahead(context, {
    listRef,
    elementsRef,
    activeIndex,
    onMatch(index) {
      setActiveIndex(index);
      props.onMatch?.(index);
    },
  });

  const { getReferenceProps, getFloatingProps, getItemProps } = useTestInteractions([typeahead]);

  return (
    <React.Fragment>
      <input {...getReferenceProps({ role: 'combobox', ref: refs.setReference })} />
      {open && (
        <div {...getFloatingProps({ role: 'listbox', ref: refs.setFloating })}>
          {listRef.current.map((value, index) => (
            <div
              key={value}
              role="option"
              aria-selected={activeIndex === index}
              style={props.hiddenIndices?.includes(index) ? { display: 'none' } : undefined}
              {...getItemProps({
                ref(node) {
                  elementsRef.current[index] = node;
                },
              })}
            >
              {value}
            </div>
          ))}
        </div>
      )}
    </React.Fragment>
  );
}

describe('useTypeahead', () => {
  it('rapidly focuses list items when they start with the same letter', async () => {
    const spy = vi.fn();
    render(<Combobox onMatch={spy} />);

    await userEvent.click(screen.getByRole('combobox'));

    await userEvent.keyboard('t');
    expect(spy).toHaveBeenCalledWith(1);

    await userEvent.keyboard('t');
    expect(spy).toHaveBeenCalledWith(2);

    await userEvent.keyboard('t');
    expect(spy).toHaveBeenCalledWith(1);
  });

  it('bails out of rapid focus of first letter if the list contains a string that starts with two of the same letter', async () => {
    const spy = vi.fn();
    render(<Combobox onMatch={spy} list={['apple', 'aaron', 'apricot']} />);

    await userEvent.click(screen.getByRole('combobox'));

    await userEvent.keyboard('a');
    expect(spy).toHaveBeenCalledWith(0);

    await userEvent.keyboard('a');
    expect(spy).toHaveBeenCalledWith(0);
  });

  it('starts from the current activeIndex and correctly loops', async () => {
    const spy = vi.fn();
    render(<Combobox onMatch={spy} list={['Toy Story 2', 'Toy Story 3', 'Toy Story 4']} />);

    await userEvent.click(screen.getByRole('combobox'));

    await userEvent.keyboard('t');
    await userEvent.keyboard('o');
    await userEvent.keyboard('y');
    expect(spy).toHaveBeenCalledWith(0);

    spy.mockReset();

    await userEvent.keyboard('t');
    await userEvent.keyboard('o');
    await userEvent.keyboard('y');
    expect(spy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(750);

    await userEvent.keyboard('t');
    await userEvent.keyboard('o');
    await userEvent.keyboard('y');
    expect(spy).toHaveBeenCalledWith(1);

    vi.advanceTimersByTime(750);

    await userEvent.keyboard('t');
    await userEvent.keyboard('o');
    await userEvent.keyboard('y');
    expect(spy).toHaveBeenCalledWith(2);

    vi.advanceTimersByTime(750);

    await userEvent.keyboard('t');
    await userEvent.keyboard('o');
    await userEvent.keyboard('y');
    expect(spy).toHaveBeenCalledWith(0);
  });

  it('capslock characters continue to match', async () => {
    const spy = vi.fn();
    render(<Combobox onMatch={spy} />);

    await userEvent.click(screen.getByRole('combobox'));

    await userEvent.keyboard('{CapsLock}t');
    expect(spy).toHaveBeenCalledWith(1);
  });

  it('does not depend on locale-sensitive lowercasing', async () => {
    const toLocaleLowerCase = String.prototype.toLocaleLowerCase;
    const toLocaleLowerCaseSpy = vi
      .spyOn(String.prototype, 'toLocaleLowerCase')
      .mockImplementation(function lowerWithTurkishLocale(this: string) {
        return toLocaleLowerCase.call(this, 'tr');
      });

    try {
      const spy = vi.fn();
      render(<Combobox onMatch={spy} list={['Istanbul']} />);

      await userEvent.click(screen.getByRole('combobox'));

      await userEvent.keyboard('i');
      expect(spy).toHaveBeenCalledWith(0);
    } finally {
      toLocaleLowerCaseSpy.mockRestore();
    }
  });

  function App1(props: Pick<UseTypeaheadProps, 'onMatch'> & { list: Array<string> }) {
    const { getReferenceProps, getFloatingProps, activeIndex, open } = useImpl(props);
    const inputRef = React.useRef<HTMLInputElement | null>(null);

    return (
      <React.Fragment>
        <div
          {...getReferenceProps({
            onClick: () => inputRef.current?.focus(),
          })}
        >
          <input ref={inputRef} readOnly />
        </div>
        {open && (
          <div {...getFloatingProps()}>
            {props.list.map((value, i) => (
              <div
                key={value}
                role="option"
                tabIndex={i === activeIndex ? 0 : -1}
                aria-selected={i === activeIndex}
              >
                {value}
              </div>
            ))}
          </div>
        )}
      </React.Fragment>
    );
  }

  it('matches when focus is within reference', async () => {
    const spy = vi.fn();
    render(<App1 onMatch={spy} list={['one', 'two', 'three']} />);

    await userEvent.click(screen.getByRole('combobox'));

    await userEvent.keyboard('t');
    expect(spy).toHaveBeenCalledWith(1);
  });

  it('matches when focus is within floating', async () => {
    const spy = vi.fn();
    render(<App1 onMatch={spy} list={['one', 'two', 'three']} />);

    await userEvent.click(screen.getByRole('combobox'));

    await userEvent.keyboard('t');
    const option = await screen.findByRole('option', { selected: true });
    expect(option.textContent).toBe('two');
    option.focus();
    expect(option).toHaveFocus();

    await userEvent.keyboard('h');
    expect((await screen.findByRole('option', { selected: true })).textContent).toBe('three');
  });

  it('onTyping is called with typing activity', async () => {
    const spy = vi.fn();
    render(<Combobox onTyping={spy} list={['one', 'two', 'three']} />);

    act(() => screen.getByRole('combobox').focus());

    await userEvent.keyboard('t');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(true);

    vi.advanceTimersByTime(750);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenCalledWith(false);
  });

  it('skips hidden items when matching with elementsRef', async () => {
    const spy = vi.fn();
    render(<ComboboxWithElementsRef onMatch={spy} hiddenIndices={[0]} />);

    await userEvent.click(screen.getByRole('combobox'));

    await userEvent.keyboard('a');
    expect(spy).toHaveBeenCalledWith(1);
  });

  it('does not let hidden double-letter items block rapid cycling with elementsRef', async () => {
    const spy = vi.fn();
    render(
      <ComboboxWithElementsRef
        onMatch={spy}
        list={['aaron', 'apple', 'avocado']}
        hiddenIndices={[0]}
      />,
    );

    await userEvent.click(screen.getByRole('combobox'));

    await userEvent.keyboard('a');
    expect(spy).toHaveBeenLastCalledWith(1);

    await userEvent.keyboard('a');
    expect(spy).toHaveBeenLastCalledWith(2);
  });

  it('skips visibility:hidden items when matching with elementsRef', async () => {
    const spy = vi.fn();
    render(<ComboboxWithElementsRef onMatch={spy} />);

    const apple = screen.getByRole('option', { name: 'apple' });

    apple.style.visibility = 'hidden';

    await userEvent.click(screen.getByRole('combobox'));

    await userEvent.keyboard('a');
    expect(spy).toHaveBeenCalledWith(1);
  });
});
