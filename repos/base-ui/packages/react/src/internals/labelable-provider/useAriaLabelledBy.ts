'use client';
import * as React from 'react';
import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
import { useBaseUiId } from '../useBaseUiId';

/**
 * @internal
 */
export function useAriaLabelledBy(
  explicitAriaLabelledBy: string | undefined,
  labelId: string | undefined,
  labelSourceRef: React.RefObject<LabelSource | null>,
  enableFallback = true,
  labelSourceId?: string,
) {
  const [fallbackAriaLabelledBy, setFallbackAriaLabelledBy] = React.useState<string | undefined>();

  const generatedLabelId = useBaseUiId(labelSourceId ? `${labelSourceId}-label` : undefined);
  const ariaLabelledBy = explicitAriaLabelledBy ?? labelId ?? fallbackAriaLabelledBy;

  // Fallback for <span> controls labelled by wrapping/sibling native <label>.
  // Run after every commit so DOM association changes (e.g. label mount/unmount)
  // are reflected even when props/state deps are unchanged.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useIsoLayoutEffect(() => {
    const nextAriaLabelledBy =
      explicitAriaLabelledBy || labelId || !enableFallback
        ? undefined
        : getAriaLabelledBy(labelSourceRef.current, generatedLabelId);

    if (fallbackAriaLabelledBy !== nextAriaLabelledBy) {
      setFallbackAriaLabelledBy(nextAriaLabelledBy);
    }
  });

  return ariaLabelledBy;
}

function getAriaLabelledBy(labelSource?: LabelSource | null, generatedLabelId?: string) {
  const label = findAssociatedLabel(labelSource);
  if (!label) {
    return undefined;
  }

  if (!label.id && generatedLabelId) {
    label.id = generatedLabelId;
  }

  return label.id || undefined;
}

function findAssociatedLabel(labelSource?: LabelSource | null) {
  if (!labelSource) {
    return undefined;
  }

  // Fast path before the expensive `.labels` read.
  const parent = labelSource.parentElement;
  if (parent && parent.tagName === 'LABEL') {
    return parent as HTMLLabelElement;
  }

  const controlId = labelSource.id;
  if (controlId) {
    const nextSibling = labelSource.nextElementSibling as HTMLLabelElement | null;
    if (nextSibling && nextSibling.htmlFor === controlId) {
      return nextSibling;
    }
  }

  const labels = labelSource.labels;
  return labels && labels[0];
}

type LabelSource = HTMLElement & { labels?: NodeListOf<HTMLLabelElement> | null | undefined };
