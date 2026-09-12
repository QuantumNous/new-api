import { expect, vi } from 'vitest';
import * as React from 'react';
import { act, createRenderer, fireEvent, flushMicrotasks, screen } from '@mui/internal-test-utils';
import { isJSDOM } from '#test-utils';
import { DirectionProvider } from '../../../direction-provider';
import { CompositeItem } from '../item/CompositeItem';
import { CompositeRoot } from './CompositeRoot';
import { gridNavigation } from './gridNavigation';

const threeColsGrid = gridNavigation({ cols: 3 });

describe('Composite', () => {
  const { render } = createRenderer();
  const gridItems = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  function TestGridItems() {
    return (
      <React.Fragment>
        {gridItems.map((i) => (
          <CompositeItem key={i} data-testid={i}>
            {i}
          </CompositeItem>
        ))}
      </React.Fragment>
    );
  }

  describe('list', () => {
    it('does not add aria-orientation when orientation is set', async () => {
      const { container } = await render(
        <CompositeRoot orientation="horizontal">
          <CompositeItem>1</CompositeItem>
          <CompositeItem>2</CompositeItem>
        </CompositeRoot>,
      );

      expect(container.firstElementChild as HTMLElement).not.toHaveAttribute('aria-orientation');
    });

    it('controlled mode', async () => {
      function App() {
        const [highlightedIndex, setHighlightedIndex] = React.useState(0);
        return (
          <CompositeRoot
            highlightedIndex={highlightedIndex}
            onHighlightedIndexChange={setHighlightedIndex}
          >
            <CompositeItem data-testid="1">1</CompositeItem>
            <CompositeItem data-testid="2">2</CompositeItem>
            <CompositeItem data-testid="3">3</CompositeItem>
          </CompositeRoot>
        );
      }

      render(<App />);

      const item1 = screen.getByTestId('1');
      const item2 = screen.getByTestId('2');
      const item3 = screen.getByTestId('3');

      act(() => item1.focus());

      expect(item1).toHaveAttribute('tabindex', '0');

      fireEvent.keyDown(item1, { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(item2).toHaveAttribute('tabindex', '0');
      expect(item2).toHaveFocus();

      fireEvent.keyDown(item2, { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(item3).toHaveAttribute('tabindex', '0');
      expect(item3).toHaveFocus();

      fireEvent.keyDown(item3, { key: 'ArrowUp' });
      await flushMicrotasks();

      expect(item2).toHaveAttribute('tabindex', '0');
      expect(item2).toHaveFocus();

      fireEvent.keyDown(item2, { key: 'ArrowUp' });
      await flushMicrotasks();

      expect(item1).toHaveAttribute('tabindex', '0');
      expect(item1).toHaveFocus();
    });

    it('uncontrolled mode', async () => {
      render(
        <CompositeRoot>
          <CompositeItem data-testid="1">1</CompositeItem>
          <CompositeItem data-testid="2">2</CompositeItem>
          <CompositeItem data-testid="3">3</CompositeItem>
        </CompositeRoot>,
      );

      const item1 = screen.getByTestId('1');
      const item2 = screen.getByTestId('2');
      const item3 = screen.getByTestId('3');

      act(() => item1.focus());

      fireEvent.keyDown(item1, { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(item2).toHaveAttribute('tabindex', '0');
      expect(item2).toHaveFocus();

      fireEvent.keyDown(item2, { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(item3).toHaveAttribute('tabindex', '0');
      expect(item3).toHaveFocus();

      fireEvent.keyDown(item3, { key: 'ArrowUp' });
      await flushMicrotasks();

      expect(item2).toHaveAttribute('tabindex', '0');
      expect(item2).toHaveFocus();

      fireEvent.keyDown(item2, { key: 'ArrowUp' });
      await flushMicrotasks();

      expect(item1).toHaveAttribute('tabindex', '0');
      expect(item1).toHaveFocus();
    });

    it('keeps native input behavior when the native target differs from the synthetic target', async () => {
      render(
        <CompositeRoot orientation="horizontal">
          <CompositeItem data-testid="1">1</CompositeItem>
          <div data-testid="host" />
          <CompositeItem data-testid="2">2</CompositeItem>
        </CompositeRoot>,
      );

      const item1 = screen.getByTestId('1');
      const item2 = screen.getByTestId('2');
      const host = screen.getByTestId('host');
      const input = document.createElement('input');

      input.type = 'text';
      input.value = 'abcd';
      input.setSelectionRange(2, 2);

      const focusEvent = new FocusEvent('focusin', { bubbles: true });
      Object.defineProperty(focusEvent, 'composedPath', {
        configurable: true,
        value: () => [input, host],
      });

      fireEvent(host, focusEvent);

      // Focusing a native input within a composite selects the whole value so
      // the first arrow key returns control to the textbox before moving focus.
      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe(4);

      act(() => item1.focus());

      input.setSelectionRange(1, 1);

      const keyDownEvent = new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(keyDownEvent, 'composedPath', {
        configurable: true,
        value: () => [input, host],
      });

      fireEvent(host, keyDownEvent);
      await flushMicrotasks();

      expect(item1).toHaveFocus();
      expect(item2).not.toHaveFocus();
    });

    it.skipIf(isJSDOM)('updates the order of items', async () => {
      function App(props: { items: string[] }) {
        return (
          <CompositeRoot>
            {props.items.map((item) => (
              <CompositeItem key={item} data-testid={item}>
                {item}
              </CompositeItem>
            ))}
          </CompositeRoot>
        );
      }
      const { user, rerender } = render(<App items={['1', '2', '3']} />);
      rerender(<App items={['1', '3', '2']} />);

      const item1 = screen.getByTestId('1');
      const item3 = screen.getByTestId('3');

      act(() => item1.focus());
      await user.keyboard('{ArrowDown}');
      expect(item3).toHaveFocus();
    });

    describe('Home and End keys', () => {
      it('Home key moves focus to the first item', async () => {
        render(
          <CompositeRoot enableHomeAndEndKeys>
            <CompositeItem data-testid="1">1</CompositeItem>
            <CompositeItem data-testid="2">2</CompositeItem>
            <CompositeItem data-testid="3">3</CompositeItem>
          </CompositeRoot>,
        );

        const item1 = screen.getByTestId('1');
        const item3 = screen.getByTestId('3');

        act(() => item3.focus());

        fireEvent.keyDown(item3, { key: 'Home' });
        await flushMicrotasks();

        expect(item1).toHaveAttribute('tabindex', '0');
        expect(item1).toHaveFocus();
      });

      it('End key moves focus to the last item', async () => {
        render(
          <CompositeRoot enableHomeAndEndKeys>
            <CompositeItem data-testid="1">1</CompositeItem>
            <CompositeItem data-testid="2">2</CompositeItem>
            <CompositeItem data-testid="3">3</CompositeItem>
          </CompositeRoot>,
        );

        const item1 = screen.getByTestId('1');
        const item3 = screen.getByTestId('3');

        act(() => item1.focus());

        fireEvent.keyDown(item1, { key: 'End' });
        await flushMicrotasks();

        expect(item3).toHaveAttribute('tabindex', '0');
        expect(item3).toHaveFocus();
      });
    });

    it('calls onLoop and uses its return value', async () => {
      const onLoop = vi.fn(
        (
          _event: React.KeyboardEvent,
          _prevIndex: number,
          _nextIndex: number,
          _elementsRef: React.RefObject<Array<HTMLElement | null>>,
        ) => 1,
      );

      function App() {
        return (
          <CompositeRoot onLoop={onLoop}>
            <TestGridItems />
          </CompositeRoot>
        );
      }

      await render(<App />);

      act(() => screen.getByTestId('9').focus());

      fireEvent.keyDown(screen.getByTestId('9'), { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(onLoop).toHaveBeenCalledOnce();

      const [event, prevIndex, nextIndex, elementsRef] = onLoop.mock.calls[0]!;
      expect(event.key).toBe('ArrowDown');
      expect(prevIndex).toBe(8);
      expect(nextIndex).toBe(0);
      expect(elementsRef.current[8]).toBe(screen.getByTestId('9'));
      expect(screen.getByTestId('2')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('2')).toHaveFocus();
    });

    it('does not loop or call onLoop when loopFocus is disabled', async () => {
      const onLoop = vi.fn(
        (
          _event: React.KeyboardEvent,
          _prevIndex: number,
          nextIndex: number,
          _elementsRef: React.RefObject<Array<HTMLElement | null>>,
        ) => nextIndex,
      );

      await render(
        <CompositeRoot loopFocus={false} onLoop={onLoop}>
          <TestGridItems />
        </CompositeRoot>,
      );

      act(() => screen.getByTestId('9').focus());

      fireEvent.keyDown(screen.getByTestId('9'), { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(onLoop).not.toHaveBeenCalled();
      expect(screen.getByTestId('9')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('9')).toHaveFocus();
    });

    describe.skipIf(isJSDOM)('rtl', () => {
      it('horizontal orientation', async () => {
        render(
          <div dir="rtl">
            <DirectionProvider direction="rtl">
              <CompositeRoot orientation="horizontal">
                <CompositeItem data-testid="1">1</CompositeItem>
                <CompositeItem data-testid="2">2</CompositeItem>
                <CompositeItem data-testid="3">3</CompositeItem>
              </CompositeRoot>
            </DirectionProvider>
          </div>,
        );

        const item1 = screen.getByTestId('1');
        const item2 = screen.getByTestId('2');
        const item3 = screen.getByTestId('3');

        act(() => item1.focus());

        fireEvent.keyDown(item1, { key: 'ArrowDown' });
        await flushMicrotasks();

        fireEvent.keyDown(item1, { key: 'ArrowLeft' });
        await flushMicrotasks();

        expect(item2).toHaveAttribute('tabindex', '0');
        expect(item2).toHaveFocus();

        fireEvent.keyDown(item2, { key: 'ArrowLeft' });
        await flushMicrotasks();

        expect(item3).toHaveAttribute('tabindex', '0');
        expect(item3).toHaveFocus();

        fireEvent.keyDown(item3, { key: 'ArrowRight' });
        await flushMicrotasks();

        expect(item2).toHaveAttribute('tabindex', '0');
        expect(item2).toHaveFocus();

        fireEvent.keyDown(item2, { key: 'ArrowRight' });
        await flushMicrotasks();

        expect(item1).toHaveAttribute('tabindex', '0');
        expect(item1).toHaveFocus();

        // loop backward
        fireEvent.keyDown(item1, { key: 'ArrowRight' });
        await flushMicrotasks();

        expect(item3).toHaveAttribute('tabindex', '0');
        expect(item3).toHaveFocus();
      });

      it('both horizontal and vertical orientation', async () => {
        render(
          <div dir="rtl">
            <DirectionProvider direction="rtl">
              <CompositeRoot orientation="both">
                <CompositeItem data-testid="1">1</CompositeItem>
                <CompositeItem data-testid="2">2</CompositeItem>
                <CompositeItem data-testid="3">3</CompositeItem>
              </CompositeRoot>
            </DirectionProvider>
          </div>,
        );

        const item1 = screen.getByTestId('1');
        const item2 = screen.getByTestId('2');
        const item3 = screen.getByTestId('3');

        act(() => item1.focus());

        fireEvent.keyDown(item1, { key: 'ArrowLeft' });
        await flushMicrotasks();

        expect(item2).toHaveAttribute('tabindex', '0');
        expect(item2).toHaveFocus();

        fireEvent.keyDown(item2, { key: 'ArrowLeft' });
        await flushMicrotasks();

        expect(item3).toHaveAttribute('tabindex', '0');
        expect(item3).toHaveFocus();

        fireEvent.keyDown(item3, { key: 'ArrowRight' });
        await flushMicrotasks();

        expect(item2).toHaveAttribute('tabindex', '0');
        expect(item2).toHaveFocus();

        fireEvent.keyDown(item2, { key: 'ArrowRight' });
        await flushMicrotasks();

        expect(item1).toHaveAttribute('tabindex', '0');
        expect(item1).toHaveFocus();

        fireEvent.keyDown(item1, { key: 'ArrowDown' });
        await flushMicrotasks();

        expect(item2).toHaveAttribute('tabindex', '0');
        expect(item2).toHaveFocus();

        fireEvent.keyDown(item2, { key: 'ArrowDown' });
        await flushMicrotasks();

        expect(item3).toHaveAttribute('tabindex', '0');
        expect(item3).toHaveFocus();
      });
    });
  });

  describe('grid', () => {
    it('uniform 1x1 items', async () => {
      function App() {
        return (
          <CompositeRoot grid={threeColsGrid} enableHomeAndEndKeys>
            <TestGridItems />
          </CompositeRoot>
        );
      }

      await render(<App />);

      act(() => screen.getByTestId('1').focus());

      fireEvent.keyDown(screen.getByTestId('1'), { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(screen.getByTestId('4')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('4')).toHaveFocus();

      fireEvent.keyDown(screen.getByTestId('4'), { key: 'ArrowRight' });
      await flushMicrotasks();

      expect(screen.getByTestId('5')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('5')).toHaveFocus();

      fireEvent.keyDown(screen.getByTestId('5'), { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(screen.getByTestId('8')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('8')).toHaveFocus();

      fireEvent.keyDown(screen.getByTestId('8'), { key: 'ArrowLeft' });
      await flushMicrotasks();

      expect(screen.getByTestId('7')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('7')).toHaveFocus();

      fireEvent.keyDown(screen.getByTestId('7'), { key: 'ArrowUp' });
      await flushMicrotasks();

      expect(screen.getByTestId('4')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('4')).toHaveFocus();

      fireEvent.keyDown(screen.getByTestId('4'), { key: 'ArrowLeft' });
      await flushMicrotasks();

      expect(screen.getByTestId('6')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('6')).toHaveFocus();

      act(() => screen.getByTestId('9').focus());
      await flushMicrotasks();

      expect(screen.getByTestId('9')).toHaveAttribute('tabindex', '0');

      fireEvent.keyDown(screen.getByTestId('9'), { key: 'Home' });
      await flushMicrotasks();

      expect(screen.getByTestId('1')).toHaveAttribute('tabindex', '0');

      fireEvent.keyDown(screen.getByTestId('1'), { key: 'End' });
      await flushMicrotasks();

      expect(screen.getByTestId('9')).toHaveAttribute('tabindex', '0');
    });

    it('calls onLoop while navigating through grid cells', async () => {
      const onLoop = vi.fn(
        (
          _event: React.KeyboardEvent,
          _prevIndex: number,
          _nextIndex: number,
          _elementsRef: React.RefObject<Array<HTMLElement | null>>,
        ) => 4,
      );

      function App() {
        return (
          <CompositeRoot grid={threeColsGrid} onLoop={onLoop}>
            <TestGridItems />
          </CompositeRoot>
        );
      }

      await render(<App />);

      act(() => screen.getByTestId('6').focus());

      fireEvent.keyDown(screen.getByTestId('6'), { key: 'ArrowRight' });
      await flushMicrotasks();

      expect(onLoop).toHaveBeenCalledOnce();

      const [event, prevIndex, nextIndex, elementsRef] = onLoop.mock.calls[0]!;
      expect(event.key).toBe('ArrowRight');
      expect(prevIndex).toBe(5);
      expect(nextIndex).toBe(3);
      expect(elementsRef.current[5]).toBe(screen.getByTestId('6'));
      expect(screen.getByTestId('5')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('5')).toHaveFocus();
    });

    it('calls onLoop when looping vertically between rows', async () => {
      const onLoop = vi.fn(
        (
          _event: React.KeyboardEvent,
          _prevIndex: number,
          nextIndex: number,
          _elementsRef: React.RefObject<Array<HTMLElement | null>>,
        ) => nextIndex,
      );

      await render(
        <CompositeRoot grid={threeColsGrid} onLoop={onLoop}>
          <TestGridItems />
        </CompositeRoot>,
      );

      act(() => screen.getByTestId('9').focus());

      fireEvent.keyDown(screen.getByTestId('9'), { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(onLoop).toHaveBeenCalledTimes(1);

      const [downEvent, downPrevIndex, downNextIndex] = onLoop.mock.calls[0]!;
      expect(downEvent.key).toBe('ArrowDown');
      expect(downPrevIndex).toBe(8);
      expect(downNextIndex).toBe(2);
      expect(screen.getByTestId('3')).toHaveFocus();

      fireEvent.keyDown(screen.getByTestId('3'), { key: 'ArrowUp' });
      await flushMicrotasks();

      expect(onLoop).toHaveBeenCalledTimes(2);

      const [upEvent, upPrevIndex, upNextIndex] = onLoop.mock.calls[1]!;
      expect(upEvent.key).toBe('ArrowUp');
      expect(upPrevIndex).toBe(2);
      expect(upNextIndex).toBe(8);
      expect(screen.getByTestId('9')).toHaveFocus();
    });

    it('stays on the current item when onLoop returns prevIndex', async () => {
      const onLoop = vi.fn(
        (
          _event: React.KeyboardEvent,
          prevIndex: number,
          _nextIndex: number,
          _elementsRef: React.RefObject<Array<HTMLElement | null>>,
        ) => prevIndex,
      );

      await render(
        <CompositeRoot grid={threeColsGrid} orientation="horizontal" onLoop={onLoop}>
          <TestGridItems />
        </CompositeRoot>,
      );

      act(() => screen.getByTestId('9').focus());

      fireEvent.keyDown(screen.getByTestId('9'), { key: 'ArrowRight' });
      await flushMicrotasks();

      expect(onLoop).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('9')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('9')).toHaveFocus();

      fireEvent.keyDown(screen.getByTestId('9'), { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(onLoop).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('9')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('9')).toHaveFocus();
    });

    it('does not loop or call onLoop when loopFocus is disabled', async () => {
      const onLoop = vi.fn(
        (
          _event: React.KeyboardEvent,
          _prevIndex: number,
          nextIndex: number,
          _elementsRef: React.RefObject<Array<HTMLElement | null>>,
        ) => nextIndex,
      );

      await render(
        <CompositeRoot grid={threeColsGrid} loopFocus={false} onLoop={onLoop}>
          <TestGridItems />
        </CompositeRoot>,
      );

      act(() => screen.getByTestId('9').focus());

      fireEvent.keyDown(screen.getByTestId('9'), { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(screen.getByTestId('9')).toHaveFocus();

      fireEvent.keyDown(screen.getByTestId('9'), { key: 'ArrowRight' });
      await flushMicrotasks();

      expect(onLoop).not.toHaveBeenCalled();
      expect(screen.getByTestId('9')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('9')).toHaveFocus();
    });

    it('skips disabled indices', async () => {
      function App() {
        return (
          <CompositeRoot grid={threeColsGrid} disabledIndices={[4]}>
            <TestGridItems />
          </CompositeRoot>
        );
      }

      await render(<App />);

      act(() => screen.getByTestId('2').focus());

      fireEvent.keyDown(screen.getByTestId('2'), { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(screen.getByTestId('8')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('8')).toHaveFocus();
    });

    it('packs items into earlier gaps when dense', async () => {
      await render(
        <CompositeRoot
          grid={gridNavigation({
            cols: 2,
            dense: true,
            itemSizes: [
              { width: 1, height: 1 },
              { width: 2, height: 1 },
              { width: 1, height: 1 },
            ],
          })}
        >
          <CompositeItem data-testid="1">1</CompositeItem>
          <CompositeItem data-testid="2">2</CompositeItem>
          <CompositeItem data-testid="3">3</CompositeItem>
        </CompositeRoot>,
      );

      // Item 2 is too wide for the first row, so dense packing backfills
      // item 3 into the gap next to item 1. Without `dense`, that cell stays
      // empty and item 3 is placed below item 2.
      act(() => screen.getByTestId('1').focus());

      fireEvent.keyDown(screen.getByTestId('1'), { key: 'ArrowRight' });
      await flushMicrotasks();

      expect(screen.getByTestId('3')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('3')).toHaveFocus();

      fireEvent.keyDown(screen.getByTestId('3'), { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(screen.getByTestId('2')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('2')).toHaveFocus();
    });

    describe.skipIf(isJSDOM)('rtl', () => {
      it('horizontal orientation', async () => {
        render(
          <div dir="rtl">
            <DirectionProvider direction="rtl">
              <CompositeRoot grid={threeColsGrid} orientation="horizontal" enableHomeAndEndKeys>
                <TestGridItems />
              </CompositeRoot>
            </DirectionProvider>
          </div>,
        );

        act(() => screen.getByTestId('1').focus());

        fireEvent.keyDown(screen.getByTestId('1'), { key: 'ArrowLeft' });
        await flushMicrotasks();

        expect(screen.getByTestId('2')).toHaveAttribute('tabindex', '0');
        expect(screen.getByTestId('2')).toHaveFocus();

        fireEvent.keyDown(screen.getByTestId('2'), { key: 'ArrowLeft' });
        await flushMicrotasks();

        expect(screen.getByTestId('3')).toHaveAttribute('tabindex', '0');
        expect(screen.getByTestId('3')).toHaveFocus();

        fireEvent.keyDown(screen.getByTestId('3'), { key: 'ArrowLeft' });
        await flushMicrotasks();

        expect(screen.getByTestId('4')).toHaveAttribute('tabindex', '0');
        expect(screen.getByTestId('4')).toHaveFocus();

        fireEvent.keyDown(screen.getByTestId('4'), { key: 'ArrowLeft' });
        await flushMicrotasks();

        expect(screen.getByTestId('5')).toHaveAttribute('tabindex', '0');
        expect(screen.getByTestId('5')).toHaveFocus();

        fireEvent.keyDown(screen.getByTestId('5'), { key: 'Home' });
        await flushMicrotasks();

        expect(screen.getByTestId('1')).toHaveAttribute('tabindex', '0');

        fireEvent.keyDown(screen.getByTestId('1'), { key: 'End' });
        await flushMicrotasks();

        expect(screen.getByTestId('9')).toHaveAttribute('tabindex', '0');
      });

      it('both horizontal and vertical orientation', async () => {
        await render(
          <div dir="rtl">
            <DirectionProvider direction="rtl">
              <CompositeRoot grid={threeColsGrid} orientation="both" enableHomeAndEndKeys>
                <TestGridItems />
              </CompositeRoot>
            </DirectionProvider>
          </div>,
        );

        act(() => screen.getByTestId('1').focus());

        fireEvent.keyDown(screen.getByTestId('1'), { key: 'ArrowDown' });
        await flushMicrotasks();

        expect(screen.getByTestId('4')).toHaveAttribute('tabindex', '0');
        expect(screen.getByTestId('4')).toHaveFocus();

        fireEvent.keyDown(screen.getByTestId('4'), { key: 'ArrowLeft' });
        await flushMicrotasks();

        expect(screen.getByTestId('5')).toHaveAttribute('tabindex', '0');
        expect(screen.getByTestId('5')).toHaveFocus();

        fireEvent.keyDown(screen.getByTestId('5'), { key: 'ArrowDown' });
        await flushMicrotasks();

        expect(screen.getByTestId('8')).toHaveAttribute('tabindex', '0');
        expect(screen.getByTestId('8')).toHaveFocus();

        fireEvent.keyDown(screen.getByTestId('8'), { key: 'ArrowRight' });
        await flushMicrotasks();

        expect(screen.getByTestId('7')).toHaveAttribute('tabindex', '0');
        expect(screen.getByTestId('7')).toHaveFocus();

        fireEvent.keyDown(screen.getByTestId('7'), { key: 'ArrowUp' });
        await flushMicrotasks();

        expect(screen.getByTestId('4')).toHaveAttribute('tabindex', '0');
        expect(screen.getByTestId('4')).toHaveFocus();

        fireEvent.keyDown(screen.getByTestId('4'), { key: 'End' });
        await flushMicrotasks();

        expect(screen.getByTestId('9')).toHaveAttribute('tabindex', '0');

        fireEvent.keyDown(screen.getByTestId('9'), { key: 'Home' });
        await flushMicrotasks();

        expect(screen.getByTestId('1')).toHaveAttribute('tabindex', '0');
      });

      it('uses the forward edge when navigating from a spanning item', async () => {
        await render(
          <div dir="rtl">
            <DirectionProvider direction="rtl">
              <CompositeRoot
                grid={gridNavigation({
                  cols: 3,
                  itemSizes: [
                    { width: 1, height: 1 },
                    { width: 2, height: 1 },
                    { width: 1, height: 1 },
                  ],
                })}
                orientation="both"
              >
                <CompositeItem data-testid="1">1</CompositeItem>
                <CompositeItem data-testid="2">2</CompositeItem>
                <CompositeItem data-testid="3">3</CompositeItem>
              </CompositeRoot>
            </DirectionProvider>
          </div>,
        );

        act(() => screen.getByTestId('2').focus());

        fireEvent.keyDown(screen.getByTestId('2'), { key: 'ArrowLeft' });
        await flushMicrotasks();

        expect(screen.getByTestId('1')).toHaveAttribute('tabindex', '0');
        expect(screen.getByTestId('1')).toHaveFocus();
      });
    });
  });

  describe('prop: disabledIndices', () => {
    it('moves the initial tab stop to the first enabled item when the default item is disabled', async () => {
      await render(
        <CompositeRoot disabledIndices={[0]}>
          <CompositeItem data-testid="1" />
          <CompositeItem data-testid="2" />
          <CompositeItem data-testid="3" />
        </CompositeRoot>,
      );

      expect(screen.getByTestId('1')).toHaveAttribute('tabindex', '-1');
      expect(screen.getByTestId('2')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('3')).toHaveAttribute('tabindex', '-1');
    });

    it('keeps the initial tab stop when all items are disabled', async () => {
      await render(
        <CompositeRoot disabledIndices={[0, 1]}>
          <CompositeItem data-testid="1" />
          <CompositeItem data-testid="2" />
        </CompositeRoot>,
      );

      expect(screen.getByTestId('1')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('2')).toHaveAttribute('tabindex', '-1');
    });

    it('disables navigating item when their index is included', async () => {
      function App() {
        const [highlightedIndex, setHighlightedIndex] = React.useState(0);
        return (
          <CompositeRoot
            highlightedIndex={highlightedIndex}
            onHighlightedIndexChange={setHighlightedIndex}
            disabledIndices={[1]}
          >
            <CompositeItem data-testid="1" />
            <CompositeItem data-testid="2" />
            <CompositeItem data-testid="3" />
          </CompositeRoot>
        );
      }

      render(<App />);

      const item1 = screen.getByTestId('1');
      const item3 = screen.getByTestId('3');

      act(() => item1.focus());

      fireEvent.keyDown(item1, { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(item3).toHaveAttribute('tabindex', '0');
      expect(item3).toHaveFocus();

      fireEvent.keyDown(item3, { key: 'ArrowUp' });
      await flushMicrotasks();

      expect(item1).toHaveAttribute('tabindex', '0');
      expect(item1).toHaveFocus();
    });

    it('allows navigating items disabled in the DOM when their index is excluded', async () => {
      function App() {
        const [highlightedIndex, setHighlightedIndex] = React.useState(0);
        return (
          <CompositeRoot
            highlightedIndex={highlightedIndex}
            onHighlightedIndexChange={setHighlightedIndex}
            disabledIndices={[]}
          >
            <CompositeItem
              data-testid="1"
              // TS doesn't like the disabled attribute on non-interactive elements
              // but testing library refuses to focus disabled interactive elements
              // @ts-ignore
              render={<span data-disabled aria-disabled="true" disabled />}
            />
            <CompositeItem
              data-testid="2"
              // @ts-ignore
              render={<span data-disabled aria-disabled="true" disabled />}
            />
            <CompositeItem
              data-testid="3"
              // @ts-ignore
              render={<span data-disabled aria-disabled="true" disabled />}
            />
          </CompositeRoot>
        );
      }

      await render(<App />);

      const item1 = screen.getByTestId('1');
      const item2 = screen.getByTestId('2');
      const item3 = screen.getByTestId('3');

      act(() => item1.focus());

      fireEvent.keyDown(item1, { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(item2).toHaveAttribute('tabindex', '0');
      expect(item2).toHaveFocus();

      fireEvent.keyDown(item2, { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(item3).toHaveAttribute('tabindex', '0');
      expect(item3).toHaveFocus();

      fireEvent.keyDown(item3, { key: 'ArrowDown' });
      await flushMicrotasks();

      expect(item1).toHaveAttribute('tabindex', '0');
      expect(item1).toHaveFocus();

      fireEvent.keyDown(item1, { key: 'ArrowUp' });
      await flushMicrotasks();

      expect(item3).toHaveAttribute('tabindex', '0');
      expect(item3).toHaveFocus();
    });
  });

  describe('prop: modifierKeys', () => {
    it('prevents arrow key navigation when any modifier key is pressed by default', async () => {
      render(
        <CompositeRoot>
          <CompositeItem data-testid="1">1</CompositeItem>
          <CompositeItem data-testid="2">2</CompositeItem>
        </CompositeRoot>,
      );

      const item1 = screen.getByTestId('1');

      act(() => item1.focus());

      expect(item1).toHaveFocus();

      fireEvent.keyDown(item1, { key: 'ArrowDown', shiftKey: true });
      await flushMicrotasks();
      expect(item1).toHaveFocus();

      fireEvent.keyDown(item1, { key: 'ArrowDown', ctrlKey: true });
      await flushMicrotasks();
      expect(item1).toHaveFocus();

      fireEvent.keyDown(item1, { key: 'ArrowDown', altKey: true });
      await flushMicrotasks();
      expect(item1).toHaveFocus();

      fireEvent.keyDown(item1, { key: 'ArrowDown', metaKey: true });
      await flushMicrotasks();
      expect(item1).toHaveFocus();
    });

    it('specifies allowed modifier keys that do not prevent arrow key navigation when pressed', async () => {
      render(
        <CompositeRoot modifierKeys={['Alt', 'Meta']}>
          <CompositeItem data-testid="1">1</CompositeItem>
          <CompositeItem data-testid="2">2</CompositeItem>
          <CompositeItem data-testid="3">3</CompositeItem>
        </CompositeRoot>,
      );

      const item1 = screen.getByTestId('1');
      const item2 = screen.getByTestId('2');
      const item3 = screen.getByTestId('3');

      act(() => item1.focus());

      expect(item1).toHaveFocus();

      fireEvent.keyDown(item1, { key: 'ArrowDown', shiftKey: true });
      await flushMicrotasks();
      expect(item1).toHaveFocus();

      fireEvent.keyDown(item1, { key: 'ArrowDown', ctrlKey: true });
      await flushMicrotasks();
      expect(item1).toHaveFocus();

      fireEvent.keyDown(item1, { key: 'ArrowDown', altKey: true });
      await flushMicrotasks();
      expect(item2).toHaveFocus();

      fireEvent.keyDown(item2, { key: 'ArrowDown', metaKey: true });
      await flushMicrotasks();
      expect(item3).toHaveFocus();
    });
  });
});
