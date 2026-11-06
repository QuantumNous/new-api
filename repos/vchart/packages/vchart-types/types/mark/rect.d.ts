import type { IRectMarkSpec } from '../typings/visual';
import { BaseMark } from './base/base-mark';
import type { IMarkStyle, IRectMark } from './interface';
import { MarkTypeEnum } from './interface/type';
export declare class RectMark extends BaseMark<IRectMarkSpec> implements IRectMark {
    static readonly type = MarkTypeEnum.rect;
    readonly type = MarkTypeEnum.rect;
    protected _getDefaultStyle(): IMarkStyle<IRectMarkSpec>;
}
export declare const registerRectMark: () => void;
