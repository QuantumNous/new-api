import type { IArc3dMarkSpec } from '../typings';
import { BaseArcMark } from './arc';
import type { IArc3dMark } from './interface';
import { MarkTypeEnum } from './interface/type';
export declare class Arc3dMark extends BaseArcMark<IArc3dMarkSpec> implements IArc3dMark {
    static readonly type = MarkTypeEnum.arc3d;
    readonly type: MarkTypeEnum;
    protected _support3d?: boolean;
}
export declare const registerArc3dMark: () => void;
