import type { IGlobalScale } from './interface';
import { isArray, isEmpty, isEqual, isNil } from '@visactor/vutils';
import type { IBaseScale, LinearScale, OrdinalScale } from '@visactor/vscale';
import { isContinuous } from '@visactor/vscale';
import type { IChart } from '../chart/interface';
import type { IChartSpec } from '../typings/spec';
import { createScale } from '../util/scale';
import { isDataDomainSpec } from '../util/type';
import { mergeFields } from '../util/data';
import type { IVisualScale, IVisualSpecScale } from '../typings';
import type { StatisticOperations } from '../data/transforms/interface';
import type { ISeries } from '../series';

type SpecifiedScale = OrdinalScale & {
  setSpecified?: (value?: Record<string, unknown>) => OrdinalScale;
};

export class GlobalScale implements IGlobalScale {
  private _scaleSpecMap: Map<string, IVisualSpecScale<unknown, unknown>> = new Map();
  private _scaleMap: Map<string, IBaseScale> = new Map();
  private _modelScaleSpecMap: Map<string, IVisualSpecScale<unknown, unknown>> = new Map();
  private _markAttributeScaleMap: Map<string, (IVisualScale & { seriesId: number; markScale: IBaseScale })[]> =
    new Map();
  private _spec: IChartSpec['scales'] = null;
  private readonly _chart: IChart = null;
  constructor(spec: IChartSpec['scales'], chart: IChart) {
    this._spec = spec;
    this._chart = chart;
    this._setAttrFromSpec();
  }

  private _createFromSpec(s: IVisualSpecScale<unknown, unknown>): IBaseScale {
    if (!s.id) {
      return null;
    }
    let scale = this._scaleMap.get(s.id);
    if (!scale) {
      if (s.type === 'ordinal' && s.id === 'color') {
        scale = createScale('colorOrdinal'); // 全局颜色色板的特殊逻辑
      } else {
        scale = createScale(s.type);
      }
    }
    if (!scale) {
      return null;
    }
    if (isArray(s.range)) {
      scale.range(s.range);
    }
    if (isArray(s.domain)) {
      if (!isDataDomainSpec(s.domain)) {
        scale.domain(s.domain);
      }
    }
    if (s.specified && (<OrdinalScale>scale).specified) {
      (<OrdinalScale>scale).specified(s.specified);
    }

    if (s.clamp && (<LinearScale>scale).clamp) {
      (<LinearScale>scale).clamp(s.clamp);
    }

    return scale;
  }

  private _setAttrFromSpec() {
    if (!this._spec?.length) {
      return;
    }
    const newScaleMap: Map<string, IBaseScale> = new Map();
    const newScaleSpecMap: Map<string, IVisualSpecScale<unknown, unknown>> = new Map();
    this._spec.forEach(s => {
      const scale = this._createFromSpec(s);
      if (!scale) {
        return;
      }
      newScaleMap.set(s.id, scale);
      newScaleSpecMap.set(s.id, s);
    });
    this._modelScaleSpecMap.forEach(s => {
      const scale = this._createFromSpec(s);
      if (!scale) {
        return;
      }
      newScaleMap.set(s.id, scale);
      newScaleSpecMap.set(s.id, s);
    });

    this._scaleSpecMap = newScaleSpecMap;
    this._scaleMap = newScaleMap;
  }

  updateSpec(spec: IChartSpec['scales']) {
    const result = {
      change: false,
      reMake: false,
      reRender: false,
      reSize: false,
      reCompile: false
    };
    if (isEqual(spec, this._spec)) {
      return result;
    }
    result.change = true;
    for (let i = 0; i < spec.length; i++) {
      const s = spec[i];
      const scale = this._scaleMap.get(s.id);
      if (!scale) {
        // new global scale need remake chart
        result.reMake = true;
        return result;
      }
      const lastSpec = this._spec.find(_s => _s.id === s.id);
      if (!lastSpec.id) {
        // new global scale need remake chart
        result.reMake = true;
        return result;
      }
      if (lastSpec.type !== s.type) {
        // scale cannot change type, need remake chart
        result.reMake = true;
        return result;
      }
      if (!isEqual(lastSpec.specified, s.specified)) {
        if (s.id !== 'color') {
          result.reMake = true;
          return result;
        }
        const colorScale = scale as SpecifiedScale;
        if (colorScale.setSpecified) {
          colorScale.setSpecified(s.specified as Record<string, unknown> | undefined);
        } else if (s.specified && colorScale.specified) {
          colorScale.specified(s.specified);
        } else {
          result.reMake = true;
          return result;
        }
        result.reRender = true;
      }
      if (s.range && !isEqual(s.range, scale.range())) {
        scale.range(s.range);
        result.reRender = true;
      }
      if (isDataDomainSpec(s.domain)) {
        result.reRender = true;
      } else if (!isEqual(s.domain, scale.domain())) {
        scale.domain(s.domain);
        result.reRender = true;
      }
      // replace specMap, this use for data domain
      this._scaleSpecMap.set(s.id, s);
    }
    this._spec = spec;
    return result;
  }

  registerModelScale(spec: IVisualSpecScale<unknown, unknown>) {
    const scale = this._createFromSpec(spec);
    if (!scale) {
      return;
    }
    this._modelScaleSpecMap.set(spec.id, spec);
    this._scaleSpecMap.set(spec.id, spec);
    this._scaleMap.set(spec.id, scale);
  }

  removeModelScale(filter: (spec: IVisualSpecScale<unknown, unknown>) => boolean) {
    this._modelScaleSpecMap.forEach(spec => {
      if (filter(spec)) {
        this._modelScaleSpecMap.delete(spec.id);
        this._scaleSpecMap.delete(spec.id);
        this._scaleMap.delete(spec.id);
      }
    });
  }

  getScale(user_id: string): IBaseScale | null {
    return this._scaleMap.get(user_id);
  }

  getScaleSpec(user_id: string): IVisualSpecScale<unknown, unknown> | null {
    return this._scaleSpecMap.get(user_id);
  }

  getStatisticalFields = (
    dataId: string
  ): {
    key: string;
    operations: StatisticOperations;
  }[] => {
    const result: {
      key: string;
      operations: StatisticOperations;
    }[] = [];
    this._scaleSpecMap.forEach((v, k) => {
      if (!isDataDomainSpec(v.domain)) {
        return;
      }
      v.domain.forEach(spec => {
        if (spec.dataId === dataId) {
          spec.fields.forEach(key => {
            mergeFields(result, [
              {
                key,
                operations: isContinuous(v.type) ? ['max', 'min'] : ['values']
              }
            ]);
          });
        }
      });
    });
    this._markAttributeScaleMap.forEach((specList, scaleName) => {
      const scale = this.getScale(scaleName);
      specList.forEach(spec => {
        const series = this._getSeriesBySeriesId(spec.seriesId);

        if (series.getRawData().name === dataId && spec.field) {
          mergeFields(result, [
            {
              key: spec.field,
              operations: isContinuous(scale.type) ? ['max', 'min'] : ['values']
            }
          ]);
        }
      });
    });
    return result;
  };

  private _getSeriesByRawDataId(id: string): ISeries {
    const series = this._chart.getAllSeries();

    for (let i = 0; i < series.length; i++) {
      const s = series[i];
      if (s.getRawData().name === id) {
        return s;
      }
    }
    return null;
  }

  private _getSeriesBySeriesId(id: number): ISeries {
    const series = this._chart.getAllSeries();

    for (let i = 0; i < series.length; i++) {
      const s = series[i];
      if (s.id === id) {
        return s;
      }
    }
    return null;
  }

  updateScaleDomain(defaultDomain: unknown[]) {
    this._scaleSpecMap.forEach((scaleSpec, id) => {
      const scale = this._scaleMap.get(id);
      if (!scale) {
        return;
      }
      if (!isDataDomainSpec(scaleSpec.domain)) {
        if (!scaleSpec.domain || scaleSpec.domain.length === 0) {
          scale.domain(defaultDomain);
        }
        this._updateMarkScale(id, scale, scale.domain().slice());
        return;
      }
      let domain: unknown[] | Set<string>;
      if (isContinuous(scaleSpec.type)) {
        domain = [null, null];
      } else {
        domain = new Set();
      }
      scaleSpec.domain.forEach(spec => {
        const series = this._getSeriesByRawDataId(spec.dataId);

        if (!series) {
          return;
        }

        const isContinuousField = isContinuous(scaleSpec.type);
        spec.fields.forEach(key => {
          const statistics = series.getRawDataStatisticsByField(key, isContinuousField);
          if (!statistics) {
            return;
          }
          if (isContinuousField) {
            if (isNil(domain[0])) {
              domain[0] = statistics.min;
            } else {
              domain[0] = Math.min(statistics.min, domain[0]);
            }
            if (isNil(domain[1])) {
              domain[1] = statistics.max;
            } else {
              domain[1] = Math.max(statistics.max, domain[1]);
            }
          } else {
            statistics.values.forEach((value: string) => {
              (domain as Set<string>).add(value);
            });
          }
        });
      });

      const scaleDomain = domain;
      if (!isContinuous(scaleSpec.type)) {
        domain = Array.from(domain);
      }
      scale.domain(domain as unknown[]);
      this._updateMarkScale(id, scale, scaleDomain);
    });
  }

  private _updateMarkScale(id: string, scale: IBaseScale, domain: unknown[] | Set<string>) {
    const list = this._markAttributeScaleMap.get(id);
    if (!list || list.length === 0) {
      return;
    }
    list.forEach(info => {
      if (!info.field || !info.markScale || info.markScale === scale) {
        return;
      }
      if (isNil(info.changeDomain) || info.changeDomain === 'none' || isNil(info.seriesId)) {
        isContinuous(scale.type) ? info.markScale.domain(domain as unknown[]) : scale.domain(Array.from(domain));
        return;
      }

      const series = this._getSeriesBySeriesId(info.seriesId);
      const isContinuousScale = isContinuous(scale.type);
      const statistics = series.getRawDataStatisticsByField(info.field, isContinuousScale);

      if (isEmpty(statistics)) {
        isContinuous(scale.type) ? info.markScale.domain(domain as unknown[]) : scale.domain(Array.from(domain));
        return;
      }

      if (info.changeDomain === 'expand') {
        if (isContinuousScale) {
          domain[0] = Math.min(domain[0], statistics.min);
          domain[1] = Math.max(domain[1], statistics.max);
        } else {
          statistics.values.forEach((value: string) => {
            (domain as Set<string>).add(value);
          });
          domain = Array.from(domain);
        }
        info.markScale.domain(domain as any[]);
        return;
      }
      if (info.changeDomain === 'replace') {
        if (isContinuousScale) {
          info.markScale.domain([statistics.min, statistics.max]);
        } else {
          info.markScale.domain(statistics.values);
        }
        return;
      }
    });
  }

  registerMarkAttributeScale(spec: IVisualScale, seriesId: number): IBaseScale {
    const scale = this._scaleMap.get(spec.scale);
    let list = this._markAttributeScaleMap.get(spec.scale);
    if (!list) {
      list = [];
      this._markAttributeScaleMap.set(spec.scale, list);
    }
    let markScale = scale;
    if (isNil(spec.field) || (!isNil(spec.changeDomain) && spec.changeDomain !== 'none' && !isNil(seriesId))) {
      markScale = scale.clone();
    }
    list.push({
      ...spec,
      seriesId,
      markScale
    });
    return markScale;
  }
}
