import type { IMarkGraphic } from '../../mark/interface';
import type { BaseMark } from '../../mark';
import type { IAnimationSplitStrategy } from '../interface';
export declare class CustomSplitStrategy implements IAnimationSplitStrategy {
    name: string;
    private checkFn;
    private splitFn;
    constructor(name: string, checkFn: (mark: BaseMark<any>, graphic: IMarkGraphic) => boolean, splitFn: (mark: BaseMark<any>, graphic: IMarkGraphic) => Array<{
        attrs: Record<string, any>;
        order: number;
    }>);
    shouldApply(mark: BaseMark<any>, graphic: IMarkGraphic): boolean;
    split(mark: BaseMark<any>, graphic: IMarkGraphic): Array<{
        attrs: Record<string, any>;
        order: number;
    }>;
}
