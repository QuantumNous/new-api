import type { ITextMark } from '../../mark/interface';
import type { DirectionType } from '../../typings/space';
import type { ISeries } from '../interface';
export declare function setRectLabelPos(component: ISeries, labelMark: ITextMark, position: string, offset: number, x: (datum: any) => number, x1: (datum: any) => number, y: (datum: any) => number, y1: (datum: any) => number, direction: () => DirectionType): void;
