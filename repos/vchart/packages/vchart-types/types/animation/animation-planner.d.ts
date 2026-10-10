import type { IMarkGraphic } from '../mark/interface';
import type { IAnimationConfig } from './interface';
import type { IGroup } from '@visactor/vrender-core';
export declare class AnimationPlanner {
    state: string;
    graphics: IMarkGraphic[];
    private config;
    private beforeExecute?;
    private afterExecute?;
    constructor(state: string, graphics: IMarkGraphic[], config: IAnimationConfig[], beforeExecute?: (graphics: IMarkGraphic[]) => void, afterExecute?: (graphics: IMarkGraphic[]) => void);
    execute(product?: IGroup, onComplete?: () => void): void;
    executeOnGroup(product: IGroup, onComplete?: () => void): void;
}
