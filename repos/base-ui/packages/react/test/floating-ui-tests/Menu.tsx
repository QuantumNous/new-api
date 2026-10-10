'use client';
import c from 'clsx';
import * as React from 'react';
import { useMergedRefsN } from '@base-ui/utils/useMergedRefs';
import { useTestInteractions } from '#test-utils';
import { useBaseUiId } from '../../src/internals/useBaseUiId';
import { CompositeList } from '../../src/internals/composite/list/CompositeList';
import { useCompositeListItem } from '../../src/internals/composite/list/useCompositeListItem';
import { getEmptyRootContext } from '../../src/floating-ui-react/utils/getEmptyRootContext';
import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingNode,
  FloatingPortal,
  FloatingTree,
  offset,
  safePolygon,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useFloatingNodeId,
  useFloatingParentNodeId,
  useFloatingTree,
  useHover,
  useListNavigation,
  useTypeahead,
  useFocus,
} from '../../src/floating-ui-react';
import { gridNavigation } from '../../src/floating-ui-react/hooks/gridNavigation';
import { GRID_COLUMN_COUNT, renderGridRows } from './renderGridRows';
import styles from './Menu.module.css';

type MenuContextType = {
  getItemProps: ReturnType<typeof useTestInteractions>['getItemProps'];
  activeIndex: number | null;
  setActiveIndex: React.Dispatch<React.SetStateAction<number | null>>;
  setHasFocusInside: React.Dispatch<React.SetStateAction<boolean>>;
  allowHover: boolean;
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  parent: MenuContextType | null;
};

const MenuContext = React.createContext<MenuContextType>({
  getItemProps: () => ({}),
  activeIndex: null,
  setActiveIndex: () => {},
  setHasFocusInside: () => {},
  allowHover: true,
  isOpen: false,
  setIsOpen: () => {},
  parent: null,
});

interface MenuProps {
  label: string;
  nested?: boolean;
  children?: React.ReactNode;
  keepMounted?: boolean;
  orientation?: 'vertical' | 'horizontal' | 'both';
  grid?: boolean;
  openOnFocus?: boolean;
}

/** @internal */
export const MenuComponent = React.forwardRef<
  HTMLButtonElement,
  MenuProps & React.HTMLProps<HTMLButtonElement>
>(function Menu(
  {
    children,
    label,
    keepMounted = false,
    grid,
    orientation: orientationOption,
    openOnFocus = false,
    ...props
  },
  forwardedRef,
) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);
  const [allowHover, setAllowHover] = React.useState(false);
  const [hasFocusInside, setHasFocusInside] = React.useState(false);

  const elementsRef = React.useRef<Array<HTMLButtonElement | null>>([]);
  const labelsRef = React.useRef<Array<string | null>>([]);

  const tree = useFloatingTree();
  const nodeId = useFloatingNodeId();
  const parentId = useFloatingParentNodeId();
  const isNested = parentId != null;
  const orientation = orientationOption ?? (grid ? 'both' : 'vertical');

  const parent = React.useContext(MenuContext);
  const item = useCompositeListItem();
  const triggerId = useBaseUiId();

  const { floatingStyles, refs, context } = useFloating({
    nodeId,
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: isNested ? 'right-start' : 'bottom-start',
    middleware: [
      offset({ mainAxis: isNested ? 0 : 4, alignmentAxis: isNested ? -4 : 0 }),
      flip(),
      shift(),
    ],
    whileElementsMounted: autoUpdate,
  });
  const fallbackContext = React.useMemo(() => getEmptyRootContext(), []);
  const hoverContext = isNested && allowHover ? context : fallbackContext;

  const hover = useHover(hoverContext, {
    delay: { open: 75 },
    handleClose: safePolygon({ blockPointerEvents: true }),
  });
  const click = useClick(context, {
    event: 'mousedown',
    toggle: !isNested || !allowHover,
    ignoreMouse: isNested,
  });
  const focus = useFocus(context, { enabled: openOnFocus });
  const dismiss = useDismiss(context, { bubbles: true });
  const listNavigation = useListNavigation(context, {
    listRef: elementsRef,
    activeIndex,
    nested: isNested,
    onNavigate: setActiveIndex,
    orientation,
    grid: grid ? gridNavigation : undefined,
  });
  const typeahead = useTypeahead(context, {
    listRef: labelsRef,
    onMatch: isOpen ? setActiveIndex : undefined,
    activeIndex,
  });

  const { getReferenceProps, getFloatingProps, getItemProps } = useTestInteractions([
    hover,
    click,
    dismiss,
    focus,
    listNavigation,
    typeahead,
  ]);

  // Event emitter allows you to communicate across tree components.
  // This effect closes all menus when an item gets clicked anywhere
  // in the tree.
  React.useEffect(() => {
    if (!tree) {
      return undefined;
    }

    function handleTreeClick() {
      setIsOpen(false);
    }

    function onSubMenuOpen(event: { nodeId: string; parentId: string }) {
      if (event.nodeId !== nodeId && event.parentId === parentId) {
        setIsOpen(false);
      }
    }

    tree.events.on('click', handleTreeClick);
    tree.events.on('menuopen', onSubMenuOpen);

    return () => {
      tree.events.off('click', handleTreeClick);
      tree.events.off('menuopen', onSubMenuOpen);
    };
  }, [tree, nodeId, parentId]);

  React.useEffect(() => {
    if (isOpen && tree) {
      tree.events.emit('menuopen', { parentId, nodeId });
    }
  }, [tree, isOpen, nodeId, parentId]);

  // Determine if "hover" logic can run based on the modality of input. This
  // prevents unwanted focus synchronization as menus open and close with
  // keyboard navigation and the cursor is resting on the menu.
  React.useEffect(() => {
    function onPointerMove({ pointerType }: PointerEvent) {
      if (pointerType !== 'touch') {
        setAllowHover(true);
      }
    }

    function onKeyDown() {
      setAllowHover(false);
    }

    window.addEventListener('pointermove', onPointerMove, {
      once: true,
      capture: true,
    });
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('pointermove', onPointerMove, {
        capture: true,
      });
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [allowHover]);

  return (
    <FloatingNode id={nodeId}>
      <button
        type="button"
        ref={useMergedRefsN([refs.setReference, item.ref, forwardedRef])}
        id={triggerId}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? context.floatingId : undefined}
        data-open={isOpen ? '' : undefined}
        // eslint-disable-next-line no-nested-ternary
        tabIndex={!isNested ? props.tabIndex : parent.activeIndex === item.index ? 0 : -1}
        className={c(props.className || styles.Trigger, {
          [styles.TriggerNested]: isNested,
          [styles.TriggerNestedOpenNoFocus]: isOpen && isNested && !hasFocusInside,
          [styles.TriggerNestedOpenHasFocus]: isNested && isOpen && hasFocusInside,
          [styles.TriggerRootOpen]: !isNested && isOpen,
        })}
        {...getReferenceProps(
          parent.getItemProps({
            ...props,
            onFocus(event: React.FocusEvent<HTMLButtonElement>) {
              props.onFocus?.(event);
              setHasFocusInside(false);
              parent.setHasFocusInside(true);
            },
            onMouseEnter(event: React.MouseEvent<HTMLButtonElement>) {
              props.onMouseEnter?.(event);
              if (parent.allowHover && parent.isOpen) {
                parent.setActiveIndex(item.index);
              }
            },
          }),
        )}
      >
        {label}
        {isNested && (
          <span aria-hidden className={styles.Icon}>
            Icon
          </span>
        )}
      </button>
      <MenuContext.Provider
        // eslint-disable-next-line react/jsx-no-constructed-context-values
        value={{
          activeIndex,
          setActiveIndex,
          getItemProps,
          setHasFocusInside,
          allowHover,
          isOpen,
          setIsOpen,
          parent,
        }}
      >
        <CompositeList elementsRef={elementsRef} labelsRef={labelsRef}>
          {(keepMounted || isOpen) && (
            <FloatingPortal>
              <FloatingFocusManager
                context={context}
                modal={false}
                initialFocus={!isNested}
                returnFocus={!isNested}
              >
                <div
                  ref={refs.setFloating}
                  id={context.floatingId}
                  role="menu"
                  aria-labelledby={triggerId}
                  className={c(
                    styles.Panel,
                    {
                      [styles.PanelFlex]: !grid,
                    },
                    {
                      [styles.PanelGrid]: grid,
                    },
                  )}
                  style={{
                    ...floatingStyles,
                    // @ts-expect-error css var
                    '--cols': GRID_COLUMN_COUNT,
                    // eslint-disable-next-line no-nested-ternary
                    visibility: !keepMounted ? undefined : isOpen ? 'visible' : 'hidden',
                  }}
                  aria-hidden={!isOpen}
                  {...getFloatingProps()}
                >
                  {renderGridRows(children, grid)}
                </div>
              </FloatingFocusManager>
            </FloatingPortal>
          )}
        </CompositeList>
      </MenuContext.Provider>
    </FloatingNode>
  );
});

interface MenuItemProps {
  label: string;
  disabled?: boolean;
}

/** @internal */
export const MenuItem = React.forwardRef<
  HTMLButtonElement,
  MenuItemProps & React.ButtonHTMLAttributes<HTMLButtonElement>
>(function MenuItem({ label, disabled, ...props }, forwardedRef) {
  const menu = React.useContext(MenuContext);
  const item = useCompositeListItem({ label: disabled ? null : label });
  const tree = useFloatingTree();
  const isActive = item.index === menu.activeIndex;

  return (
    <button
      {...props}
      ref={useMergedRefsN([item.ref, forwardedRef])}
      type="button"
      role="menuitem"
      disabled={disabled}
      tabIndex={isActive ? 0 : -1}
      className={c(styles.Item, { [styles.ItemDisabled]: disabled })}
      {...menu.getItemProps({
        active: isActive,
        onClick(event: React.MouseEvent<HTMLButtonElement>) {
          props.onClick?.(event);
          tree?.events.emit('click');
        },
        onFocus(event: React.FocusEvent<HTMLButtonElement>) {
          props.onFocus?.(event);
          menu.setHasFocusInside(true);
        },
        onMouseEnter(event: React.MouseEvent<HTMLButtonElement>) {
          props.onMouseEnter?.(event);
          if (menu.allowHover && menu.isOpen) {
            menu.setActiveIndex(item.index);
          }
        },
        onKeyDown(event) {
          function closeParents(parent: MenuContextType | null) {
            parent?.setIsOpen(false);
            if (parent?.parent) {
              closeParents(parent.parent);
            }
          }

          if (
            event.key === 'ArrowRight' &&
            // If the root reference is in a menubar, close parents
            tree?.nodesRef.current[0].context?.elements.domReference?.closest('[role="menubar"]')
          ) {
            closeParents(menu.parent);
          }
        },
      })}
    >
      {label}
    </button>
  );
});

/** @internal */
export const Menu = React.forwardRef<
  HTMLButtonElement,
  MenuProps & React.HTMLProps<HTMLButtonElement>
>(function MenuWrapper(props, ref) {
  const parentId = useFloatingParentNodeId();

  if (parentId === null) {
    return (
      <FloatingTree>
        <MenuComponent {...props} ref={ref} />
      </FloatingTree>
    );
  }

  return <MenuComponent {...props} ref={ref} />;
});

/** @internal */
export function Main() {
  /* eslint-disable no-console */
  return (
    <React.Fragment>
      <h1 className={styles.Heading}>Menu</h1>
      <div className={styles.Container}>
        <Menu label="Edit">
          <MenuItem label="Undo" onClick={() => console.log('Undo')} />
          <MenuItem label="Redo" />
          <MenuItem label="Cut" disabled />
          <Menu label="Copy as" keepMounted>
            <MenuItem label="Text" />
            <MenuItem label="Video" />
            <Menu label="Image" keepMounted grid orientation="horizontal">
              <MenuItem label=".png" />
              <MenuItem label=".jpg" />
              <MenuItem label=".svg" />
              <MenuItem label=".gif" />
            </Menu>
            <MenuItem label="Audio" />
          </Menu>
          <Menu label="Share">
            <MenuItem label="Mail" />
            <MenuItem label="Instagram" />
          </Menu>
        </Menu>
      </div>
    </React.Fragment>
  );
}
