import type { IRect3dMarkSpec } from '../typings/visual';
import { BaseMark } from './base/base-mark';
import type { IMarkStyle, IRect3dMark } from './interface';
import { MarkTypeEnum } from './interface/type';
export declare class Rect3dMark extends BaseMark<IRect3dMarkSpec> implements IRect3dMark {
    static readonly type = MarkTypeEnum.rect3d;
    readonly type = MarkTypeEnum.rect3d;
    protected _getDefaultStyle(): IMarkStyle<IRect3dMarkSpec>;
}
export declare const registerRect3dMark: () => void;
