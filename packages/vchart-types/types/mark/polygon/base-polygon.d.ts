import type { ICommonSpec } from '../../typings/visual';
import { BaseMark } from '../base/base-mark';
import type { IMarkStyle } from '../interface';
export declare class BasePolygonMark<T extends ICommonSpec> extends BaseMark<T> {
    protected _getDefaultStyle(): IMarkStyle<T>;
}
