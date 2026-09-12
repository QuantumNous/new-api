'use client';
import * as React from 'react';
import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
import { useStableCallback } from '@base-ui/utils/useStableCallback';
import { useRefWithInit } from '@base-ui/utils/useRefWithInit';
import { isElement } from '@floating-ui/utils/dom';
import { NOOP } from '../noop';
import { useBaseUiId } from '../useBaseUiId';
import { useLabelableContext } from './LabelableContext';

export function useLabelableId(params: UseLabelableIdParameters = {}) {
  const { id, implicit = false, controlRef } = params;

  const { controlId, registerControlId } = useLabelableContext();

  const defaultId = useBaseUiId(id);

  const controlIdForEffect = implicit ? controlId : undefined;

  const controlSourceRef = useRefWithInit(() => Symbol('labelable-control'));
  const hasRegisteredRef = React.useRef(false);
  const hadExplicitIdRef = React.useRef(id != null);

  const unregisterControlId = useStableCallback(() => {
    if (!hasRegisteredRef.current || registerControlId === NOOP) {
      return;
    }

    hasRegisteredRef.current = false;
    registerControlId(controlSourceRef.current, undefined);
  });

  useIsoLayoutEffect(() => {
    if (registerControlId === NOOP) {
      return undefined;
    }

    let nextId: string | null | undefined;

    if (implicit) {
      const elem = controlRef?.current;

      if (isElement(elem) && elem.closest('label') != null) {
        nextId = id ?? null;
      } else {
        nextId = controlIdForEffect ?? defaultId;
      }
    } else if (id != null) {
      hadExplicitIdRef.current = true;
      nextId = id;
    } else if (hadExplicitIdRef.current) {
      nextId = defaultId;
    } else {
      unregisterControlId();
      return undefined;
    }

    if (nextId === undefined) {
      unregisterControlId();
      return undefined;
    }

    hasRegisteredRef.current = true;
    registerControlId(controlSourceRef.current, nextId);

    return undefined;
  }, [
    id,
    controlRef,
    controlIdForEffect,
    registerControlId,
    implicit,
    defaultId,
    controlSourceRef,
    unregisterControlId,
  ]);

  React.useEffect(() => {
    return unregisterControlId;
  }, [unregisterControlId]);

  return controlId ?? defaultId;
}

export interface UseLabelableIdParameters {
  id?: string | undefined;
  /**
   * Whether implicit labelling is supported.
   * @default false
   */
  implicit?: boolean | undefined;
  /**
   * A ref to an element that can be implicitly labelled.
   */
  controlRef?: React.RefObject<HTMLElement | null> | undefined;
}

export type UseLabelableIdReturnValue = string;

export interface UseLabelableIdState {}
