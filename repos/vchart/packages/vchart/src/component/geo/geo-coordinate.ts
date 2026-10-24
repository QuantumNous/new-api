import { LayoutZIndex } from './../../constant/layout';
/* eslint-disable no-duplicate-imports */
import type { IPoint } from '../../typings/coordinate';
import { Projection } from './projection';
import type { IEffect, IModelRenderOption, IModelSpecInfo } from '../../model/interface';
import { ComponentTypeEnum } from '../interface/type';
import { BaseComponent } from '../base/base-component';
import type { IGeoRegionSpec, IRegion, RegionSpec } from '../../region/interface';
import { eachSeries } from '../../util/model';
import { mergeSpec } from '@visactor/vutils-extension';
import { ChartEvent } from '../../constant/event';
import { PREFIX } from '../../constant/base';
import type { ICartesianSeries, IGeoSeries } from '../../series/interface';
import { SeriesTypeEnum } from '../../series/interface/type';
import type { IGeoCoordinate, IGeoCoordinateHelper, IGeoCoordinateSpec, IProjectionSpec } from './interface';
import type { BaseEventParams, ExtendEventParam, PanEventParam, ZoomEventParam } from '../../event/interface';
import type { StringOrNumber } from '../../typings';
import type { IZoomable, ZoomEventParams } from '../../interaction/zoom/zoomable';
import { Zoomable } from '../../interaction/zoom/zoomable';
import { isValid, mixin, isNil, Matrix, isEqual, isBoolean } from '@visactor/vutils';
import type { Maybe } from '@visactor/vutils';
import { Factory } from '../../core/factory';
import type { MapSeries } from '../../series';
import { DEFAULT_MAP_LOOK_UP_KEY } from '../../constant/data';

export function projectionName(key: string, id: number) {
  return `${PREFIX}_${id}_${key}`;
}
export class GeoCoordinate extends BaseComponent<IGeoRegionSpec> implements IGeoCoordinate {
  static type = ComponentTypeEnum.geoCoordinate;
  type = ComponentTypeEnum.geoCoordinate;
  name: string = ComponentTypeEnum.geoCoordinate;

  layoutType: 'none' = 'none';
  protected layoutZIndex: number = LayoutZIndex.Mark;

  _longitudeField?: string;
  get longitudeField() {
    return this._longitudeField;
  }

  _latitudeField?: string;
  get latitudeField() {
    return this._latitudeField;
  }

  protected _projectionSpec: IProjectionSpec = {
    name: projectionName(this.type, this.id),
    type: 'mercator'
  };
  get projectionSpec() {
    return this._projectionSpec;
  }
  setProjection(projectionSpec: IGeoCoordinateSpec['projection']) {
    this._projectionSpec = {
      ...projectionSpec,
      name: this._projectionSpec.name
    };
  }

  protected _projection!: Projection;

  protected _centerCache: Map<StringOrNumber, { x: number; y: number }>;

  private _actualScale = 1;

  getZoom() {
    return this._actualScale;
  }

  private _initialScale = 1;

  static getSpecInfo(chartSpec: any): Maybe<IModelSpecInfo[]> {
    if (isNil(chartSpec)) {
      return null;
    }
    const specInfos: IModelSpecInfo[] = [];
    chartSpec.region.forEach((r: RegionSpec, i: number) => {
      if (r.coordinate === 'geo') {
        // 去除 padding 配置，避免重复计算
        const spec = { ...r, padding: 0 };
        specInfos.push({
          spec,
          regionIndex: i,
          type: ComponentTypeEnum.geoCoordinate,
          specInfoPath: ['component', 'geoCoordinate', i]
        } as any);
      }
    });
    return specInfos;
  }

  effect: IEffect = {
    scaleUpdate: () => {
      this.coordinateHelper();
    }
  };

  setAttrFromSpec() {
    super.setAttrFromSpec();

    if (this._spec.roam) {
      (this as unknown as IZoomable).initZoomable(this.event, this._option.mode);
    }

    this._projectionSpec = mergeSpec(this._projectionSpec, this._spec.projection);
    if (this._projectionSpec.zoom > this._spec.zoomLimit?.max) {
      this._projectionSpec.zoom = this._spec.zoomLimit.max;
    }
    if (this._projectionSpec.zoom < this._spec.zoomLimit?.min) {
      this._projectionSpec.zoom = this._spec.zoomLimit.min;
    }

    this._actualScale = this._projectionSpec.zoom ?? 1;
    this._initialScale = this._actualScale;
    this._longitudeField = this._spec.longitudeField;
    this._latitudeField = this._spec.latitudeField;
  }

  // life cycle
  created() {
    super.created();
    this._regions = this._option.getRegionsInIndex([(this._option as any).regionIndex]);
    this.initProjection();
    this.coordinateHelper();
    this.initEvent();
    this._initCenterCache();
    // FIXME: 这里是在开启缩放时，处理关联的symbol等mark，在地图缩放时应该同步缩放
    // this.rescaleMark();
  }

  /**
   * 处理图表缩放事件，按 zoomRate 调整缩放强度
   * 使用幂次映射保持缩放因子始终为正：scale' = (zoomDelta)^zoomRate
   */
  private _handleChartZoom = (params: ZoomEventParams, event?: BaseEventParams['event']) => {
    const rate = isValid(this._spec.zoomRate) ? Math.max(0, this._spec.zoomRate as number) : 1;
    const delta = Math.max(params.zoomDelta, 1e-6);
    let scale = Math.pow(delta, rate);
    // check if the next scale will outrange
    const _lastActualScale = this._actualScale;
    this._actualScale *= scale;
    if (this._actualScale < this._spec.zoomLimit?.min) {
      this._actualScale = this._spec.zoomLimit?.min;
      scale = this._spec.zoomLimit?.min / _lastActualScale;
    } else if (this._actualScale > this._spec.zoomLimit?.max) {
      this._actualScale = this._spec.zoomLimit?.max;
      scale = this._spec.zoomLimit?.max / _lastActualScale;
    }
    this.zoom(scale, [params.zoomX, params.zoomY]);
    return { scale, totalScale: this._actualScale };
  };

  dispatchZoom(zoomDelta: number, center?: { x: number; y: number }) {
    const scaleCenter = center || {
      x: this.getLayoutStartPoint().x + this.getLayoutRect().width / 2,
      y: this.getLayoutStartPoint().y + this.getLayoutRect().height / 2
    };
    const { scale, totalScale } = this._handleChartZoom({ zoomDelta, zoomX: scaleCenter.x, zoomY: scaleCenter.y });
    if (scale !== 1) {
      this.event.emit('zoom', {
        scale,
        scaleCenter,
        totalScale,
        model: this
      } as unknown as ExtendEventParam);
    }
  }

  initEvent() {
    this.event.on(
      ChartEvent.scaleUpdate,
      { filter: ({ model }) => model?.id === this.id },
      this.effect.scaleUpdate.bind(this)
    );

    const { roam } = this._spec;
    if (roam) {
      let zoom = true;
      let drag = true;
      let blank = false;
      if (roam !== true) {
        zoom = roam.zoom ?? true;
        drag = roam.drag ?? true;
        blank = roam.blank ?? false;
      }
      zoom && (this as unknown as IZoomable).initZoomEventOfRegions(this._regions, null, this._handleChartZoom);
      drag && (this as unknown as IZoomable).initDragEventOfRegions(this._regions, blank ? null : () => true, this.pan);

      this._regions.forEach(r => {
        r.getSeries().forEach(s => {
          s.event.on('zoom', e => {
            s.handleZoom(e as ZoomEventParam);
            return true;
          });

          s.event.on('panmove', e => {
            s.handlePan(e as PanEventParam);
            return true;
          });
        });
      });
    }
  }

  initProjection() {
    this._projection = new Projection(this._projectionSpec);
    if (this._projection.projection === null) {
      this._option?.onError('unsupported projection type!');
      return;
    }
  }

  coordinateHelper() {
    const helper: IGeoCoordinateHelper = {
      longitudeField: this._longitudeField,
      latitudeField: this._latitudeField,
      dataToPosition: this.dataToPosition.bind(this),
      dataToLongitude: this.dataToLongitude.bind(this),
      dataToLatitude: this.dataToLatitude.bind(this),
      shape: this.shape.bind(this),
      getCoordinateId: () => this.id
    };

    this._regions.forEach(r => {
      r.getSeries().forEach(s => {
        if (s.type === SeriesTypeEnum.map || s.type === SeriesTypeEnum.pictogram) {
          (s as IGeoSeries).setCoordinateHelper(helper);
        } else {
          // 散点地图
          (s as ICartesianSeries).setXAxisHelper({
            ...helper,
            isContinuous: true,
            dataToPosition: (values: any[], option) => {
              let value = values[0];
              if (isNil(value) && option?.datum) {
                const nameFieldValue = option.datum[(s as ICartesianSeries).getDimensionField()[0]];
                value = this._centerCache.get(nameFieldValue)?.x;
              }
              return this.dataToLongitude(value);
            },
            valueToPosition: (value: any, option) => {
              if (isNil(value) && option?.datum) {
                const nameFieldValue = option.datum[(s as ICartesianSeries).getDimensionField()[0]];
                value = this._centerCache.get(nameFieldValue)?.x;
              }
              return this.dataToLongitude(value);
            },
            getFields: () => [this._longitudeField],
            getAxisType: () => this.type,
            getAxisId: () => this.id,
            isInverse: () => false
          });
          (s as unknown as ICartesianSeries).setYAxisHelper({
            ...helper,
            isContinuous: true,
            dataToPosition: (values: any[], option) => {
              let value = values[0];
              if (isNil(value) && option?.datum) {
                const nameFieldValue = option.datum[(s as ICartesianSeries).getDimensionField()[0]];
                value = this._centerCache.get(nameFieldValue)?.y;
              }
              return this.dataToLatitude(value);
            },
            valueToPosition: (value: any, option) => {
              if (isNil(value) && option?.datum) {
                const nameFieldValue = option.datum[(s as ICartesianSeries).getDimensionField()[0]];
                value = this._centerCache.get(nameFieldValue)?.y;
              }
              return this.dataToLatitude(value);
            },
            getFields: () => [this._latitudeField],
            getAxisType: () => this.type,
            getAxisId: () => this.id,
            isInverse: () => false
          });
        }
      });
    });
  }

  onLayoutEnd() {
    this.setLayoutRect(this._regions[0].getLayoutRect());
    this.setLayoutStartPosition(this._regions[0].getLayoutStartPoint());
    const { width, height } = this.getLayoutRect();
    const { translate, scale, center } = this.evaluateProjection([0, 0], [width, height]);
    translate && this._projection.translate(translate);
    scale && this._projection.scale(scale);
    center && this._projection.center(center);
    eachSeries(this._regions, s => {
      if (s.type === SeriesTypeEnum.map || s.type === SeriesTypeEnum.pictogram) {
        (s as MapSeries).areaPath?.clear();
        const pathGroup = s.getRootMark().getProduct();
        if (pathGroup) {
          if (pathGroup.attribute.postMatrix) {
            pathGroup.setAttributes({
              postMatrix: new Matrix()
            });
          }
        }
      }
    });
    this._actualScale = this._initialScale;

    super.onLayoutEnd();
  }

  // util
  protected collectFeatures() {
    const features: any[] = [];
    this._regions.forEach(r => {
      r.getSeries().forEach(s => {
        if (s.type === SeriesTypeEnum.map || s.type === SeriesTypeEnum.pictogram) {
          features.push(...((s as unknown as IGeoSeries).getMapViewData()?.latestData ?? []));
        }
      });
    });
    return features;
  }

  // API
  dataToPosition(values: number[] = []): IPoint {
    const point = this._projection?.project([values[0], values[1]]);
    return {
      x: point?.[0],
      y: point?.[1]
    };
  }

  dataToLatitude(lat: number): number {
    const point = this._projection?.project([0, lat]);
    return point?.[1];
  }

  dataToLongitude(lon: number): number {
    const point = this._projection?.project([lon, 0]);
    return point?.[0];
  }

  // interaction
  zoom(p: number, anchor: [number, number] = [0, 0]) {
    let s = this._projection?.scale() ?? 0;
    const t = this._projection?.translate() ?? [0, 0];
    let t_x = t[0];
    let t_y = t[1];
    s = s * p;
    t_x -= (anchor[0] - t_x) * (p - 1);
    t_y -= (anchor[1] - t_y) * (p - 1);

    this._projection?.scale(s);
    this._projection?.translate([t_x, t_y]);
  }

  pan = (delta: [number, number] = [0, 0]) => {
    const t = this._projection?.translate() ?? [0, 0];
    let t_x = t[0];
    let t_y = t[1];
    t_x += delta[0];
    t_y += delta[1];
    this._projection?.translate([t_x, t_y]);
  };

  shape(datum?: any) {
    return this._projection.shape(datum);
  }

  /**
   * 根据像素坐标获取经纬度位置
   */
  invert(point: [number, number]) {
    return this._projection.invert(point);
  }

  private evaluateProjection(start: [number, number], size: [number, number]) {
    const evaluated = this._projection.evaluate(start, size, this.collectFeatures());
    let translate = evaluated.translate();
    const scale = evaluated.scale() * this._initialScale;
    const center = this._projectionSpec.center ?? evaluated.invert([size[0] / 2, size[1] / 2]);
    center && (translate = [size[0] / 2, size[1] / 2]);
    return { translate, scale, center };
  }

  protected _initCenterCache() {
    if (!this._centerCache) {
      this._centerCache = new Map();
    }
    this._regions.forEach(r => {
      r.getSeries().forEach(s => {
        if (s.type === 'map') {
          const mapData = (s as IGeoSeries).getMapViewData()?.latestData ?? [];
          mapData.forEach((feature: any = {}) => {
            const key = feature[s.getDimensionField()[0]] || feature[DEFAULT_MAP_LOOK_UP_KEY];
            const center = (s as IGeoSeries).getDatumCenter(feature);
            if (key && isValid(center)) {
              this._centerCache.set(key, { x: center[0], y: center[1] });
            }
          });
        }
      });
    });
  }

  _compareSpec(spec: IGeoRegionSpec, prevSpec: IGeoRegionSpec) {
    const result = super._compareSpec(spec, prevSpec);
    if (!result.reMake) {
      result.reMake = ['roam', 'longitudeField', 'latitudeField', 'projection', 'zoomLimit', 'zoomRate'].some(k => {
        return !isEqual(prevSpec?.[k as keyof IGeoRegionSpec], spec[k as keyof IGeoRegionSpec]);
      });
    }

    return result;
  }

  release(): void {
    super.release();
    this._centerCache && this._centerCache.clear();
    this._centerCache = null;
  }
}

mixin(GeoCoordinate, Zoomable);

export const registerGeoCoordinate = () => {
  Factory.registerComponent(GeoCoordinate.type, GeoCoordinate);
};
