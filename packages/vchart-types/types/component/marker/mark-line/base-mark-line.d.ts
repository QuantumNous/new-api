import type { IMarkLine, IMarkLineSpec } from './interface';
import type { MarkArcLineAttrs, MarkLineAttrs } from '@visactor/vrender-components';
import type { MarkLine as MarkLineComponent, MarkArcLine as MarkArcLineComponent } from '@visactor/vrender-components';
import { BaseMarker } from '../base-marker';
import type { IGroup } from '@visactor/vrender-core';
export declare abstract class BaseMarkLine extends BaseMarker<IMarkLineSpec> implements IMarkLine {
    static specKey: string;
    specKey: string;
    layoutZIndex: number;
    protected abstract _newMarkLineComponent(attr: MarkLineAttrs | MarkArcLineAttrs): MarkLineComponent | MarkArcLineComponent;
    protected abstract _computePointsAttr(): any;
    static _getMarkerCoordinateType(markerSpec: any): string;
    protected _createMarkerComponent(): IGroup;
    protected _getUpdateMarkerAttrs(): any;
    protected _markerLayout(): void;
    protected _initDataView(): void;
}
