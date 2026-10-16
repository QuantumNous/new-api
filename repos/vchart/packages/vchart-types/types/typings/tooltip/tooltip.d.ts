import type { ITooltipHandlerSpec } from '../../component/tooltip/interface/spec';
import type { MaybeArray } from '../common';
import type { TooltipPatternProperty, TooltipUpdateCallback } from './common';
import type { TooltipActiveType, TooltipData } from './handler';
import type { ITooltipLineActual, ITooltipLinePattern } from './line';
import type { ITooltipPositionActual, TooltipPositionMode, TooltipPosition } from './position';
import type { ITooltipShapePattern } from './shape';
export interface ITooltipPattern extends ITooltipShapePattern {
    visible?: TooltipPatternProperty<boolean>;
    title?: TooltipPatternProperty<ITooltipLinePattern>;
    content?: MaybeArray<TooltipPatternProperty<MaybeArray<ITooltipLinePattern>>>;
    position?: TooltipPatternProperty<TooltipPosition>;
    positionMode?: TooltipPatternProperty<TooltipPositionMode>;
    updateTitle?: TooltipUpdateCallback<ITooltipLineActual>;
    updateContent?: TooltipUpdateCallback<ITooltipLineActual[]>;
    updatePosition?: TooltipUpdateCallback<ITooltipPositionActual>;
    maxLineCount?: number;
    othersLine?: ITooltipLineActual;
    activeType?: TooltipActiveType;
}
export type GroupTooltipTriggerMark = 'line' | 'area' | 'point' | 'bar';
export interface IGroupTooltipPattern extends ITooltipPattern {
    triggerMark?: MaybeArray<GroupTooltipTriggerMark>;
}
export interface ITooltipActual {
    visible?: boolean;
    title?: ITooltipLineActual;
    content?: ITooltipLineActual[];
    activeType?: TooltipActiveType;
    position?: ITooltipPositionActual;
    data?: TooltipData;
    handler?: Partial<ITooltipHandlerSpec>;
    maxLineCount?: number;
    updateTitle?: TooltipUpdateCallback<ITooltipLineActual>;
    updateContent?: TooltipUpdateCallback<ITooltipLineActual[]>;
    updatePosition?: TooltipUpdateCallback<ITooltipPositionActual>;
    othersLine?: ITooltipLineActual;
}
