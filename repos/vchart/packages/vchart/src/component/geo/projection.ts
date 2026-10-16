import { createProjection } from '@visactor/vdataset';
import type { IProjectionSpec } from './interface';

// TODO: 待 vgrammar 补充上后修改回去
type GeoJsonFeatureSpec = any;
export class Projection {
  projection: any;

  constructor(projectionSpec: IProjectionSpec) {
    // TODO: vgrammar 类型问题
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this.projection = createProjection(projectionSpec.type)();
  }

  fit(start: number[], size: number[], features: GeoJsonFeatureSpec[]) {
    const fitData = { type: 'FeatureCollection', features };
    this.projection.fitExtent([start, size], fitData);
  }

  center(center: [number, number]) {
    this.projection?.center?.(center);
  }

  project(point: [number, number]) {
    return this.projection?.(point);
  }

  shape(data: GeoJsonFeatureSpec) {
    return this.projection?.path?.(data);
  }

  invert(point: [number, number]) {
    return this.projection?.invert?.(point);
  }

  scale(): number;
  scale(scale: number): void;
  scale(scale?: number): number | void {
    if (this.projection?.scale) {
      if (scale !== undefined) {
        this.projection.scale(scale);
      } else {
        return this.projection.scale() as number;
      }
    }
  }

  translate(): [number, number];
  translate(point: [number, number]): void;
  translate(point?: [number, number] | void) {
    if (this.projection?.scale) {
      if (point !== undefined) {
        this.projection.translate(point);
      } else {
        return this.projection.translate();
      }
    }
  }

  evaluate(start: number[], size: number[], features: GeoJsonFeatureSpec[]) {
    const tmp = this.projection.copy();
    return tmp?.fitExtent([start, size], {
      type: 'FeatureCollection',
      features
    });
  }
}
