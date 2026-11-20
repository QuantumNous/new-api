'use client';
import * as React from 'react';
import { useTestInteractions } from '#test-utils';
import { CompositeList } from '../../src/internals/composite/list/CompositeList';
import { useCompositeListItem } from '../../src/internals/composite/list/useCompositeListItem';
import { useFloating, useListNavigation, useTypeahead } from '../../src/floating-ui-react';

interface SelectContextValue {
  activeIndex: number | null;
  selectedIndex: number | null;
  getItemProps: ReturnType<typeof useTestInteractions>['getItemProps'];
  handleSelect: (index: number | null) => void;
}

const SelectContext = React.createContext<SelectContextValue>({} as SelectContextValue);

/** @internal */
function Listbox({ children }: { children: React.ReactNode }) {
  const [activeIndex, setActiveIndex] = React.useState<number | null>(1);
  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null);

  const { refs, context } = useFloating({
    open: true,
  });

  const elementsRef = React.useRef<Array<HTMLElement | null>>([]);
  const labelsRef = React.useRef<Array<string | null>>([]);

  const handleSelect = React.useCallback((index: number | null) => {
    setSelectedIndex(index);
  }, []);

  function handleTypeaheadMatch(index: number | null) {
    setActiveIndex(index);
  }

  const listNav = useListNavigation(context, {
    listRef: elementsRef,
    activeIndex,
    selectedIndex,
    onNavigate: setActiveIndex,
    focusItemOnHover: false,
  });
  const typeahead = useTypeahead(context, {
    listRef: labelsRef,
    activeIndex,
    selectedIndex,
    onMatch: handleTypeaheadMatch,
  });
  const { getFloatingProps, getItemProps } = useTestInteractions([listNav, typeahead]);

  const selectContext = React.useMemo(
    () => ({
      activeIndex,
      selectedIndex,
      getItemProps,
      handleSelect,
    }),
    [activeIndex, selectedIndex, getItemProps, handleSelect],
  );

  return (
    <SelectContext.Provider value={selectContext}>
      <button onClick={() => setSelectedIndex(1)} data-testid="reference" type="button">
        Select
      </button>
      <div ref={refs.setFloating} id={context.floatingId} role="listbox" {...getFloatingProps()}>
        <CompositeList elementsRef={elementsRef} labelsRef={labelsRef}>
          {children}
        </CompositeList>
      </div>
    </SelectContext.Provider>
  );
}

/** @internal */
function Option({ label }: { label: string }) {
  const { activeIndex, selectedIndex, getItemProps, handleSelect } =
    React.useContext(SelectContext);

  const { ref, index } = useCompositeListItem({ label });

  const isActive = activeIndex === index;
  const isSelected = selectedIndex === index;

  const isFocusable =
    // eslint-disable-next-line no-nested-ternary
    activeIndex !== null ? isActive : selectedIndex !== null ? isSelected : index === 0;

  return (
    <button
      ref={ref}
      type="button"
      role="option"
      aria-selected={isActive && isSelected}
      tabIndex={isFocusable ? 0 : -1}
      style={{
        background: isActive ? 'cyan' : '',
        fontWeight: isSelected ? 'bold' : '',
      }}
      {...getItemProps({
        onClick: () => handleSelect(index),
      })}
    >
      {label}
    </button>
  );
}

/** @internal */
export function Main() {
  return (
    <Listbox>
      <Option label="Apple" />
      <Option label="Blueberry" />
      <Option label="Watermelon" />
      <Option label="Banana" />
    </Listbox>
  );
}
