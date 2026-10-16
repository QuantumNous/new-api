import React from 'react';
import { isNil, pickWithout } from '@visactor/vutils';
import RootChartContext from '../context/chart';
import {
  REACT_TO_VCHART_EVENTS,
  EventsProps,
  findEventProps,
  COMMON_EVENTK_KEYS,
  VCHART_TO_REACT_EVENTS
} from '../eventsUtils';
import { VChart } from '@visactor/vchart';
export interface BaseSeriesProps extends EventsProps {
  id?: string | number;
}

export const createSeries = <T extends BaseSeriesProps>(
  componentName: string,
  markNames: string[],
  type?: string,
  registers?: (() => void)[]
) => {
  if (registers && registers.length) {
    VChart.useRegisters(registers);
  }

  const ignoreKeys = ['updateId', 'componentId'];
  const notSpecKeys = COMMON_EVENTK_KEYS.concat(ignoreKeys);

  const addMarkId = (spec: any, seriesId: string | number) => {
    markNames.forEach(markName => {
      const defaultMarkId = `${seriesId}-${markName}`;

      if (isNil(spec[markName])) {
        spec[markName] = { id: defaultMarkId };
      } else if (isNil(spec[markName].id)) {
        spec[markName].id = defaultMarkId;
      }
    });
  };

  const Comp: React.FC<T & { updateId?: number; componentId?: string }> = props => {
    const context = React.useContext(RootChartContext);

    const id = props.id ?? props.componentId;
    const bindedEvents = React.useRef<Record<string, (e: any) => void>>({});

    const handleEvent = (e: any) => {
      const markIds = markNames.map(markName => `${id}-${markName}`);
      if (e?.mark && markIds.includes(e.mark.getUserId())) {
        props[VCHART_TO_REACT_EVENTS[e.event.type]](e);
      }
    };

    const addMarkEvent = (events: EventsProps) => {
      if (!events || !context.chart) {
        return;
      }

      if (bindedEvents.current) {
        Object.keys(bindedEvents.current).forEach(eventKey => {
          context.chart.off(REACT_TO_VCHART_EVENTS[eventKey], bindedEvents.current[eventKey]);
          bindedEvents.current[eventKey] = null;
        });
      }

      events &&
        Object.keys(events).forEach(eventKey => {
          if (!bindedEvents.current?.[eventKey]) {
            context.chart.on(REACT_TO_VCHART_EVENTS[eventKey], handleEvent);

            if (!bindedEvents.current) {
              bindedEvents.current = {};
            }
            bindedEvents.current[eventKey] = handleEvent;
          }
        });
    };

    const removeMarkEvent = () => {
      addMarkEvent({});
    };

    addMarkEvent(findEventProps(props));

    React.useEffect(() => {
      return () => {
        removeMarkEvent();
        bindedEvents.current = {};
      };
    }, []);

    return null;
  };

  Comp.displayName = componentName;
  (Comp as any).parseSpec = (compProps: T & { updateId?: number; componentId?: string }) => {
    const newSeriesSpec = pickWithout<T>(compProps, notSpecKeys);

    addMarkId(newSeriesSpec, compProps.id ?? compProps.componentId);

    if (!isNil(type)) {
      (newSeriesSpec as any).type = type;
    }

    return {
      spec: newSeriesSpec,
      specName: 'series'
    };
  };
  return Comp;
};
