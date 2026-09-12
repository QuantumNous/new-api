'use client';
import * as React from 'react';
import { FloatingDelayGroup } from '../../floating-ui-react';
import { TooltipProviderContext } from './TooltipProviderContext';

/**
 * Provides a shared delay for multiple tooltips. The grouping logic ensures that
 * once a tooltip becomes visible, the adjacent tooltips will be shown instantly.
 *
 * Documentation: [Base UI Tooltip](https://base-ui.com/react/components/tooltip)
 */
export const TooltipProvider: React.FC<TooltipProvider.Props> = function TooltipProvider(props) {
  const { delay, closeDelay, timeout = 400 } = props;

  const contextValue: TooltipProviderContext = React.useMemo(
    () => ({
      delay,
      closeDelay,
    }),
    [delay, closeDelay],
  );

  const delayValue = React.useMemo(() => ({ open: delay, close: closeDelay }), [delay, closeDelay]);

  return (
    <TooltipProviderContext.Provider value={contextValue}>
      <FloatingDelayGroup delay={delayValue} timeoutMs={timeout}>
        {props.children}
      </FloatingDelayGroup>
    </TooltipProviderContext.Provider>
  );
};

export interface TooltipProviderState {}

export interface TooltipProviderProps {
  children?: React.ReactNode;
  /**
   * How long to wait before opening a tooltip. Specified in milliseconds.
   */
  delay?: number | undefined;
  /**
   * How long to wait before closing a tooltip. Specified in milliseconds.
   */
  closeDelay?: number | undefined;
  /**
   * Another tooltip will open instantly if the previous tooltip
   * is closed within this timeout. Specified in milliseconds.
   * @default 400
   */
  timeout?: number | undefined;
}

export namespace TooltipProvider {
  export type State = TooltipProviderState;
  export type Props = TooltipProviderProps;
}
