import type { BaseMarkerAnimation, CommonMarkAreaAnimationType } from '@visactor/vrender-components';
import type { IComponent } from '../../../interface';
import type { IMarkerPositionsSpec, IDataPointSpec, IDataPos, IMarkerSpec, IDataPosCallback, IMarkerCrossSeriesSpec, OffsetPoint, IMarkerSupportSeries } from '../../interface';
import type { IMarkAreaTheme } from './theme';
import type { Datum } from '../../../../typings/common';
export type IMarkArea = IComponent;
export type IRegressType = 'regression';
export type IMarkAreaSpec = IMarkerSpec & (IMarkAreaXSpec | IMarkAreaYSpec | IMarkAreaXYSpec | IMarkAreaAngleSpec | IMarkAreaRadiusSpec | IMarkAreaAngleRadiusSpec | IMarkAreaCoordinateSpec | IMarkerPositionsSpec) & IMarkAreaTheme & BaseMarkerAnimation<CommonMarkAreaAnimationType>;
export interface IMarkAreaXSpec extends IMarkerCrossSeriesSpec {
    x: IDataPos | IDataPosCallback;
    x1: IDataPos | IDataPosCallback;
}
export interface IMarkAreaYSpec extends IMarkerCrossSeriesSpec {
    y: IDataPos | IDataPosCallback;
    y1: IDataPos | IDataPosCallback;
}
export interface IMarkAreaXYSpec extends IMarkerCrossSeriesSpec {
    x: IDataPos | IDataPosCallback;
    x1: IDataPos | IDataPosCallback;
    y: IDataPos | IDataPosCallback;
    y1: IDataPos | IDataPosCallback;
}
export interface IMarkAreaAngleSpec extends IMarkerCrossSeriesSpec {
    angle: IDataPos | IDataPosCallback;
    angle1: IDataPos | IDataPosCallback;
}
export interface IMarkAreaRadiusSpec extends IMarkerCrossSeriesSpec {
    radius: IDataPos | IDataPosCallback;
    radius1: IDataPos | IDataPosCallback;
}
export interface IMarkAreaAngleRadiusSpec extends IMarkerCrossSeriesSpec {
    angle: IDataPos | IDataPosCallback;
    angle1: IDataPos | IDataPosCallback;
    radius: IDataPos | IDataPosCallback;
    radius1: IDataPos | IDataPosCallback;
}
export type IMarkAreaCoordinateSpec = {
    coordinates: IDataPointSpec[] | ((seriesData: Datum[], relativeSeries: IMarkerSupportSeries) => IDataPointSpec[]);
    coordinatesOffset?: OffsetPoint[];
};
