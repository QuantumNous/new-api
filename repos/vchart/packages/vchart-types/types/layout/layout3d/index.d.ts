import type { IChart } from '../../chart/interface/chart';
import type { IBoundsLike } from '@visactor/vutils';
import type { IRect } from '../../typings/space';
import type { IBaseLayout, ILayoutItem } from '../interface';
import type { IOffset } from '../base-layout';
import { Layout } from '../base-layout';
export declare class Layout3d extends Layout implements IBaseLayout {
    static type: string;
    layoutItems(_chart: IChart, items: ILayoutItem[], chartLayoutRect: IRect, chartViewBox: IBoundsLike): void;
    protected layoutZAxisItems(zItems: ILayoutItem[], zRect: IRect): void;
    getItemComputeLayoutRect(item: ILayoutItem, extraOffset?: IOffset): {
        width: number;
        height: number;
    };
    protected _checkAutoIndent(items: ILayoutItem[]): {
        top: number;
        left: number;
        bottom: number;
        right: number;
    };
}
export declare const registerLayout3d: () => void;
