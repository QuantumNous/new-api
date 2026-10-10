import type { utilFunctionCtx } from '../../typings/params';
import type { IChart } from '../../chart/interface/chart';
import type { IBoundsLike } from '@visactor/vutils';
import type { IBaseLayout, IGridLayoutSpec, ElementSpec, ILayoutItem } from '../interface';
import type { IRect } from '../../typings/space';
type GridSize = {
    value: number;
    isUserSetting: boolean;
    isLayoutSetting: boolean;
};
export declare class GridLayout implements IBaseLayout {
    static type: string;
    private _chartLayoutRect;
    private _chartViewBox;
    protected _col: number;
    protected _row: number;
    protected _colSize: GridSize[];
    protected _rowSize: GridSize[];
    protected _colElements: ILayoutItem[][];
    protected _rowElements: ILayoutItem[][];
    protected _gridInfo: IGridLayoutSpec;
    protected _elementMap: Map<ILayoutItem, ElementSpec>;
    protected _onError: (...args: any[]) => void;
    constructor(gridInfo: IGridLayoutSpec, ctx: utilFunctionCtx);
    protected standardizationSpec(gridInfo: IGridLayoutSpec): void;
    protected initUserSetting(): void;
    protected setSizeFromUserSetting(userSetting: {
        index: number;
        size: number | ((maxSize: number) => number);
    }[], gridSize: GridSize[], gridMax: number, maxSize: number): void;
    protected clearLayoutSize(): void;
    protected getItemGridInfo(item: ILayoutItem): ElementSpec;
    protected getSizeFromGrid(spec: ElementSpec, type: 'col' | 'row'): number | undefined;
    protected getSizeFromUser(spec: ElementSpec, type: 'col' | 'row'): number | undefined;
    protected setItemLayoutSizeToGrid(item: ILayoutItem, gridSpec: ElementSpec): void;
    protected layoutGrid(type: 'col' | 'row'): void;
    protected getItemPosition(item: ILayoutItem): {
        x: number;
        y: number;
    };
    protected getItemLayoutRect(item: ILayoutItem): {
        width: number;
        height: number;
    };
    layoutItems(_chart: IChart, items: ILayoutItem[], chartLayoutRect: IRect, chartViewBox: IBoundsLike): void;
    private layoutAbsoluteItems;
    protected layoutOneItem(item: ILayoutItem, sizeType: 'user' | 'grid' | 'colGrid' | 'rowGrid', ignoreTag: boolean): void;
}
export declare const registerGridLayout: () => void;
export {};
