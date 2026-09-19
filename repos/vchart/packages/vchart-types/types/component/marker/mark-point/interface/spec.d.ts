import type { Datum } from '../../../../typings/common';
import type { IComponent } from '../../../interface';
import type { IDataPointSpec, IDataPos, IDataPosCallback, IMarkerSpec, IMarkerSupportSeries, IMarkerSymbol, MarkerPositionPoint, OffsetPoint } from '../../interface';
import type { IMarkPointTheme } from './theme';
import type { BaseMarkerAnimation, MarkPointAnimationType } from '@visactor/vrender-components';
export type IMarkPoint = IComponent;
export type IMarkPointSpec = IMarkerSpec & (IMarkPointXYSpec | IMarkPointAngleRadiusSpec | IMarkPointGeoNameSpec | IMarkPointCoordinateSpec | IMarkPointPositionsSpec) & IMarkPointTheme<IMarkerSymbol> & BaseMarkerAnimation<MarkPointAnimationType>;
export type IMarkPointXYSpec = {
    y: IDataPos | IDataPosCallback;
    x: IDataPos | IDataPosCallback;
};
export type IMarkPointAngleRadiusSpec = {
    angle: IDataPos | IDataPosCallback;
    radius: IDataPos | IDataPosCallback;
};
export type IMarkPointGeoNameSpec = {
    areaName: string | IDataPosCallback;
};
export type IMarkPointCoordinateSpec = {
    coordinate: IDataPointSpec | ((seriesData: Datum[], relativeSeries: IMarkerSupportSeries) => IDataPointSpec);
    coordinatesOffset?: OffsetPoint;
};
export type IMarkPointPositionsSpec = {
    position: MarkerPositionPoint | ((seriesData: Datum[], relativeSeries: IMarkerSupportSeries) => MarkerPositionPoint);
    regionRelative?: boolean;
};
