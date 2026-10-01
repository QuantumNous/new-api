import type { IMorphConfig } from '../animation/spec';
import type { IMark } from '../mark/interface';
import type { DiffResult } from '../typings/common';
import type { RenderMode } from '../typings/spec';
export declare function toRenderMode(mode: RenderMode): any;
export declare function traverseGroupMark<T>(group: IMark, apply: (mark: IMark) => T, filter?: (mark: IMark) => boolean, leafFirst?: boolean, stop?: boolean): T | undefined;
export declare function findSimpleMarks(groups: IMark[]): IMark[];
export declare function diffUpdateByGroup(prev: IMark[], next: IMark[], prevKey: (datum: IMark) => string, nextKey: (datum: IMark) => string): {
    prev: IMark[];
    next: IMark[];
    update: {
        prev: IMark[];
        next: IMark[];
    }[];
};
export declare function diffMarks(prevMarks: IMark[], nextMarks: IMark[], runningConfig: IMorphConfig): DiffResult<IMark[], IMark[]>;
