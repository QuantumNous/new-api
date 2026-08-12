import type { ILineMarkSpec } from '../typings/visual';
import { BaseLineMark } from './base/base-line';
import type { ILineMark, IMarkStyle } from './interface';
import { MarkTypeEnum } from './interface/type';
export declare class LineMark extends BaseLineMark<ILineMarkSpec> implements ILineMark {
    static readonly type = MarkTypeEnum.line;
    readonly type = MarkTypeEnum.line;
    protected _getDefaultStyle(): IMarkStyle<ILineMarkSpec>;
    protected _getIgnoreAttributes(): string[];
}
export declare const registerLineMark: () => void;
