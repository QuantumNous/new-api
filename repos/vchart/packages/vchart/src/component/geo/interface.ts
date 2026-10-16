import type { IPoint } from '../../typings/coordinate';
import type { IComponent } from '../interface';

export type ProjectionType =
  | 'albers'
  | 'albersUsa'
  | 'azimuthalEqualArea'
  | 'azimuthalEquidistant'
  | 'conicConformal'
  | 'conicEqualArea'
  | 'conicEquidistant'
  | 'equalEarth'
  | 'equirectangular'
  | 'gnomonic'
  | 'identity'
  | 'mercator'
  | 'naturalEarth1'
  | 'orthographic'
  | 'stereographic'
  | 'transverseMercator';

export interface IProjectionSpec {
  name: string;
  /**
   * 地理映射类型
   */
  type: ProjectionType;
  /**
   * 初始化缩放倍数
   * @default 1
   */
  zoom?: number;
  /**
   * 初始化聚焦的经纬度
   */
  center?: [number, number];
}

// 坐标系统属于region下的内容
// 1. 同一个region下的coordinate应该一致
// 2. region只有一个坐标系对象
export interface IGeoCoordinate extends IComponent {
  projectionSpec: IProjectionSpec;

  longitudeField?: string;
  latitudeField?: string;

  dataToPosition: (values: any[]) => IPoint;
  dispatchZoom: (zoomDelta: number, center?: { x: number; y: number }) => void;
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
