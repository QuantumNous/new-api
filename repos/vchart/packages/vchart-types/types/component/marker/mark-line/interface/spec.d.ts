import type { DataView } from '@visactor/vdataset';
import type { IComponent } from '../../../interface';
import type { IAggrType, IMarkerAttributeContext, IMarkerPositionsSpec, IDataPointSpec, IMarkerSpec, IDataPos, IDataPosCallback, IMarkerLabelSpec, IMarkerCrossSeriesSpec, OffsetPoint, MarkerStateValue, MarkerStateCallback, IMarkerSupportSeries } from '../../interface';
import type { IRegressType } from '../../mark-area/interface';
import type { IMarkLineTheme } from './theme';
import type { Datum, ILineMarkSpec, IPoint } from '../../../../typings';
import type { BaseMarkerAnimation, MarkCommonLineAnimationType } from '@visactor/vrender-components';
import type { IRegion } from '../../../../region/interface';
export type IMarkLine = IComponent;
export type IMarkLineSpec = (IMarkerSpec & (IMarkLineXSpec | IMarkLineYSpec | IMarkLineXYSpec | IMarkLineXYY1Spec | IMarkLineYXX1Spec | IMarkLineAngleSpec | IMarkLineRadiusSpec | IMarkLineAngRadRad1Spec | IMarkLineRadAngAng1Spec | IMarkLineAngRadSpec | IMarkLineCoordinateSpec | IMarkerPositionsSpec) & IMarkLineTheme & BaseMarkerAnimation<MarkCommonLineAnimationType>) | (IStepMarkLineSpec & BaseMarkerAnimation<MarkCommonLineAnimationType>);
export interface IMarkLineXSpec extends IMarkerCrossSeriesSpec {
    x: IDataPos | IDataPosCallback;
}
export interface IMarkLineXYY1Spec extends IMarkerCrossSeriesSpec {
    x: IDataPos | IDataPosCallback;
    y: IDataPos | IDataPosCallback;
    y1: IDataPos | IDataPosCallback;
}
export interface IMarkLineYSpec extends IMarkerCrossSeriesSpec {
    y: IDataPos | IDataPosCallback;
}
export interface IMarkLineYXX1Spec extends IMarkerCrossSeriesSpec {
    y: IDataPos | IDataPosCallback;
    x: IDataPos | IDataPosCallback;
    x1: IDataPos | IDataPosCallback;
}
export interface IMarkLineXYSpec extends IMarkerCrossSeriesSpec {
    x: IDataPos | IDataPosCallback;
    y: IDataPos | IDataPosCallback;
    x1: IDataPos | IDataPosCallback;
    y1: IDataPos | IDataPosCallback;
}
export interface IMarkLineAngleSpec extends IMarkerCrossSeriesSpec {
    angle: IDataPos | IDataPosCallback;
}
export interface IMarkLineRadiusSpec extends IMarkerCrossSeriesSpec {
    radius: IDataPos | IDataPosCallback;
}
export interface IMarkLineAngRadRad1Spec extends IMarkerCrossSeriesSpec {
    angle: IDataPos | IDataPosCallback;
    radius: IDataPos | IDataPosCallback;
    radius1: IDataPos | IDataPosCallback;
}
export interface IMarkLineRadAngAng1Spec extends IMarkerCrossSeriesSpec {
    angle: IDataPos | IDataPosCallback;
    angle1: IDataPos | IDataPosCallback;
    radius: IDataPos | IDataPosCallback;
}
export interface IMarkLineAngRadSpec extends IMarkerCrossSeriesSpec {
    angle: IDataPos | IDataPosCallback;
    angle1: IDataPos | IDataPosCallback;
    radius: IDataPos | IDataPosCallback;
    radius1: IDataPos | IDataPosCallback;
}
export type IMarkLineCoordinateSpec = {
    coordinates: IDataPointSpec[] | ((seriesData: Datum[], relativeSeries: IMarkerSupportSeries) => IDataPointSpec[]);
    coordinatesOffset?: OffsetPoint[];
    process?: {
        x: IAggrType;
    } | {
        y: IAggrType;
    } | {
        xy: IRegressType;
    };
};
export type IStepMarkLineSpec = IMarkerSpec & {
    type: 'type-step';
    connectDirection: 'top' | 'bottom' | 'left' | 'right';
    expandDistance?: number | string | ((markerData: DataView, context: IMarkerAttributeContext & {
        region: IRegion;
        startRegion: IRegion;
        endRegion: IRegion;
        coordinatePoints: IPoint[];
    }) => number | string);
    label?: IMarkerLabelSpec;
    line?: {
        multiSegment?: boolean;
        mainSegmentIndex?: number;
        style?: ILineMarkSpec | ILineMarkSpec[];
        state?: Record<MarkerStateValue, ILineMarkSpec | ILineMarkSpec[] | MarkerStateCallback<ILineMarkSpec | ILineMarkSpec[]>>;
    };
} & Omit<IMarkLineTheme, 'label' | 'line'> & ({
    coordinates: [IDataPointSpec, IDataPointSpec] | ((seriesData: Datum[], relativeSeries: IMarkerSupportSeries) => [IDataPointSpec, IDataPointSpec]);
    process?: {
        x: IAggrType;
    } | {
        y: IAggrType;
    } | {
        xy: IRegressType;
    };
} | {
    positions: [IPoint, IPoint] | ((seriesData: Datum[], relativeSeries: IMarkerSupportSeries) => [IPoint, IPoint]);
    regionRelative?: boolean;
});
