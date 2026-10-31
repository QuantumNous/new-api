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
import styles from './ComplexGrid.module.css';
import { gridNavigationWithColumns } from './gridNavigationWithColumns';

const grid = gridNavigationWithColumns(7);

interface Props {
  orientation?: 'horizontal' | 'both';
  loopFocus?: boolean;
  rtl?: boolean;
}

/*
 * Grid diagram for reference:
 * Disabled indices marked with ()
 */

/** @internal */
export function Main({ orientation = 'horizontal', loopFocus = false, rtl = false }: Props) {
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);

  const listRef = React.useRef<Array<HTMLElement | null>>([]);

  const { floatingStyles, refs, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: 'bottom-start',
  });

  const disabledIndices = [0, 1, 2, 3, 4, 5, 6, 9, 14, 23, 35];

  const { getReferenceProps, getFloatingProps, getItemProps } = useTestInteractions([
    useClick(context),
    useListNavigation(context, {
      listRef,
      activeIndex,
      onNavigate: setActiveIndex,
      orientation,
      loopFocus,
      rtl,
      openOnArrowKeyDown: false,
      disabledIndices,
      grid,
    }),
    useDismiss(context),
  ]);

  return (
    <React.Fragment>
      <h1>Complex Grid</h1>
      <div className={styles.Container}>
        <button ref={refs.setReference} type="button" {...getReferenceProps()}>
          Reference
        </button>
        {open && (
          <FloatingFocusManager context={context}>
            <div
              ref={refs.setFloating}
              data-testid="floating"
              className={styles.Grid}
              style={{
                ...floatingStyles,
                display: 'grid',
                gridTemplateColumns: '100px 100px 100px 100px 100px 100px 100px',
                zIndex: 999,
              }}
              {...getFloatingProps()}
            >
              {[...Array(37)].map((_, index) => (
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
