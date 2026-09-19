import { Matrix, isValid, isValidNumber } from '@visactor/vutils';
import { DataView } from '@visactor/vdataset';
import { geoSourceMap, registerMapSource, unregisterMapSource } from './geo-source';
import { lookup } from '../../data/transforms/lookup';
import type { Datum, StringOrNumber } from '../../typings';
import { GeoSeries } from '../geo/geo';
import { map } from '../../data/transforms/map';
import { copyDataView } from '../../data/transforms/copy-data-view';
import { registerDataSetInstanceTransform } from '../../data/register';
import { MapSeriesTooltipHelper } from './tooltip-helper';
import { DEFAULT_DATA_SERIES_FIELD, DEFAULT_DATA_INDEX, DEFAULT_MAP_LOOK_UP_KEY } from '../../constant/data';
import { AttributeLevel } from '../../constant/attribute';
import type { SeriesMarkMap } from '../interface';
import { SeriesMarkNameEnum, SeriesTypeEnum } from '../interface/type';
import type { FeatureData, IMapSeriesSpec } from './interface';
import type { PanEventParam, ZoomEventParam } from '../../event/interface';
import { animationConfig, shouldMarkDoMorph, userAnimationConfig } from '../../animation/utils';
import { registerFadeInOutAnimation } from '../../animation/config';
import { registerPathMark } from '../../mark/path';
import { mapSeriesMark } from './constant';
import { Factory } from '../../core/factory';
import { registerGeoCoordinate } from '../../component/geo';
import type { ILabelMark, IMark, IPathMark } from '../../mark/interface';
import { TransformLevel } from '../../data/initialize';
import { MapSeriesSpecTransformer } from './map-transformer';
import { CompilableData } from '../../compile/data';
import { map as mapTheme } from '../../theme/builtin/common/series/map';

export class MapSeries<T extends IMapSeriesSpec = IMapSeriesSpec> extends GeoSeries<T> {
  static readonly type: string = SeriesTypeEnum.map;
  type = SeriesTypeEnum.map;

  static readonly mark: SeriesMarkMap = mapSeriesMark;
  static readonly builtInTheme = { map: mapTheme };
  static readonly transformerConstructor = MapSeriesSpecTransformer as any;
  readonly transformerConstructor = MapSeriesSpecTransformer;

  map!: string;

  protected _nameMap!: { [key: StringOrNumber]: StringOrNumber };
  getNameMap() {
    return this._nameMap;
  }

  private _areaCache: Map<string, { shape: string }> = new Map();
  get areaPath() {
    return this._areaCache;
  }

  private _pathMark: IPathMark;
  private _labelMark: ILabelMark;

  setAttrFromSpec() {
    super.setAttrFromSpec();
    this.map = this._spec.map;
    this._nameMap = this._spec.nameMap;
    this._nameField = this._spec.nameField;
    this._valueField = this._spec.valueField;
    this._spec.nameProperty && (this._nameProperty = this._spec.nameProperty);
    this._spec.centroidProperty && (this._centroidProperty = this._spec.centroidProperty);

    if (!this.map) {
      this._option?.onError(`map type '${this.map}' is not specified !`);
    }

    if (!geoSourceMap.get(this.map)) {
      this._option?.onError(`'${this.map}' data is not registered !`);
    }
  }

  // data
  initData(): void {
    super.initData();

    registerDataSetInstanceTransform(this._dataSet, 'copyDataView', copyDataView);
    registerDataSetInstanceTransform(this._dataSet, 'map', map);
    registerDataSetInstanceTransform(this._dataSet, 'lookup', lookup);

    // 初始化地图数据
    const features = geoSourceMap.get(this.map);
    if (!features) {
      this._option?.onError('no valid map data found!');
    }
    const mapData = new DataView(this._dataSet, { name: `map_${this.id}_data` });

    mapData
      .parse([features], {
        type: 'dataview'
      })
      .transform({ type: 'copyDataView', options: { deep: true }, level: TransformLevel.copyDataView })
      .transform({
        type: 'map',
        options: () => ({
          nameMap: this._nameMap,
          nameProperty: this._nameProperty
        })
      })
      .transform({
        type: 'lookup',
        options: {
          from: () => this._data?.getLatestData(),
          key: DEFAULT_MAP_LOOK_UP_KEY,
          fields: () => this._nameField,
          set: (feature: FeatureData, datum: Datum) => {
            if (datum) {
              Object.keys(datum).forEach(key => {
                if (!(key in feature)) {
                  (feature as any)[key] = datum[key];
                }
              });
            }
          }
        }
      });
    this._data?.getDataView().target.addListener('change', mapData.reRunAllTransform);
    this._mapViewData = new CompilableData(this._option, mapData);
  }

  compileData() {
    super.compileData();
    this._mapViewData?.compile();
  }

  // mark
  initMark() {
    this._pathMark = this._createMark(
      MapSeries.mark.area,
      {
        groupKey: this.getDimensionField()[0],
        isSeriesMark: true
      },
      {
        morph: shouldMarkDoMorph(this._spec, MapSeries.mark.area.name),
        morphElementKey: this.getDimensionField()[0]
      }
    ) as IPathMark;

    this._pathMark.setData(this._mapViewData);
  }

  initMarkStyle() {
    const pathMark = this._pathMark;
    if (pathMark) {
      this.setMarkStyle(
        pathMark,
        {
          fill: (datum: any) => {
            if (isValid(datum[this._seriesField ?? DEFAULT_DATA_SERIES_FIELD])) {
              return (this._option.globalScale.getScale('color') ?? this._getDefaultColorScale()).scale(
                datum[this._seriesField ?? DEFAULT_DATA_SERIES_FIELD]
              );
            }
            return this._spec?.defaultFillColor;
          },
          path: this.getPath.bind(this)
        },
        'normal',
        AttributeLevel.Series
      );

      pathMark.setPostProcess('fill', result => {
        if (!isValid(result)) {
          return this._spec.defaultFillColor;
        }
        return result;
      });

      this.setMarkStyle(
        pathMark,
        {
          smoothScale: true
        },
        'normal',
        AttributeLevel.Built_In
      );
    }
  }

  initLabelMarkStyle(labelMark: ILabelMark) {
    if (!labelMark) {
      return;
    }
    this._labelMark = labelMark;
    this.setMarkStyle(labelMark, {
      text: (datum: Datum) => {
        const text = this.getDatumName(datum);
        return text;
      },
      x: (datum: Datum) => this.dataToPosition(datum)?.x,
      y: (datum: Datum) => this.dataToPosition(datum)?.y
    });
  }

  initAnimation() {
    this._pathMark.setAnimationConfig(
      animationConfig(
        Factory.getAnimationInKey('fadeInOut')?.(),
        userAnimationConfig(SeriesMarkNameEnum.area, this._spec, this._markAttributeContext)
      )
    );
  }

  protected initTooltip() {
    this._tooltipHelper = new MapSeriesTooltipHelper(this);
    this._pathMark && this._tooltipHelper.activeTriggerSet.mark.add(this._pathMark);
  }

  protected getPath(datum: any) {
    const area = this._areaCache.get(datum[DEFAULT_DATA_INDEX]);
    if (area) {
      return area.shape;
    }
    const shape = this._coordinateHelper?.shape(datum);
    this._areaCache.set(datum[DEFAULT_DATA_INDEX], {
      shape
    });
    return shape;
  }

  // life cycle
  onEvaluateEnd() {
    this._mapViewData.updateData();
  }

  getDimensionField(): string[] {
    return [this.nameField];
  }

  getMeasureField(): string[] {
    return [this.valueField];
  }

  release() {
    super.release();
    this._areaCache.clear();
    this._nameMap = {};
    this._mapViewData = null as any;
  }

  handleZoom(e: ZoomEventParam) {
    const { scale, scaleCenter } = e;
    if (scale === 1) {
      return;
    }

    const pathGroup = this.getRootMark().getProduct();
    if (pathGroup) {
      if (!pathGroup.attribute.postMatrix) {
        pathGroup.setAttributes({
          postMatrix: new Matrix()
        });
      }
      pathGroup.scale(scale, scale, scaleCenter);
    }
    const vgrammarLabel = this._labelMark?.getComponent();

    if (vgrammarLabel) {
      vgrammarLabel.renderInner();
    }
  }

  handlePan(e: PanEventParam) {
    const { delta } = e;
    if (delta[0] === 0 && delta[1] === 0) {
      return;
    }
    const pathGroup = this.getRootMark().getProduct();
    if (pathGroup) {
      if (!pathGroup.attribute.postMatrix) {
        pathGroup.setAttributes({
          postMatrix: new Matrix()
        });
      }
      pathGroup.translate(delta[0], delta[1]);
    }
    const vgrammarLabel = this._labelMark?.getComponent();

    if (vgrammarLabel) {
      vgrammarLabel.renderInner();
    }
  }

  getDatumCenter(datum: any): [number, number] {
    if (this._centroidProperty && datum.properties?.[this._centroidProperty]) {
      return datum.properties?.[this._centroidProperty];
    }

    if (isValidNumber(datum.centroidX * datum.centroidY)) {
      return [datum.centroidX, datum.centroidY];
    }

    if (datum.properties?.center) {
      return datum.properties.center;
    }

    if (datum.properties?.centroid) {
      return datum.properties.centroid;
    }

    return [Number.NaN, Number.NaN];
  }

  getDatumName(datum: any): string {
    if (datum[this.nameField]) {
      return datum[this.nameField];
    }
    const name = datum.properties?.[this._nameProperty];
    if (name) {
      if (this._spec.nameMap) {
        if (this._spec.nameMap[name]) {
          return this._spec.nameMap[name];
        }
      }
      // TODO:
      // 1. showDefaultName 是一个考虑配置兼容的产物，不然会有 break-change
      // 2. 后续大版本升级，这里无需判断条件，直接返回 name 是更合理的
      if (this._spec.showDefaultName || !this._spec.nameMap) {
        return name;
      }
    }
    return '';
  }

  dataToPositionX(data: any): number {
    this._option?.onError('Method not implemented.');
    return 0;
  }
  dataToPositionY(data: any): number {
    this._option?.onError('Method not implemented.');
    return 0;
  }

  viewDataUpdate(d: DataView): void {
    super.viewDataUpdate(d);
    this._mapViewData?.getDataView()?.reRunAllTransform();
    this._mapViewData?.updateData();
  }

  protected _getDataIdKey() {
    return DEFAULT_DATA_INDEX;
  }

  getActiveMarks(): IMark[] {
    return [this._pathMark];
  }
}

export const registerMapSeries = () => {
  // 注册语法元素
  registerGeoCoordinate();
  registerPathMark();
  Factory.registerSeries(MapSeries.type, MapSeries);
  Factory.registerImplement('registerMap', registerMapSource);
  Factory.registerImplement('unregisterMap', unregisterMapSource);
  registerFadeInOutAnimation();
};
