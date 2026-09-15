'use client';
import * as React from 'react';
import { useTestInteractions } from '#test-utils';
import {
  FloatingFocusManager,
  useClick,
  useDismiss,
  useFloating,
  useListNavigation,
} from '../../src/floating-ui-react';
import styles from './Grid.module.css';
import { gridNavigationWithColumns } from './gridNavigationWithColumns';

const grid = gridNavigationWithColumns(5);

interface Props {
  orientation?: 'horizontal' | 'both';
  loopFocus?: boolean;
}

/** @internal */
export function Main({ orientation = 'horizontal', loopFocus = false }: Props) {
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);

  const listRef = React.useRef<Array<HTMLElement | null>>([]);

  const { floatingStyles, refs, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: 'bottom-start',
  });

  const disabledIndices = [0, 1, 2, 3, 4, 5, 6, 7, 10, 15, 45, 48];

  const { getReferenceProps, getFloatingProps, getItemProps } = useTestInteractions([
    useClick(context),
    useListNavigation(context, {
      listRef,
      activeIndex,
      onNavigate: setActiveIndex,
      orientation,
      loopFocus,
      openOnArrowKeyDown: false,
      disabledIndices,
      grid,
    }),
    useDismiss(context),
  ]);

  return (
    <React.Fragment>
      <h1>Grid</h1>
      <div className={styles.Container}>
        <button ref={refs.setReference} type="button" {...getReferenceProps()}>
          Reference
        </button>
        {open && (
          <FloatingFocusManager context={context}>
            <div
              role="menu"
              ref={refs.setFloating}
              data-testid="floating"
              className={styles.Grid}
              style={{
                ...floatingStyles,
                gridTemplateColumns: '100px 100px 100px 100px 100px',
                zIndex: 999,
              }}
              {...getFloatingProps()}
            >
              {[...Array(49)].map((_, index) => (
                <button
                  type="button"
                  role="option"
                  key={index}
                  aria-selected={activeIndex === index}
                  tabIndex={activeIndex === index ? 0 : -1}
                  disabled={disabledIndices.includes(index)}
                  ref={(node) => {
                    listRef.current[index] = node;
                  }}
                  className={styles.Item}
                  {...getItemProps()}
                >
                  Item {index}
                </button>
              ))}
            </div>
          </FloatingFocusManager>
        )}
      </div>
    </React.Fragment>
  );
}
