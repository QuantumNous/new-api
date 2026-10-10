'use client';
import * as React from 'react';
import { useMergedRefs } from '@base-ui/utils/useMergedRefs';
import { useTestInteractions } from '#test-utils';
import { getEmptyRootContext } from '../../src/floating-ui-react/utils/getEmptyRootContext';
import {
  flip,
  FloatingFocusManager,
  FloatingNode,
  FloatingPortal,
  offset,
  safePolygon,
  shift,
  useDismiss,
  useFloating,
  useFloatingNodeId,
  useFocus,
  useHover,
} from '../../src/floating-ui-react';
import styles from './Navigation.module.css';

interface SubItemProps {
  label: string;
  href: string;
}

/** @internal */
export const NavigationSubItem = React.forwardRef<
  HTMLAnchorElement,
  SubItemProps & React.HTMLProps<HTMLAnchorElement>
>(function NavigationSubItem({ label, href, ...props }, ref) {
  return (
    <a {...props} ref={ref} href={href} className={styles.SubItem}>
      {label}
    </a>
  );
});

interface ItemProps {
  label: string;
  href: string;
  children?: React.ReactNode;
}

/** @internal */
export const NavigationItem = React.forwardRef<
  HTMLAnchorElement,
  ItemProps & React.HTMLProps<HTMLAnchorElement>
>(function NavigationItem({ children, label, href, ...props }, ref) {
  const [open, setOpen] = React.useState(false);
  const hasChildren = !!children;
  const fallbackContext = React.useMemo(() => getEmptyRootContext(), []);

  const nodeId = useFloatingNodeId();

  const { floatingStyles, refs, context } = useFloating({
    open,
    nodeId,
    onOpenChange: setOpen,
    middleware: [offset(8), flip(), shift()],
    placement: 'right-start',
  });

  const { getReferenceProps, getFloatingProps } = useTestInteractions([
    useHover(hasChildren ? context : fallbackContext, {
      handleClose: safePolygon(),
    }),
    useFocus(context, {
      enabled: hasChildren,
    }),
    useDismiss(context, {
      enabled: hasChildren,
    }),
  ]);

  const mergedReferenceRef = useMergedRefs(ref, refs.setReference);

  return (
    <FloatingNode id={nodeId}>
      <li>
        <a
          href={href}
          ref={mergedReferenceRef}
          className={styles.Item}
          {...getReferenceProps(props)}
        >
          {label}
        </a>
      </li>
      <FloatingPortal>
        {open && (
          <FloatingFocusManager context={context} modal={false} initialFocus={false}>
            <div
              data-testid="subnavigation"
              ref={refs.setFloating}
              className={styles.Subnav}
              style={floatingStyles}
              {...getFloatingProps()}
            >
              <button type="button" onClick={() => setOpen(false)}>
                Close
              </button>
              <ul className={styles.SubnavList}>{children}</ul>
            </div>
          </FloatingFocusManager>
        )}
      </FloatingPortal>
    </FloatingNode>
  );
});

interface NavigationProps {
  children?: React.ReactNode;
}

/** @internal */
export function Navigation(props: NavigationProps) {
  return (
    <nav>
      <ul>{props.children}</ul>
    </nav>
  );
}

/** @internal */
export function Main() {
  return (
    <React.Fragment>
      <h1 className={styles.Heading}>Navigation</h1>
      <div className={styles.Container}>
        <Navigation>
          <NavigationItem label="Home" href="#" />
          <NavigationItem label="Product" href="#">
            <NavigationSubItem label="Link 1" href="#" />
            <NavigationSubItem label="Link 2" href="#" />
            <NavigationSubItem label="Link 3" href="#" />
          </NavigationItem>
          <NavigationItem label="About" href="#" />
        </Navigation>
      </div>
    </React.Fragment>
  );
}
