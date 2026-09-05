import type { IAreaMarkSpec } from '../typings/visual';
import { BaseLineMark } from './base/base-line';
import type { IAreaMark, IMarkStyle } from './interface';
import { MarkTypeEnum } from './interface/type';
export declare class AreaMark extends BaseLineMark<IAreaMarkSpec> implements IAreaMark {
    static readonly type = MarkTypeEnum.area;
    readonly type = MarkTypeEnum.area;
    protected _getDefaultStyle(): IMarkStyle<IAreaMarkSpec>;
    protected _getSegmentAttributes(): string[];
    protected _getIgnoreAttributes(): string[];
    _isValidPointChannel: (channel: string) => boolean;
}
export declare const registerAreaMark: () => void;
