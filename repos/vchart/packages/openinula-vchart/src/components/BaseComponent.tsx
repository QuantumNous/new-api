import React, { useContext, useEffect } from 'openinula';
import { pickWithout } from '@visactor/vutils';

import RootChartContext from '../context/chart';
import { bindEventsToChart } from '../eventsUtils';

export interface BaseComponentProps {
  id?: string | number;
}

type ComponentProps = BaseComponentProps & { updateId?: number; componentId?: number };

export const createComponent = <T extends ComponentProps>(
  componentName: string,
  specName: string,
  supportedEvents?: Record<string, string> | null,
  isSingle?: boolean
) => {
  const ignoreKeys = ['id', 'updateId', 'componentId'];
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
