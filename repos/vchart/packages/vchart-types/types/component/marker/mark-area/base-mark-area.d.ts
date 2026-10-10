import type { IMarkArea, IMarkAreaSpec } from './interface';
import type { MarkArcAreaAttrs, MarkAreaAttrs } from '@visactor/vrender-components';
import type { MarkArea as MarkAreaComponent, MarkArcArea as MarkArcAreaComponent } from '@visactor/vrender-components';
import { BaseMarker } from '../base-marker';
import type { IGroup } from '@visactor/vrender-core';
export declare abstract class BaseMarkArea extends BaseMarker<IMarkAreaSpec> implements IMarkArea {
    static specKey: string;
    specKey: string;
    layoutZIndex: number;
    protected abstract _newMarkAreaComponent(attr: MarkAreaAttrs | MarkArcAreaAttrs): MarkAreaComponent | MarkArcAreaComponent;
    protected abstract _computePointsAttr(): any;
    static _getMarkerCoordinateType(markerSpec: any): string;
    protected _createMarkerComponent(): IGroup;
    protected _markerLayout(): void;
    protected _initDataView(): void;
}
