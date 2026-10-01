import type { IMarkPoint, IMarkPointSpec } from './interface';
import { MarkPoint as MarkPointComponent } from '@visactor/vrender-components';
import { BaseMarker } from '../base-marker';
import type { IGroup } from '@visactor/vrender-core';
export declare abstract class BaseMarkPoint extends BaseMarker<IMarkPointSpec> implements IMarkPoint {
    static specKey: string;
    specKey: string;
    layoutZIndex: number;
    protected _markerComponent: MarkPointComponent;
    protected abstract _computePointsAttr(): any;
    static _getMarkerCoordinateType(markerSpec: any): string;
    protected _createMarkerComponent(): IGroup;
    protected _markerLayout(): void;
    protected _initDataView(): void;
}
