import type { IMarkArea, IMarkAreaSpec } from './interface';
import { ComponentTypeEnum } from '../../interface/type';
import { MarkArea as MarkAreaComponent } from '@visactor/vrender-components';
import type { Maybe } from '@visactor/vutils';
import { BaseMarker } from '../base-marker';
import type { IGroup } from '@visactor/vrender-core';
import type { IModelSpecInfo } from '../../../model/interface';
export declare class MarkArea extends BaseMarker<IMarkAreaSpec> implements IMarkArea {
    static type: ComponentTypeEnum;
    type: ComponentTypeEnum;
    name: string;
    static specKey: string;
    specKey: string;
    layoutZIndex: number;
    protected _markerComponent: MarkAreaComponent;
    static getSpecInfo(chartSpec: any): Maybe<IModelSpecInfo[]>;
    protected _createMarkerComponent(): IGroup;
    protected _markerLayout(): void;
    protected _initDataView(): void;
}
export declare const registerMarkArea: () => void;
