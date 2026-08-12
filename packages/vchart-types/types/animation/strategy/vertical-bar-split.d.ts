import type { IMarkGraphic } from '../../mark/interface';
import type { BaseMark } from '../../mark';
import type { IAnimationSplitStrategy } from '../interface';
export declare class VerticalBarSplitStrategy implements IAnimationSplitStrategy {
    name: string;
    shouldApply(mark: BaseMark<any>, graphic: IMarkGraphic): boolean;
    split(mark: BaseMark<any>, graphic: IMarkGraphic): Array<{
        attrs: Record<string, any>;
        order: number;
    }>;
}
