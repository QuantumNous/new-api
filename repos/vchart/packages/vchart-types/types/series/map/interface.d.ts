import type { IPathMarkSpec, ITextMarkSpec } from '../../typings/visual';
import type { IMarkSpec, IMarkTheme, ISeriesSpec } from '../../typings/spec/common';
import type { IAnimationSpec } from '../../animation/spec';
import type { ILabelSpec } from '../../component/label/interface';
type LineMarks = 'area';
export interface IMapSeriesSpec extends ISeriesSpec, IAnimationSpec<LineMarks, 'fadeIn'> {
    type: 'map';
    map: string;
    nameField?: string;
    valueField?: string;
    nameProperty?: string;
    centroidProperty?: string;
    nameMap?: {
        [key: string]: string;
    };
    area?: IMarkSpec<Omit<IPathMarkSpec, 'smoothScale'>>;
    defaultFillColor?: string;
    showDefaultName?: boolean;
    label?: Omit<ILabelSpec, 'position'>;
}
export interface IMapSeriesTheme {
    defaultFillColor?: string;
    label?: Partial<IMarkTheme<ITextMarkSpec> & {
        offset?: number;
        position?: string;
    }>;
    area?: Partial<IMarkTheme<Omit<IPathMarkSpec, 'smoothScale'>>>;
}
export interface GeometryData {
    type: 'Point' | 'MultiPoint' | 'LineString' | 'MultiLineString' | 'Polygon' | 'MultiPolygon' | 'GeometryCollection';
    coordinates?: [number, number] | [number, number][] | [number, number][][] | [number, number][][][];
    arcs?: number[][];
}
export interface FeatureData {
    type: 'Feature';
    geometry: GeometryData;
    properties?: Record<string, any>;
}
export {};
