import type { IGraphic } from '@visactor/vrender-core';
import type { IPadding, IOrientType, StringOrNumber } from '../../typings';
import type { IPathMarkSpec, IRectMarkSpec, ISymbolMarkSpec, ITextMarkSpec } from '../../typings/visual';
import type { IModelSpec } from '../../model/interface';
export type LabelPosition = IOrientType | 'outer';
export interface IMapLabelSpec extends IMapLabelTheme, Pick<IModelSpec, 'id'> {
    seriesId: StringOrNumber;
    nameField?: string;
    valueField?: string;
    trigger?: 'hover' | 'click' | 'none';
}
export type IMapLabelNodes = 'nameLabel' | 'valueLabel' | 'icon' | 'labelBackground' | 'container';
export type MapLabelSceneNodeMap = Partial<Record<IMapLabelNodes, IGraphic>>;
export interface IMapLabelTheme {
    visible?: boolean;
    offset?: number;
    space?: number;
    position?: LabelPosition;
    nameLabel?: {
        visible?: boolean;
        style?: ITextMarkSpec;
    };
    valueLabel?: {
        visible?: boolean;
        style?: ITextMarkSpec;
    };
    icon?: {
        visible?: boolean;
        style?: ISymbolMarkSpec;
    };
    background?: {
        visible?: boolean;
        padding?: IPadding;
        style?: IRectMarkSpec;
    };
    leader?: {
        visible?: boolean;
        style?: IPathMarkSpec;
    };
}
