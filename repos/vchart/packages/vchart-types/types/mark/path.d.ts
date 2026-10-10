import type { IPathMarkSpec } from '../typings/visual';
import { BaseMark } from './base/base-mark';
import type { IMarkStyle, IPathMark } from './interface';
import { MarkTypeEnum } from './interface/type';
export declare class PathMark extends BaseMark<IPathMarkSpec> implements IPathMark {
    static readonly type = MarkTypeEnum.path;
    readonly type = MarkTypeEnum.path;
    protected _getDefaultStyle(): IMarkStyle<IPathMarkSpec>;
}
export declare const registerPathMark: () => void;
