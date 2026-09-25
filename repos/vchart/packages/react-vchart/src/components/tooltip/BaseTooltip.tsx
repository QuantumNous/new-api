import React from 'react';
import { isObject, pickWithout } from '@visactor/vutils';
import { VChart } from '@visactor/vchart';
import type { TooltipRender } from './interface';

export interface BaseTooltipProps {
  id?: string | number;
  tooltipRender?: TooltipRender;
  children?: React.ReactNode;
}

type TooltipProps = BaseTooltipProps & { updateId?: number; componentId?: number };

export const createTooltip = <T extends TooltipProps>(
  componentName: string,
  specName: string,
  registers?: (() => void)[]
) => {
  if (registers && registers.length) {
    VChart.useRegisters(registers);
  }

  // tooltip component 不支持 children，其他组件暂时也都不支持
  const ignoreKeys = ['updateId', 'componentId', 'children'];

  const Comp: React.FC<T> = (props: T) => {
    const updateId = React.useRef<number>(props.updateId);
    if (props.updateId !== updateId.current) {
      // update triggered by chart when chart is rendered
      updateId.current = props.updateId;
    }

    return null;
  };

  Comp.displayName = componentName;
  (Comp as any).parseSpec = (props: T & { updateId?: number; componentId?: string }) => {
    const newTooltipSpec: Partial<T> = pickWithout<T>(props, ignoreKeys);

    if (!props.tooltipRender && props.children) {
      newTooltipSpec.tooltipRender = (tooltipElement, actualTooltip, params) =>
        React.Children.map(props.children, child =>
          isObject(child)
            ? React.cloneElement(child as React.ReactElement<any, React.JSXElementConstructor<any>>, {
                tooltipElement,
                actualTooltip,
                params
              })
            : child
        );
    }

    return {
      spec: newTooltipSpec,
      specName,
      isSingle: true
    };
  };

  return Comp;
};
