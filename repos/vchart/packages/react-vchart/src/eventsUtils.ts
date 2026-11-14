import type { IVChart, EventCallback, EventParamsDefinition, EventFilter } from '@visactor/vchart';
import { isFunction, isObject, isShallowEqual } from '@visactor/vutils';

export interface LegendEventProps {
  onLegendItemHover?: (e: any) => void;
  onLegendItemUnHover?: (e: any) => void;
  onLegendItemClick?: (e: any) => void;
  onLegendFilter?: (e: any) => void;
  onLegendSelectedDataChange?: (e: any) => void;
}

export interface BrushEventProps {
  onBrushStart?: (e: any) => void;
  onBrushChange?: (e: any) => void;
  onBrushEnd?: (e: any) => void;
}

export interface DataZoomEventProps {
  onDataZoomChange?: (e: any) => void;
}

export interface PlayerEventProps {
  onPlayerPlay?: (e: any) => void;
  onPlayerPause?: (e: any) => void;
  onPlayerEnd?: (e: any) => void;
  onPlayerChange?: (e: any) => void;
  onPlayerForward?: (e: any) => void;
  onPlayerBackward?: (e: any) => void;
}

export interface ScrollBarEventProps {
  onScrollBarChange?: (e: any) => void;
}

export interface DimensionEventProps {
  onDimensionHover?: (e: any) => void;
  onDimensionClick?: (e: any) => void;
}

export interface HierarchyEventProps {
  onDrill?: (e: any) => void;
}

export interface ChartLifeCycleEventProps {
  onInitialized?: (e: any) => void;
  onRendered?: (e: any) => void;
  onRenderFinished?: (e: any) => void;
  onAnimationFinished?: (e: any) => void;
  onLayoutStart?: (e: any) => void;
  onLayoutEnd?: (e: any) => void;
}

export interface EventsProps {
  onPointerDown?: EventCallback<EventParamsDefinition['pointerdown']>;
  onPointerUp?: EventCallback<EventParamsDefinition['pointerup']>;
  onPointerUpOutside?: EventCallback<EventParamsDefinition['pointerupoutside']>;
  onPointerTap?: EventCallback<EventParamsDefinition['pointertap']>;
  onPointerOver?: EventCallback<EventParamsDefinition['pointerover']>;
  onPointerMove?: EventCallback<EventParamsDefinition['pointermove']>;
  onPointerEnter?: EventCallback<EventParamsDefinition['pointerenter']>;
  onPointerLeave?: EventCallback<EventParamsDefinition['pointerleave']>;
  onPointerOut?: EventCallback<EventParamsDefinition['pointerout']>;
  onMouseDown?: EventCallback<EventParamsDefinition['mousedown']>;
  onMouseUp?: EventCallback<EventParamsDefinition['mouseup']>;
  onMouseUpOutside?: EventCallback<EventParamsDefinition['mouseupoutside']>;
  onMouseMove?: EventCallback<EventParamsDefinition['mousemove']>;
  onMouseOver?: EventCallback<EventParamsDefinition['mouseover']>;
  onMouseOut?: EventCallback<EventParamsDefinition['mouseout']>;
  onMouseEnter?: EventCallback<EventParamsDefinition['mouseenter']>;
  onMouseLeave?: EventCallback<EventParamsDefinition['mouseleave']>;
  onPinch?: EventCallback<EventParamsDefinition['pinch']>;
  onPinchStart?: EventCallback<EventParamsDefinition['pinchstart']>;
  onPinchEnd?: EventCallback<EventParamsDefinition['pinchend']>;
  onPan?: EventCallback<EventParamsDefinition['pan']>;
  onPanStart?: EventCallback<EventParamsDefinition['panstart']>;
  onPanEnd?: EventCallback<EventParamsDefinition['panend']>;
  onDrag?: EventCallback<EventParamsDefinition['drag']>;
  onDragStart?: EventCallback<EventParamsDefinition['dragstart']>;
  onDragEnter?: EventCallback<EventParamsDefinition['dragenter']>;
  onDragLeave?: EventCallback<EventParamsDefinition['dragleave']>;
  onDragOver?: EventCallback<EventParamsDefinition['dragover']>;
  onDragEnd?: EventCallback<EventParamsDefinition['dragend']>;
  onRightDown?: EventCallback<EventParamsDefinition['rightdown']>;
  onRightUp?: EventCallback<EventParamsDefinition['rightup']>;
  onRightUpOutside?: EventCallback<EventParamsDefinition['rightupoutside']>;
  onTouchStart?: EventCallback<EventParamsDefinition['touchstart']>;
  onTouchEnd?: EventCallback<EventParamsDefinition['touchend']>;
  onTouchEndOutside?: EventCallback<EventParamsDefinition['touchendoutside']>;
  onTouchMove?: EventCallback<EventParamsDefinition['touchmove']>;
  onTouchCancel?: EventCallback<EventParamsDefinition['touchcancel']>;
  onPress?: EventCallback<EventParamsDefinition['press']>;
  onPressUp?: EventCallback<EventParamsDefinition['pressup']>;
  onPressEnd?: EventCallback<EventParamsDefinition['pressend']>;
  onSwipe?: EventCallback<EventParamsDefinition['swipe']>;
  onDrop?: EventCallback<EventParamsDefinition['drop']>;
  onWeel?: EventCallback<EventParamsDefinition['weel']>;
  onClick?: EventCallback<EventParamsDefinition['click']>;
  onDblClick?: EventCallback<EventParamsDefinition['dblclick']>;

  // @since 1.13.0
  onPointerDownFilter?: EventFilter;
  onPointerUpFilter?: EventFilter;
  onPointerUpOutsideFilter?: EventFilter;
  onPointerTapFilter?: EventCallback<EventParamsDefinition['pointertap']>;
  onPointerOverFilter?: EventCallback<EventParamsDefinition['pointerover']>;
  onPointerMoveFilter?: EventFilter;
  onPointerEnterFilter?: EventFilter;
  onPointerLeaveFilter?: EventFilter;
  onPointerOutFilter?: EventFilter;
  onMouseDownFilter?: EventFilter;
  onMouseUpFilter?: EventFilter;
  onMouseUpOutsideFilter?: EventFilter;
  onMouseMoveFilter?: EventFilter;
  onMouseOverFilter?: EventFilter;
  onMouseOutFilter?: EventFilter;
  onMouseEnterFilter?: EventFilter;
  onMouseLeaveFilter?: EventFilter;
  onPinchFilter?: EventFilter;
  onPinchStartFilter?: EventFilter;
  onPinchEndFilter?: EventFilter;
  onPanFilter?: EventFilter;
  onPanStartFilter?: EventFilter;
  onPanEndFilter?: EventFilter;
  onDragFilter?: EventFilter;
  onDragStartFilter?: EventFilter;
  onDragEnterFilter?: EventFilter;
  onDragLeaveFilter?: EventFilter;
  onDragOverFilter?: EventFilter;
  onDragEndFilter?: EventFilter;
  onRightDownFilter?: EventFilter;
  onRightUpFilter?: EventFilter;
  onRightUpOutsideFilter?: EventFilter;
  onTouchStartFilter?: EventFilter;
  onTouchEndFilter?: EventFilter;
  onTouchEndOutsideFilter?: EventFilter;
  onTouchMoveFilter?: EventFilter;
  onTouchCancelFilter?: EventFilter;
  onPressFilter?: EventFilter;
  onPressUpFilter?: EventFilter;
  onPressEndFilter?: EventFilter;
  onSwipeFilter?: EventFilter;
  onDropFilter?: EventFilter;
  onWeelFilter?: EventFilter;
  onClickFilter?: EventFilter;
  onDblClickFilter?: EventFilter;
}

export const REACT_TO_VCHART_EVENTS = {
  onPointerDown: 'pointerdown',
  onPointerUp: 'pointerup',
  onPointerUpOutside: 'pointerupoutside',
  onPointerTap: 'pointertap',
  onPointerOver: 'pointerover',
  onPointerMove: 'pointermove',
  onPointerEnter: 'pointerenter',
  onPointerLeave: 'pointerleave',
  onPointerOut: 'pointerout',
  onMouseDown: 'mousedown',
  onMouseUp: 'mouseup',
  onMouseUpOutside: 'mouseupoutside',
  onMouseMove: 'mousemove',
  onMouseOver: 'mouseover',
  onMouseOut: 'mouseout',
  onMouseEnter: 'mouseenter',
  onMouseLeave: 'mouseleave',
  onPinch: 'pinch',
  onPinchStart: 'pinchstart',
  onPinchEnd: 'pinchend',
  onPan: 'pan',
  onPanStart: 'panstart',
  onPanEnd: 'panend',
  onDrag: 'drag',
  onDragStart: 'dragstart',
  onDragEnter: 'dragenter',
  onDragLeave: 'dragleave',
  onDragOver: 'dragover',
  onDragEnd: 'dragend',
  onRightDown: 'rightdown',
  onRightUp: 'rightup',
  onRightUpOutside: 'rightupoutside',
  onTouchStart: 'touchstart',
  onTouchEnd: 'touchend',
  onTouchEndOutside: 'touchendoutside',
  onTouchMove: 'touchmove',
  onTouchCancel: 'touchcancel',
  onPress: 'press',
  onPressUp: 'pressup',
  onPressEnd: 'pressend',
  onSwipe: 'swipe',
  onDrop: 'drop',
  onWeel: 'wheel',
  onClick: 'click',
  onDblClick: 'dblclick'
};

export const LEGEND_CUSTOMIZED_EVENTS = {
  onLegendItemHover: 'legendItemHover',
  onLegendItemUnHover: 'legendItemUnHover',
  onLegendItemClick: 'legendItemClick',
  onLegendFilter: 'legendFilter',
  onLegendSelectedDataChange: 'legendSelectedDataChange'
};
export const BRUSH_CUSTOMIZED_EVENTS = {
  onBrushStart: 'brushStart',
  onBrushChange: 'brushChange',
  onBrushEnd: 'brushEnd',
  onBrushClear: 'brushClear'
};

export const DATAZOOM_CUSTOMIZED_EVENTS = {
  onDataZoomChange: 'dataZoomChange'
};

export const PLAYER_CUSTOMIZED_EVENTS = {
  onPlayerPlay: 'playerPlay',
  onPlayerPause: 'playerPause',
  onPlayerEnd: 'playerEnd',
  onPlayerChange: 'playerChange',
  onPlayerForward: 'playerForward',
  onPlayerBackward: 'playerBackward'
};

export const SCROLLBAR_CUSTOMIZED_EVENTS = {
  onScrollBarChange: 'scrollBarChange'
};

export const DIMENSION_EVENTS = {
  onDimensionHover: 'dimensionHover',
  onDimensionClick: 'dimensionClick'
};

export const HIERARCHY_EVENTS = {
  onDrill: 'drill'
};

export const CHART_LIFECYCLE_EVENTS = {
  onInitialized: 'initialized',
  onRendered: 'rendered',
  onRenderFinished: 'renderFinished',
  onAnimationFinished: 'animationFinished',
  onLayoutStart: 'layoutStart',
  onLayoutEnd: 'layoutEnd'
};

export const CHART_EVENTS = {
  ...LEGEND_CUSTOMIZED_EVENTS,
  ...BRUSH_CUSTOMIZED_EVENTS,
  ...PLAYER_CUSTOMIZED_EVENTS,
  ...DATAZOOM_CUSTOMIZED_EVENTS,
  ...SCROLLBAR_CUSTOMIZED_EVENTS,
  ...DIMENSION_EVENTS,
  ...CHART_LIFECYCLE_EVENTS,
  ...HIERARCHY_EVENTS,
  ...REACT_TO_VCHART_EVENTS
};

export const CHART_EVENTS_KEYS = Object.keys(CHART_EVENTS).concat(
  Object.keys(REACT_TO_VCHART_EVENTS).map(evt => `${evt}Filter`)
);

export const COMMON_EVENTK_KEYS = Object.keys(REACT_TO_VCHART_EVENTS);

export const VCHART_TO_REACT_EVENTS = Object.keys(REACT_TO_VCHART_EVENTS).reduce((res: Record<string, string>, key) => {
  res[(REACT_TO_VCHART_EVENTS as Record<string, string>)[key]] = key;

  return res;
}, {});

export const findEventProps = <T extends EventsProps>(
  props: T,
  supportedEvents: Record<string, string> = REACT_TO_VCHART_EVENTS
): EventsProps => {
  const result: EventsProps = {};

  Object.keys(props).forEach(key => {
    if (supportedEvents[key] && (props as any)[key]) {
      (result as any)[key] = (props as any)[key];
    }
  });

  return result;
};

export const bindEventsToChart = <T>(
  chart: IVChart,
  newProps?: T | null,
  prevProps?: T | null,
  supportedEvents: Record<string, string> = REACT_TO_VCHART_EVENTS
) => {
  if ((!newProps && !prevProps) || !chart) {
    return false;
  }

  const prevEventProps = prevProps ? findEventProps(prevProps, supportedEvents) : null;
  const newEventProps = newProps ? findEventProps(newProps, supportedEvents) : null;

  if (prevEventProps) {
    Object.keys(prevEventProps).forEach(eventKey => {
      if (
        !newEventProps ||
        !(newEventProps as any)[eventKey] ||
        (newEventProps as any)[eventKey] !== (prevEventProps as any)[eventKey]
      ) {
        const res = chart.off(supportedEvents[eventKey], (prevEventProps as any)[eventKey]);
      }
    });
  }

  if (newEventProps) {
    Object.keys(newEventProps).forEach(eventKey => {
      if (
        !prevEventProps ||
        !(prevEventProps as any)[eventKey] ||
        (prevEventProps as any)[eventKey] !== (newEventProps as any)[eventKey]
      ) {
        const filter = (newProps as any)[`${eventKey}Filter`];

        if (filter) {
          chart.on(supportedEvents[eventKey], filter, (newEventProps as any)[eventKey]);
        } else {
          chart.on(supportedEvents[eventKey], (newEventProps as any)[eventKey]);
        }
      }
    });
  }

  return true;
};
