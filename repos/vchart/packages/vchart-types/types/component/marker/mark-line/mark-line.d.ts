import type { IMarkLine, IMarkLineSpec } from './interface';
import { ComponentTypeEnum } from '../../interface/type';
import { MarkLine as MarkLineComponent } from '@visactor/vrender-components';
import type { Maybe } from '@visactor/vutils';
import { BaseMarker } from '../base-marker';
import type { IGroup } from '@visactor/vrender-core';
import type { IModelSpecInfo } from '../../../model/interface';
export declare class MarkLine extends BaseMarker<IMarkLineSpec> implements IMarkLine {
    static type: ComponentTypeEnum;
    type: ComponentTypeEnum;
    name: string;
    static specKey: string;
    specKey: string;
    layoutZIndex: number;
    protected _markerComponent: MarkLineComponent;
    private _isXYLayout;
    static getSpecInfo(chartSpec: any): Maybe<IModelSpecInfo[]>;
    protected _createMarkerComponent(): IGroup;
    protected _markerLayout(): void;
    protected _initDataView(): void;
}
export declare const registerMarkLine: () => void;
