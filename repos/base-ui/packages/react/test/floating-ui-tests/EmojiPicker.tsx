'use client';
import * as React from 'react';
import c from 'clsx';
import { useId } from '@base-ui/utils/useId';
import { useTestInteractions } from '#test-utils';
import type { Placement } from '../../src/floating-ui-react/types';
import {
  arrow,
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  offset,
  useClick,
  useDismiss,
  useFloating,
  useListNavigation,
} from '../../src/floating-ui-react';
import { Button } from './Button';
import styles from './EmojiPicker.module.css';
import { gridNavigationWithColumns } from './gridNavigationWithColumns';

const grid = gridNavigationWithColumns(3);

const emojis = [
  {
    name: 'apple',
    emoji: '🍎',
  },
  {
    name: 'orange',
    emoji: '🍊',
  },
  {
    name: 'watermelon',
    emoji: '🍉',
  },
  {
    name: 'strawberry',
    emoji: '🍓',
  },
  {
    name: 'pear',
    emoji: '🍐',
  },
  {
    name: 'banana',
    emoji: '🍌',
  },
  {
    name: 'pineapple',
    emoji: '🍍',
  },
  {
    name: 'cherry',
    emoji: '🍒',
  },
  {
    name: 'peach',
    emoji: '🍑',
  },
];

type OptionProps = React.HTMLAttributes<HTMLButtonElement> & {
  name: string;
  active: boolean;
  selected: boolean;
  children: React.ReactNode;
};

/** @internal */
const Option = React.forwardRef<HTMLButtonElement, OptionProps>(function Option(
  { name, active, selected, children, ...props },
  ref,
) {
  const id = useId();
  return (
    <button
      {...props}
      ref={ref}
      id={id}
      role="option"
      className={c(styles.Option, {
        [styles.OptionSelected]: selected && !active,
        [styles.OptionActive]: active,
        [styles.OptionDisabled]: name === 'orange',
      })}
      aria-selected={selected}
      disabled={name === 'orange'}
      aria-label={name}
      tabIndex={-1}
      data-active={active ? '' : undefined}
      type="button"
    >
      {children}
    </button>
  );
});

/** @internal */
export function Main() {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [selectedEmoji, setSelectedEmoji] = React.useState<string | null>(null);
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);
  const [placement, setPlacement] = React.useState<Placement | null>(null);

  const arrowRef = React.useRef(null);

  const listRef = React.useRef<Array<HTMLElement | null>>([]);

  const noResultsId = useId();

  const {
    floatingStyles,
    refs,
    context,
    placement: resultantPlacement,
  } = useFloating({
    placement: placement ?? 'bottom-start',
    open,
    onOpenChange: setOpen,
    // We don't want flipping to occur while searching, as the floating element
    // will resize and cause disorientation.
    middleware: [
      offset(8),
      ...(placement ? [] : [flip()]),
      arrow({
        element: arrowRef,
        padding: 20,
      }),
    ],
    whileElementsMounted: autoUpdate,
  });

  // Handles opening the floating element via the Choose Emoji button.
  const menuRoleProps = React.useMemo(
    () => ({
      reference: {
        'aria-haspopup': 'menu' as const,
        'aria-expanded': open,
        'aria-controls': open ? context.floatingId : undefined,
      },
      floating: {
        id: context.floatingId,
        role: 'menu' as const,
      },
    }),
    [context.floatingId, open],
  );

  const { getReferenceProps, getFloatingProps } = useTestInteractions([
    useClick(context),
    useDismiss(context),
    menuRoleProps,
  ]);

  // Handles the list navigation where the reference is the inner input, not
  // the button that opens the floating element.
  const {
    getReferenceProps: getInputProps,
    getFloatingProps: getListFloatingProps,
    getItemProps,
  } = useTestInteractions([
    useListNavigation(context, {
      listRef,
      onNavigate: open ? setActiveIndex : undefined,
      activeIndex,
      orientation: 'horizontal',
      loopFocus: true,
      focusItemOnOpen: false,
      virtual: true,
      allowEscape: true,
      grid,
    }),
  ]);

  React.useEffect(() => {
    if (open) {
      setPlacement(resultantPlacement);
    } else {
      setSearch('');
      setActiveIndex(null);
      setPlacement(null);
    }
  }, [open, resultantPlacement]);

  const handleEmojiClick = () => {
    if (activeIndex !== null) {
      // eslint-disable-next-line
      setSelectedEmoji(filteredEmojis[activeIndex].emoji);
      setOpen(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleEmojiClick();
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setActiveIndex(null);
    setSearch(event.target.value);
  };

  const filteredEmojis = emojis.filter(({ name }) =>
    name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );

  return (
    <React.Fragment>
      <h1 className={styles.Heading}>Emoji Picker</h1>
      <div className={styles.Container}>
        <div className="text-center">
          <Button
            ref={refs.setReference}
            className={styles.Trigger}
            aria-label="Choose emoji"
            aria-describedby="emoji-label"
            data-open={open ? '' : undefined}
            {...getReferenceProps()}
          >
            ☻
          </Button>
          <br />
          {selectedEmoji && (
            <span id="emoji-label">
              <span
                style={{ fontSize: 30 }}
                aria-label={emojis.find(({ emoji }) => emoji === selectedEmoji)?.name}
              >
                {selectedEmoji}
              </span>{' '}
              selected
            </span>
          )}
          <FloatingPortal>
            {open && (
              <FloatingFocusManager context={context} modal={false}>
                <div
                  ref={refs.setFloating}
                  className={styles.Floating}
                  style={floatingStyles}
                  {...getFloatingProps(getListFloatingProps())}
                >
                  <span className={styles.Label}>Emoji Picker</span>
                  <input
                    className={styles.Input}
                    placeholder="Search emoji"
                    value={search}
                    aria-controls={filteredEmojis.length === 0 ? noResultsId : undefined}
                    {...getInputProps({
                      onChange: handleInputChange,
                      onKeyDown: handleKeyDown,
                    })}
                  />
                  {filteredEmojis.length === 0 && (
                    <p
                      key={search}
                      id={noResultsId}
                      role="region"
                      aria-atomic="true"
                      aria-live="assertive"
                    >
                      No results.
                    </p>
                  )}
                  {filteredEmojis.length > 0 && (
                    <div className={styles.Listbox} role="listbox">
                      {filteredEmojis.map(({ name, emoji }, index) => (
                        <Option
                          key={name}
                          name={name}
                          ref={(node) => {
                            listRef.current[index] = node;
                          }}
                          selected={selectedEmoji === emoji}
                          active={activeIndex === index}
                          {...getItemProps({
                            onClick: handleEmojiClick,
                          })}
                        >
                          {emoji}
                        </Option>
                      ))}
                    </div>
                  )}
                  <span
                    data-testid="emoji-picker-active-index"
                    data-active-index={activeIndex ?? ''}
                    style={{ display: 'none' }}
                  />
                </div>
              </FloatingFocusManager>
            )}
          </FloatingPortal>
        </div>
      </div>
    </React.Fragment>
  );
}
