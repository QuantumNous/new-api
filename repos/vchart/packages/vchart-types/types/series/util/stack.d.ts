import type { IStackCacheNode } from '../../util/data';
export declare function stackWithMinHeight(stackCache: IStackCacheNode, stackInverse: boolean, context: {
    isVertical: boolean;
    start: string;
    end: string;
    startMethod: string;
    endMethod: string;
    axisHelper: string;
}): void;
