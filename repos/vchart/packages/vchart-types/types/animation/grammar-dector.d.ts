import { AnimationPlanner } from './animation-planner';
import type { IMarkGraphic } from '../mark/interface';
import type { IAnimationConfig, IAnimationSplitStrategy } from './interface';
import type { BaseMark } from '../mark';
export interface IDetectionResult {
    hasExit: boolean;
    hasUpdate: boolean;
    hasEnter: boolean;
    hasAppear: boolean;
    exitGraphics: IMarkGraphic[];
    updateGraphics: IMarkGraphic[];
    enterGraphics: IMarkGraphic[];
    appearGraphics: IMarkGraphic[];
}
export declare class GrammarDetector {
    private mark;
    private splitStrategies;
    constructor(mark: BaseMark<any>);
    registerStrategy(strategy: IAnimationSplitStrategy): void;
    detect(graphics: IMarkGraphic[], graphicMap: Map<string, IMarkGraphic>): IDetectionResult;
    createPlanners(result: IDetectionResult, animationConfig: Record<string, IAnimationConfig[]>): AnimationPlanner[];
}
