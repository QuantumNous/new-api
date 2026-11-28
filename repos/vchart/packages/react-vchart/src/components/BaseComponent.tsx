import React, { useContext, useEffect } from 'react';
import { pickWithout } from '@visactor/vutils';

import RootChartContext from '../context/chart';
import { bindEventsToChart } from '../eventsUtils';
import { VChart } from '@visactor/vchart';

export interface BaseComponentProps {
  id?: string | number;
}

type ComponentProps = BaseComponentProps & { updateId?: number; componentId?: number };

export const createComponent = <T extends ComponentProps>(
  componentName: string,
  specName: string,
  supportedEvents?: Record<string, string> | null,
  isSingle?: boolean,
  registers?: (() => void)[]
) => {
  if (registers && registers.length) {
    VChart.useRegisters(registers);
  }

  // tooltip component 不支持 children，其他组件暂时也都不支持
  const ignoreKeys = ['updateId', 'componentId', 'children'];
  const notSpecKeys = supportedEvents ? Object.keys(supportedEvents).concat(ignoreKeys) : ignoreKeys;

  const Comp: React.FC<T> = (props: T) => {
    const context = useContext(RootChartContext);
    const eventsBinded = React.useRef<T>(null);
    const updateId = React.useRef<number>(props.updateId);
    if (props.updateId !== updateId.current) {
      // update triggered by chart when chart is rendered
      updateId.current = props.updateId;

      // rebind events after chart render
      const hasPrevEventsBinded = supportedEvents
        ? bindEventsToChart(context.chart, props, eventsBinded.current, supportedEvents)
        : false;
      if (hasPrevEventsBinded) {
        eventsBinded.current = props;
      }
    }

    useEffect(() => {
      return () => {
        if (supportedEvents) {
          bindEventsToChart(context.chart, null, eventsBinded.current, supportedEvents);
        }
      };
    }, []);

    return null;
  };

  Comp.displayName = componentName;
  (Comp as any).parseSpec = (props: T & { updateId?: number; componentId?: string }) => {
    const newComponentSpec: Partial<T> = pickWithout<T>(props, notSpecKeys);

    return {
      spec: newComponentSpec,
      specName,
      isSingle
    };
  };

  return Comp;
};
