'use client';
import * as React from 'react';
import { useControlled } from '@base-ui/utils/useControlled';
import { useStableCallback } from '@base-ui/utils/useStableCallback';
import { useBaseUiId } from '../../internals/useBaseUiId';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { useTransitionStatus, TransitionStatus } from '../../internals/useTransitionStatus';
import type { CollapsibleRoot } from './CollapsibleRoot';

export function useCollapsibleRoot(
  parameters: UseCollapsibleRootParameters,
): UseCollapsibleRootReturnValue {
  const { open: openParam, defaultOpen, onOpenChange, disabled } = parameters;

  const [open, setOpen] = useControlled({
    controlled: openParam,
    default: defaultOpen,
    name: 'Collapsible',
    state: 'open',
  });

  const { mounted, setMounted, transitionStatus } = useTransitionStatus(open, true, true);

  const defaultPanelId = useBaseUiId();
  const [panelIdState, setPanelIdState] = React.useState<string | undefined>();
  const panelId = panelIdState ?? defaultPanelId;

  const handleTrigger = useStableCallback((event: React.MouseEvent | React.KeyboardEvent) => {
    const nextOpen = !open;
    const eventDetails = createChangeEventDetails(REASONS.triggerPress, event.nativeEvent);

    onOpenChange(nextOpen, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    setOpen(nextOpen);
  });

  return React.useMemo(
    () => ({
      disabled,
      handleTrigger,
      mounted,
      open,
      panelId,
      setMounted,
      setOpen,
      setPanelIdState,
      transitionStatus,
    }),
    [
      disabled,
      handleTrigger,
      mounted,
      open,
      panelId,
      setMounted,
      setOpen,
      setPanelIdState,
      transitionStatus,
    ],
  );
}

export interface UseCollapsibleRootParameters {
  /**
   * Whether the collapsible panel is currently open.
   *
   * To render an uncontrolled collapsible, use the `defaultOpen` prop instead.
   */
  open?: boolean | undefined;
  /**
   * Whether the collapsible panel is initially open.
   *
   * To render a controlled collapsible, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Event handler called when the panel is opened or closed.
   */
  onOpenChange: (open: boolean, eventDetails: CollapsibleRoot.ChangeEventDetails) => void;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled: boolean;
}

export interface UseCollapsibleRootReturnValue {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  handleTrigger: (event: React.MouseEvent | React.KeyboardEvent) => void;
  /**
   * Whether the collapsible panel is mounted for transition and hidden-state
   * purposes. This can be `false` while the element remains in the DOM when
   * `keepMounted` or `hiddenUntilFound` is enabled.
   */
  mounted: boolean;
  /**
   * Whether the collapsible panel is currently open.
   */
  open: boolean;
  panelId: React.HTMLAttributes<Element>['id'];
  setMounted: (nextMounted: boolean) => void;
  setOpen: (open: boolean) => void;
  setPanelIdState: (id: string | undefined) => void;
  transitionStatus: TransitionStatus;
}

export interface UseCollapsibleRootState {}
