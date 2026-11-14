import type { IMarkPoint, IMarkPointSpec } from './interface';
import { ComponentTypeEnum } from '../../interface/type';
import { MarkPoint as MarkPointComponent } from '@visactor/vrender-components';
import type { Maybe } from '@visactor/vutils';
import { BaseMarker } from '../base-marker';
import type { IGroup } from '@visactor/vrender-core';
import type { IModelSpecInfo } from '../../../model/interface';
export declare class MarkPoint extends BaseMarker<IMarkPointSpec> implements IMarkPoint {
    static type: ComponentTypeEnum;
    type: ComponentTypeEnum;
    name: string;
    static specKey: string;
    specKey: string;
    layoutZIndex: number;
    protected _markerComponent: MarkPointComponent;
    static getSpecInfo(chartSpec: any): Maybe<IModelSpecInfo[]>;
    protected _createMarkerComponent(): IGroup;
    protected _markerLayout(): void;
    protected _initDataView(): void;
}
export declare const registerMarkPoint: () => void;
