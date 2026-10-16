import type { IMarkGraphic } from '../mark/interface';
export declare const setGraphicStates: (graphic: IMarkGraphic, nextStates?: string[] | null, hasAnimation?: boolean) => void;
export declare const addGraphicState: (graphic: IMarkGraphic, state: string, keepCurrentStates?: boolean, hasAnimation?: boolean) => void;
export declare const removeGraphicState: (graphic: IMarkGraphic, state: string | string[], hasAnimation?: boolean) => void;
