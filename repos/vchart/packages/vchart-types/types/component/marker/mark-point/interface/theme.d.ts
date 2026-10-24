import type { IImageGraphicAttribute, IRichTextGraphicAttribute, IGroupGraphicAttribute } from '@visactor/vrender-core';
import type { IMarkPointItemPosition } from '@visactor/vrender-components';
import type { ILineMarkSpec, ISymbolMarkSpec } from '../../../../typings';
import type { IMarkerLabelSpec, IMarkerRef, IMarkerState, IMarkerSymbol, MarkerStateCallback, MarkerStateValue, MarkerStyleCallback } from '../../interface';
import type { IRegion } from '../../../../region/interface';
export type IOffsetCallback = (region: IRegion) => number;
export type IItemContentStyle = ISymbolMarkSpec | IImageGraphicAttribute | IGroupGraphicAttribute;
export interface IItemContent extends IMarkerRef {
    position?: keyof typeof IMarkPointItemPosition;
    offsetX?: number | 'regionRight' | 'regionLeft' | IOffsetCallback;
    offsetY?: number | 'regionTop' | 'regionBottom' | IOffsetCallback;
    confine?: boolean;
    type?: 'symbol' | 'text' | 'image' | 'custom';
    style?: IItemContentStyle | MarkerStyleCallback<IItemContentStyle> | IMarkerLabelSpec;
    state?: Record<MarkerStateValue, IItemContentStyle | MarkerStateCallback<IItemContentStyle>>;
    symbol?: Partial<IMarkerState<ISymbolMarkSpec>>;
    image?: Partial<IMarkerState<IImageGraphicAttribute>>;
    text?: IMarkerLabelSpec;
    richText?: Partial<IMarkerState<IRichTextGraphicAttribute>>;
    customMark?: Partial<IMarkerState<IGroupGraphicAttribute>>;
}
export type IItemLine<T extends Partial<IMarkerSymbol> = IMarkerSymbol> = {
    type?: 'type-s' | 'type-do' | 'type-po' | 'type-op' | 'type-arc';
    arcRatio?: number;
    visible?: boolean;
    decorativeLine?: {
        visible?: boolean;
        length?: number;
    };
    startSymbol?: T;
    endSymbol?: T;
    line?: Partial<IMarkerState<Omit<ILineMarkSpec, 'visible'>>>;
};
export interface IMarkPointTheme<T extends Partial<IMarkerSymbol> = Partial<IMarkerSymbol>> {
    itemLine?: IItemLine<T>;
    itemContent?: IItemContent;
    targetSymbol?: {
        offset?: number;
        visible?: boolean;
        size?: number;
    } & Partial<IMarkerState<ISymbolMarkSpec>>;
}
