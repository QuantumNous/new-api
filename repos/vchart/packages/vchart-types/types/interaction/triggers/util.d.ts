import type { IMark, IMarkGraphic } from '../../mark/interface/common';
import type { IElementFilterOptions, IElementHighlightOptions, IElementSelectTriggerOff } from '../interface/trigger';
import type { GraphicEventType } from '@visactor/vrender-core';
import type { IBaseInteractionSpec } from '../interface/spec';
export declare const parseTriggerOffOfSelect: (triggerOff: IElementSelectTriggerOff | IElementSelectTriggerOff[]) => {
    eventNames: GraphicEventType[];
    resetType: ("self" | "view" | "timeout")[];
};
export declare const groupMarksByState: (marks: IMark[], states: string[]) => Record<string, number[]>;
export declare const filterMarksOfInteraction: (interactionSpec: IBaseInteractionSpec, marks: IMark[]) => IMark[];
export declare const generateFilterValue: (options: IElementFilterOptions) => (g: IMarkGraphic) => any;
export declare const highlightDefaultOptions: Partial<IElementHighlightOptions>;
