import type { IPoint } from '../../typings/coordinate';
import type { IComponent } from '../interface';
export type ProjectionType = 'albers' | 'albersUsa' | 'azimuthalEqualArea' | 'azimuthalEquidistant' | 'conicConformal' | 'conicEqualArea' | 'conicEquidistant' | 'equalEarth' | 'equirectangular' | 'gnomonic' | 'identity' | 'mercator' | 'naturalEarth1' | 'orthographic' | 'stereographic' | 'transverseMercator';
export interface IProjectionSpec {
    name: string;
    type: ProjectionType;
    zoom?: number;
    center?: [number, number];
}
export interface IGeoCoordinate extends IComponent {
    projectionSpec: IProjectionSpec;
    longitudeField?: string;
    latitudeField?: string;
    dataToPosition: (values: any[]) => IPoint;
    dispatchZoom: (zoomDelta: number, center?: {
        x: number;
        y: number;
    }) => void;
}
export interface IGeoCoordinateHelper {
    longitudeField?: string;
    latitudeField?: string;
    dataToPosition: (values: [number, number]) => IPoint;
    dataToLatitude: (lat: number) => number;
    dataToLongitude: (lon: number) => number;
    shape: (datum: any) => string;
    getCoordinateId: () => number;
}
export interface IGeoCoordinateSpec {
    projection: Omit<IProjectionSpec, 'name'>;
}
