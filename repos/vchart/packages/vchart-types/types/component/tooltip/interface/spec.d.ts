import type { EventSourceType, EventType } from '../../../event/interface';
import type { IGroupTooltipPattern, ITooltipActual, ITooltipPattern, Maybe, MaybeArray, TooltipActiveType, TooltipData } from '../../../typings';
import type { ITooltipActiveTypeAsKeys, TooltipHandlerParams, TooltipResult } from './common';
import type { ITooltipTheme } from './theme';
export interface ITooltipSpec extends Partial<ITooltipActiveTypeAsKeys<ITooltipPattern & {
    checkOverlap?: boolean;
}, ITooltipPattern, IGroupTooltipPattern>> {
    visible?: boolean;
    activeType?: TooltipActiveType | TooltipActiveType[];
    trigger?: MaybeArray<'hover' | 'click' | {
        eventType: EventType;
        source?: EventSourceType;
        consume?: boolean;
    }> | 'none';
    triggerOff?: MaybeArray<'hover' | 'click' | {
        eventType: EventType;
        source?: EventSourceType;
        consume?: boolean;
        checkOutside?: boolean;
    }> | 'none';
    showDelay?: number;
    hideTimer?: number;
    lockAfterClick?: boolean;
    style?: Omit<ITooltipTheme<string>, 'offset' | 'transitionDuration'>;
    handler?: Partial<ITooltipHandlerSpec>;
    renderMode?: 'html' | 'canvas';
    confine?: boolean;
    className?: string;
    parentElement?: Maybe<string | HTMLElement | HTMLCanvasElement>;
    enterable?: boolean;
    transitionDuration?: number;
    throttleInterval?: number;
    updateElement?: (tooltipElement: HTMLElement, actualTooltip: ITooltipActual, params: TooltipHandlerParams) => void;
    offset?: {
        x?: number;
        y?: number;
    };
}
type ISeriesToolipPattern = Pick<ITooltipPattern, 'visible' | 'title' | 'content' | 'hasShape' | 'shapeColor' | 'shapeFill' | 'shapeHollow' | 'shapeLineWidth' | 'shapeSize' | 'shapeStroke' | 'shapeType' | 'updateContent' | 'updateTitle' | 'updatePosition'>;
export interface ISeriesTooltipSpec extends Pick<ITooltipSpec, 'visible' | 'activeType' | 'handler'> {
    dimension?: ISeriesToolipPattern;
    mark?: ISeriesToolipPattern;
    group?: Pick<IGroupTooltipPattern, 'triggerMark'> & ISeriesToolipPattern;
}
export interface ITooltipHandlerSpec {
    showTooltip: (activeType: TooltipActiveType, tooltipData: TooltipData, params: TooltipHandlerParams) => Maybe<TooltipResult>;
    hideTooltip: (params: TooltipHandlerParams) => Maybe<TooltipResult>;
    release: () => void;
    isTooltipShown?: () => boolean;
}
export {};
