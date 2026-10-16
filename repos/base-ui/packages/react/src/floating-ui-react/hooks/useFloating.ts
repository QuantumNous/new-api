'use client';
import * as React from 'react';
import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
import { useFloating as usePosition, type VirtualElement } from '@floating-ui/react-dom';
import { isElement } from '@floating-ui/utils/dom';
import { FloatingRootStore } from '../components/FloatingRootStore';
import { useFloatingTree } from '../components/FloatingTree';
import type {
  FloatingContext,
  NarrowedElement,
  ReferenceType,
  UseFloatingOptions,
  UseFloatingReturn,
} from '../types';
import { useFloatingRootContext } from './useFloatingRootContext';

/**
 * Provides data to position a floating element and context to add interactions.
 * @see https://floating-ui.com/docs/useFloating
 */
export function useFloating(options: UseFloatingOptions = {}): UseFloatingReturn {
  const { nodeId, externalTree } = options;

  const internalStore = useFloatingRootContext(options);
  const store = options.rootContext || internalStore;

  const referenceElement = store.useState('referenceElement');
  const floatingElement = store.useState('floatingElement');
  const domReferenceElement = store.useState('domReferenceElement');
  const open = store.useState('open');
  const floatingId = store.useState('floatingId');

  const [positionReference, setPositionReferenceRaw] = React.useState<ReferenceType | null>(null);
  const [localDomReference, setLocalDomReference] = React.useState<
    NarrowedElement<ReferenceType> | null | undefined
  >(undefined);
  const [localFloatingElement, setLocalFloatingElement] = React.useState<
    HTMLElement | null | undefined
  >(undefined);

  const domReferenceRef = React.useRef<NarrowedElement<ReferenceType> | null>(null);

  const tree = useFloatingTree(externalTree);

  const storeElements = React.useMemo(
    () => ({
      reference: referenceElement,
      floating: floatingElement,
      domReference: domReferenceElement,
    }),
    [referenceElement, floatingElement, domReferenceElement],
  );

  const position = usePosition({
    ...options,
    elements: {
      ...storeElements,
      ...(positionReference && { reference: positionReference }),
    },
  });

  const localDomReferenceElement = isElement(localDomReference)
    ? (localDomReference as Element)
    : null;

  const syncedFloatingElement =
    localFloatingElement === undefined ? store.state.floatingElement : localFloatingElement;

  store.useSyncedValue('referenceElement', localDomReference ?? null);
  store.useSyncedValue(
    'domReferenceElement',
    localDomReference === undefined ? domReferenceElement : localDomReferenceElement,
  );
  store.useSyncedValue('floatingElement', syncedFloatingElement);

  const setPositionReference = React.useCallback(
    (node: ReferenceType | null) => {
      const computedPositionReference = isElement(node)
        ? ({
            getBoundingClientRect: () => node.getBoundingClientRect(),
            getClientRects: () => node.getClientRects(),
            contextElement: node,
          } satisfies VirtualElement)
        : node;
      // Store the positionReference in state if the DOM reference is specified externally via the
      // `elements.reference` option. This ensures that it won't be overridden on future renders.
      setPositionReferenceRaw(computedPositionReference);
      position.refs.setReference(computedPositionReference);
    },
    [position.refs],
  );

  const setReference = React.useCallback(
    (node: ReferenceType | null) => {
      if (isElement(node) || node === null) {
        (domReferenceRef as React.RefObject<Element | null>).current = node;
        setLocalDomReference(node as NarrowedElement<ReferenceType> | null);
      }

      // Backwards-compatibility for passing a virtual element to `reference`
      // after it has set the DOM reference.
      if (
        isElement(position.refs.reference.current) ||
        position.refs.reference.current === null ||
        // Don't allow setting virtual elements using the old technique back to
        // `null` to support `positionReference` + an unstable `reference`
        // callback ref.
        (node !== null && !isElement(node))
      ) {
        position.refs.setReference(node);
      }
    },
    [position.refs, setLocalDomReference],
  );

  const setFloating = React.useCallback(
    (node: HTMLElement | null) => {
      setLocalFloatingElement(node);
      position.refs.setFloating(node);
    },
    [position.refs],
  );

  const refs = React.useMemo(
    () => ({
      ...position.refs,
      setReference,
      setFloating,
      setPositionReference,
      domReference: domReferenceRef,
    }),
    [position.refs, setReference, setFloating, setPositionReference],
  );

  const elements = React.useMemo(
    () => ({
      ...position.elements,
      domReference: domReferenceElement,
    }),
    [position.elements, domReferenceElement],
  );

  const context = React.useMemo<FloatingContext>(
    () => ({
      ...position,
      dataRef: store.context.dataRef,
      open,
      onOpenChange: store.setOpen,
      events: store.context.events,
      floatingId,
      refs,
      elements,
      nodeId,
      rootStore: store,
    }),
    [position, refs, elements, nodeId, store, open, floatingId],
  );

  useIsoLayoutEffect(() => {
    if (domReferenceElement) {
      domReferenceRef.current = domReferenceElement as NarrowedElement<ReferenceType> | null;
    }
  }, [domReferenceElement]);

  useIsoLayoutEffect(() => {
    store.context.dataRef.current.floatingContext = context;

    const node = tree?.nodesRef.current.find((n) => n.id === nodeId);
    if (node) {
      node.context = context;
    }
  });

  return React.useMemo(
    () => ({
      ...position,
      context,
      refs,
      elements,
      rootStore: store as unknown as FloatingRootStore,
    }),
    [position, refs, elements, context, store],
  ) as UseFloatingReturn;
}
