import type { IImageMarkSpec } from '../typings/visual';
import { BaseMark } from './base/base-mark';
import type { IImageMark, IMarkStyle } from './interface';
import { MarkTypeEnum } from './interface/type';
export declare class ImageMark extends BaseMark<IImageMarkSpec> implements IImageMark {
    static readonly type = MarkTypeEnum.image;
    readonly type = MarkTypeEnum.image;
    protected _getDefaultStyle(): IMarkStyle<IImageMarkSpec>;
}
export declare const registerImageMark: () => void;
