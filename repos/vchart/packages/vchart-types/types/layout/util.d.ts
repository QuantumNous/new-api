import type { Layout } from './base-layout';
import type { ILayoutItem } from './interface';
import type { ILayoutRect } from '../typings';
export type IRecompute = {
    recomputeWidth: boolean;
    recomputeHeight: boolean;
};
export declare function layoutLeftInlineItems(items: ILayoutItem[], layout: Layout, limitHeight: number, recompute: IRecompute): void;
export declare function layoutRightInlineItems(items: ILayoutItem[], layout: Layout, limitHeight: number, recompute: IRecompute): void;
export declare function layoutTopInlineItems(items: ILayoutItem[], layout: Layout, limitWidth: number, recompute: IRecompute): void;
export declare function layoutBottomInlineItems(items: ILayoutItem[], layout: Layout, limitWidth: number, recompute: IRecompute): void;
export declare function getItemLayoutWithTag(item: ILayoutItem, layout: Layout, recompute: IRecompute, setRectToItem?: boolean): {
    layoutRect: import("@visactor/vutils").IBoundsLike | {
        width: number;
        height: number;
    };
    rect: ILayoutRect;
    layoutTag: boolean;
};
