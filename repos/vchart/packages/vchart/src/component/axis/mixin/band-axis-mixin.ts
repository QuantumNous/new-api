import type { BandScale } from '@visactor/vscale';
import type { Dict } from '@visactor/vutils';
import { array, isArray } from '@visactor/vutils';
import type { Datum, IOrientType, IPolarOrientType, StringOrNumber } from '../../../typings';
import type { IEvent } from '../../../event/interface';
import { ChartEvent } from '../../../constant/event';
import type { IModel } from '../../../model/interface';
import type { IAxisLocationCfg } from '../interface';
import { CompilableData } from '../../../compile/data/compilable-data';
import type { AxisItem } from '@visactor/vrender-components';
import { getAxisItem } from '../util';

export interface BandAxisMixin {
  _orient: IOrientType | IPolarOrientType;
  _option: any;
  _scale: BandScale;
  _scales: BandScale[];
  _spec: any;
  _tick: any;
  _tickData: CompilableData[];
  _defaultBandPosition: number;
  _defaultBandInnerPadding: number;
  _defaultBandOuterPadding: number;
  event: IEvent;
  isSeriesDataEnable: () => boolean;
  collectData: (depth: number, rawData?: boolean) => { min: number; max: number; values: any[] }[];
  computeDomain: (data: { min: number; max: number; values: any[] }[]) => StringOrNumber[];
  transformScaleDomain: () => void;
  _initTickDataSet: (options: any, index?: number) => any;
  _tickTransformOption: () => any;
  _forceLayout: () => void;
  _getNormalizedValue: (values: any[], length: number) => number;
  _onTickDataChange: (compilableData: CompilableData) => void;
  registerTicksTransform: () => string;
  _refreshVisibilityByData: () => boolean;
}

export class BandAxisMixin {
  private _tickDataMap: Dict<any>;
  protected _initData() {
    if (this._spec.showAllGroupLayers && this._scales.length > 1) {
      // 显示所有分组层级
      for (let layer = 0; layer < this._scales.length; layer++) {
        const layers = this._spec.layers ?? [];
        const layerConfig = layers[this._scales.length - 1 - layer] || {};
        if (layerConfig.visible !== false && layerConfig.tickCount !== 0 && layerConfig.forceTickCount !== 0) {
          const tickData = this._initTickDataSet(
            {
              ...this._tickTransformOption(),
              ...layerConfig
            },
            layer
          );
          const compilableData = new CompilableData(this._option, tickData);
          this._tickData.push(compilableData);
          tickData.target.addListener('change', () => {
            this._onTickDataChange(compilableData);
          });

          if (!this._tickDataMap) {
            this._tickDataMap = {};
          }
          this._tickDataMap[layer] = compilableData;
        }
      }
    } else {
      const tickData = this._initTickDataSet(this._tickTransformOption());
      const compilableData = new CompilableData(this._option, tickData);
      tickData.target.addListener('change', () => {
        this._onTickDataChange(compilableData);
      });
      this._tickData = [compilableData];
      this._tickDataMap = {
        0: compilableData
      };
    }
  }

  protected _updateData() {
    const tickTransformType = this.registerTicksTransform();

    if (this._spec.showAllGroupLayers && this._scales.length > 1) {
      const layers = this._spec.layers ?? [];
      Object.keys(this._tickDataMap).forEach(layer => {
        const layerConfig = layers[this._scales.length - 1 - +layer] || {};
        const tickData = this._tickDataMap[layer];
        const tickTransform = tickData?.getDataView().transformsArr.find((t: any) => t.type === tickTransformType);

        tickTransform &&
          (tickTransform.options = {
            ...this._tickTransformOption(),
            ...layerConfig
          });
      });
    } else {
      const tickTransform = this._tickData?.[0]?.getDataView().transformsArr.find(t => t.type === tickTransformType);

      tickTransform && (tickTransform.options = this._tickTransformOption());
    }
  }

  protected _rawDomainIndex: { [key: string | number | symbol]: number }[] = [];
  protected _rawDomain: StringOrNumber[][] = [];
  getRawDomain() {
    return this._rawDomain;
  }

  dataToPosition(values: any[], cfg: IAxisLocationCfg = {}): number {
    if (values.length === 0 || this._scales.length === 0) {
      return 0;
    }
    const { position, bandScale } = this.getPosition(values);
    return (
      position + bandScale.bandwidth() * (cfg.bandPosition ?? this._spec.bandPosition ?? this._defaultBandPosition)
    );
  }

  valueToPosition(value: any): number {
    const bandStart = this._scale.scale(value);
    return bandStart;
  }

  updateGroupScaleRange() {
    let parentScale = this._scale;
    this._scales.forEach((scale, i) => {
      if (i > 0) {
        scale.range([0, parentScale.bandwidth()]);
        parentScale = scale;
      }
    });
  }

  getPosition(values: any[]) {
    let position = 0;
    let bandScale = this._scale;
    // 要不要性能优化？
    // 优化有没有用？
    if (this._scales.length === 1 || values.length === 1) {
      position = this.valueToPosition(values[0]);
    } else {
      const max = Math.min(values.length, this._scales.length);
      for (let i = 0; i < max; i++) {
        position += this._scales[i].scale(values[i]);
      }
      bandScale = this._scales[max - 1];
    }
    return { position, bandScale };
  }

  calcScales(DEFAULT_BAND_INNER_PADDING: number, DEFAULT_BAND_OUTER_PADDING: number) {
    const { bandPadding, paddingInner, paddingOuter } = this._spec;
    const isBandPaddingArray = isArray(bandPadding);
    const isPaddingInnerArray = isArray(paddingInner);
    const isPaddingOuterArray = isArray(paddingOuter);

    for (let i = 0; i < this._scales.length; i++) {
      const _padding = isBandPaddingArray ? bandPadding[i] : bandPadding;
      const _paddingInner = isPaddingInnerArray ? paddingInner[i] : paddingInner;
      const _paddingOuter = isPaddingOuterArray ? paddingOuter[i] : paddingOuter;

      this._scales[i]
        .paddingInner(_paddingInner ?? _padding ?? DEFAULT_BAND_INNER_PADDING, true)
        .paddingOuter(_paddingOuter ?? _padding ?? DEFAULT_BAND_OUTER_PADDING, true);
    }
  }
  computeBandDomain(data: { min: number; max: number; values: any[] }[]): StringOrNumber[] {
    if (!data.length) {
      return [];
    }

    // 性能优化 9.13
    if (data.length === 1) {
      return data[0].values;
    }
    const tempSet = new Set();
    for (let i = 0; i < data.length; i++) {
      for (let j = 0; j < data[i].values.length; j++) {
        tempSet.add(data[i].values[j]);
      }
    }
    return Array.from(tempSet) as StringOrNumber[];
  }

  protected updateScaleDomain() {
    if (!this.isSeriesDataEnable()) {
      return;
    }
    if (!this._rawDomainIndex?.length && this._scales.length) {
      this._updateRawDomain();
    }
    const userDomain = this._spec.domain;
    for (let i = 0; i < this._scales.length; i++) {
      if (userDomain && userDomain.length && i === 0) {
        // 当数字映射字段存在分组时，只作用于第一个分组的domain，如 xField: ['x', 'type']
        this._scales[i].domain(userDomain);
      } else {
        const data = this.collectData(i);
        const domain = this.computeBandDomain(data);
        this._scales[i].domain(domain.sort((a, b) => this._rawDomainIndex[i][a] - this._rawDomainIndex[i][b]));
      }
    }
    this.transformScaleDomain();
    this._refreshVisibilityByData();
    this.event.emit(ChartEvent.scaleDomainUpdate, { model: this as unknown as IModel });
    this.event.emit(ChartEvent.scaleUpdate, { model: this as unknown as IModel, value: 'domain' });
  }

  protected getLabelItems(length: number) {
    const labelItems: Dict<any>[][] = [];
    let preData: any[] = [];

    // 只有需要展示多层标签的时候，才需要计算，否则不需要计算
    (this._spec.showAllGroupLayers ? this._scales : [this._scales[0]]).forEach((scale, index) => {
      const tickData = this._tickDataMap[index];

      // 因为多层级标签会依赖上一层标签的分组值定位，所以如果上一层标签没有内容，那么就直接获取 bandScale 的 domain()
      const isTickDataHaveData = tickData?.getLatestData()?.length;
      const ticks: string[] = isTickDataHaveData
        ? tickData.getLatestData().map((obj: Datum) => obj.value)
        : scale.domain();
      if (ticks && ticks.length) {
        if (preData && preData.length) {
          const currentLabelItems: any[] = [];
          const curData: any[] = [];
          preData.forEach(value => {
            ticks.forEach(tick => {
              const values = array(value).concat(tick);
              curData.push(values);

              if (isTickDataHaveData) {
                const axisItem = getAxisItem(tick, this._getNormalizedValue(values, length));
                currentLabelItems.push(axisItem);
              }
            });
          });
          if (isTickDataHaveData) {
            labelItems.push(currentLabelItems.filter((entry: AxisItem) => entry.value >= 0 && entry.value <= 1));
          }
          preData = curData;
        } else {
          ticks.forEach(tick => {
            preData.push(tick);
          });
          if (isTickDataHaveData) {
            labelItems.push(
              tickData
                .getLatestData()
                .map((obj: Datum) => {
                  return getAxisItem(obj.value, this._getNormalizedValue([obj.value], length));
                })
                .filter((entry: AxisItem) => entry.value >= 0 && entry.value <= 1)
            );
          }
        }
      }
    });

    return labelItems.reverse();
  }

  protected _updateRawDomain() {
    // 默认值设置了无效？
    this._rawDomainIndex = [];
    this._rawDomain = [];

    const userDomain = this._spec.domain;
    for (let i = 0; i < this._scales.length; i++) {
      if (userDomain && userDomain.length && i === 0) {
        // 当数字映射字段存在分组时，只作用于第一个分组的domain，如 xField: ['x', 'type']
        this._scales[i].domain(userDomain);
      } else {
        const data = this.collectData(i, true);
        const domain = this.computeBandDomain(data);
        this._rawDomainIndex[i] = {};
        this._rawDomain[i] = domain;
        domain.forEach((d, _i) => (this._rawDomainIndex[i][d] = _i));
      }
    }
    this.event.emit(ChartEvent.scaleRawDomainUpdate, { model: this as unknown as IModel });
  }

  protected _clearRawDomain() {
    this._rawDomainIndex = [];
    this._rawDomain = [];
  }
}
