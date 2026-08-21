import { isValidNumber, isNil, isValid, isFunction, last } from '@visactor/vutils';
import type { LinearScale } from '@visactor/vscale';
import { combineDomains, maxInArr, minInArr } from '../../../util/array';
import { getLinearAxisSpecDomain } from '../util';
import type { IAxisLocationCfg, ILinearAxisBreakSpec, ITick } from '../interface';
import { ChartEvent } from '../../../constant/event';
import type { IEvent } from '../../../event/interface';
import { isXAxis } from '../cartesian/util/common';
import type { IOrientType } from '../../../typings/space';
import type { IComponentOption } from '../../interface/common';
import type { StringOrNumber } from '../../../typings';
import { breakData } from './util/break-data';
import type { IModel } from '../../../model/interface';

export const e10 = Math.sqrt(50);
export const e5 = Math.sqrt(10);
export const e2 = Math.sqrt(2);
const DEFAULT_TICK_COUNT = 5;

export interface LinearAxisMixin {
  _scale: LinearScale;
  _scales: LinearScale[];
  _spec: any;
  _nice: boolean;
  _zero: boolean;
  /**
   * spec中申明的min,max
   */
  _domain: { min?: number; max?: number };
  /**
   * 记录一下解析spec后，获取到的domain，
   * 用于在插件（如0值对齐等功能）中使用
   */
  _domainAfterSpec: number[];
  _softMinValue?: number;
  _softMaxValue?: number;
  _expand?: { max?: number; min?: number };
  _tick: ITick | undefined;
  /**
   * 上一次 setLinearScaleNice 计算 tickCount 时使用的轴长，
   * 用于布局结束后判断是否需要用真实绘图区轴长重新 nice
   */
  _lastNiceAxisLength?: number;
  isSeriesDataEnable: any;
  computeDomain: any;
  collectData: (depth?: number, rawData?: boolean) => { min: number; max: number; values: any[] }[];
  /**
   * 这个变量在其他break相关组件和扩展中都有使用
   */
  _break: {
    domain: [number, number][];
    scope: [number, number][];
    breakDomains: [number, number][];
    breaks: ILinearAxisBreakSpec[];
  };
  event: IEvent;
  _orient: IOrientType;
  _option: IComponentOption;
  niceLabelFormatter: (value: StringOrNumber) => StringOrNumber;
  _refreshVisibilityByData: () => boolean;
}

export class LinearAxisMixin {
  protected _extend: { [key: string]: number } = {};
  protected _rawDomain: StringOrNumber[] = [];
  getRawDomain() {
    return this._rawDomain;
  }

  niceLabelFormatter: (value: StringOrNumber) => StringOrNumber = null;

  setExtraAttrFromSpec() {
    isValid(this._spec.nice) && (this._nice = this._spec.nice);
    isValid(this._spec.zero) && (this._zero = this._spec.zero);
    this._expand = this._spec.expand;
    this._domain = getLinearAxisSpecDomain(this._spec);
  }
  transformScaleDomain() {
    this.setScaleNice();
  }

  setLinearScaleNice() {
    if (!this._nice) {
      return false;
    }
    let tickCount: number = DEFAULT_TICK_COUNT;
    const tick = this._spec.tick || {};

    if (isValidNumber(tick.forceTickCount)) {
      tickCount = tick.forceTickCount;
    } else if (isFunction(tick.tickCount)) {
      const range = this._scale.range();
      let rangeSize = Math.abs(last(range) - range[0]);

      if (rangeSize === 1 && this._option) {
        // TODO: need to be optimized, when the range is not updated, use the size of view
        const isX = isXAxis(this._orient);
        rangeSize = isX ? this._option.getChartViewRect().width : this._option.getChartViewRect().height;
      }

      // 记录本次 nice 使用的轴长，供布局结束后判断是否需要用真实绘图区轴长重算
      this._lastNiceAxisLength = rangeSize;

      // tickCount需要一致，不然会导致效果不一致, fix #2050
      tickCount = tick.tickCount({
        axisLength: rangeSize,
        labelStyle: this._spec.label && this._spec.label.style
      });
    } else if (isValidNumber(tick.tickCount)) {
      tickCount = tick.tickCount;
    } else {
      tickCount = DEFAULT_TICK_COUNT;
    }
    // 如果配置了精度优先，那么最低是 5
    // 否则就直接使用tickCount即可
    if (this._spec.niceType === 'accurateFirst') {
      tickCount = Math.max(DEFAULT_TICK_COUNT, tickCount);
    }
    const { min, max } = this._domain ?? {};
    if (isNil(min) && isNil(max) && isNil(this._softMaxValue) && isNil(this._softMinValue)) {
      return this._scale.nice(tickCount);
    } else if ((isValid(min) || isValid(this._softMinValue)) && isNil(max) && isNil(this._softMaxValue)) {
      return this._scale.niceMax(tickCount);
    } else if (isNil(min) && isNil(this._softMinValue) && (isValid(max) || isValid(this._softMaxValue))) {
      return this._scale.niceMin(tickCount);
    }

    return false;
  }

  setLogScaleNice() {
    if (!this._nice) {
      return false;
    }

    const { min, max } = this._domain ?? {};
    if (isNil(min) && isNil(max) && isNil(this._softMaxValue) && isNil(this._softMinValue)) {
      return this._scale.nice();
    } else if ((isValid(min) || isValid(this._softMinValue)) && isNil(max) && isNil(this._softMaxValue)) {
      return this._scale.niceMax();
    } else if (isNil(min) && isNil(this._softMinValue) && (isValid(max) || isValid(this._softMaxValue))) {
      return this._scale.niceMin();
    }

    return false;
  }

  setScaleNice() {
    if (this._spec.type === 'log') {
      return this.setLogScaleNice();
    }
    return this.setLinearScaleNice();
  }

  /**
   * scale.range 更新到真实绘图区长度后，若 tickCount 是依赖轴长的函数，用真实轴长重算 nice。
   *
   * setLinearScaleNice 在布局前被调用时（scale.range 仍是初始的 [0, 1]、rangeSize 为 1），
   * 拿不到真实绘图区像素轴长，会回退用整块 chart viewRect 的宽/高估算 tickCount。viewRect
   * 比扣掉标题/图例/对侧轴后的真实绘图区大，导致 tickCount 偏大 → 刻度偏密 → nice 天花板偏低，
   * 且布局后不会再重算。这里在 range 更新到真实绘图区长度后重算一次，使 tickCount / nice 域与最终
   * 绘图区一致。仅当 tickCount 为函数（依赖轴长）时生效，固定/默认 tickCount 不受影响；
   * _lastNiceAxisLength 缓存避免轴长未变时（多次布局测量 / 多 pass）重复重算。
   */
  reTransformDomainByLayout() {
    if (!this._nice || !isFunction(this._spec.tick?.tickCount)) {
      return;
    }
    const range = this._scale.range();
    const realLength = Math.abs(last(range) - range[0]);
    // range 还没更新到真实绘图区（仍是初始 [0, 1]）时不处理
    if (realLength <= 1) {
      return;
    }
    // 已经用同样的轴长 nice 过则跳过，避免多次布局 pass 下重复重算
    if (isValidNumber(this._lastNiceAxisLength) && Math.abs(this._lastNiceAxisLength - realLength) < 1) {
      return;
    }
    this.updateScaleDomain();
  }

  dataToPosition(values: any[], cfg?: IAxisLocationCfg): number {
    return this.valueToPosition(values[0]);
  }

  valueToPosition(value: any): number {
    return this._scale.scale(value);
  }

  computeLinearDomain(data: { min: number; max: number; values: any[] }[]): number[] {
    let domain: number[] = [];

    if (data.length) {
      const userSetBreaks = this._spec.breaks && this._spec.breaks.length;
      let values: any[] = [];
      let minDomain: number;
      let maxDomain: number;
      data.forEach(d => {
        const { min, max } = d;
        minDomain = minDomain === undefined ? min : Math.min(minDomain, min as number);
        maxDomain = maxDomain === undefined ? max : Math.max(maxDomain, max as number);
        if (userSetBreaks) {
          values = values.concat(d.values);
        }
      });

      if (userSetBreaks) {
        const breakRanges = [];
        const breaks = [];
        // 如果用户手动的手指了max，可以将break的最大值限制在用户设置的最大值范围内
        const breakMaxLimit = isNil(this._domain.max) ? maxDomain : this._domain.max;
        for (let index = 0; index < this._spec.breaks.length; index++) {
          const { range } = this._spec.breaks[index];
          if (range[0] <= range[1] && range[1] <= breakMaxLimit) {
            breakRanges.push(range);
            breaks.push(this._spec.breaks[index]);
          }
        }
        breakRanges.sort((a: [number, number], b: [number, number]) => a[0] - b[0]);
        if (breakRanges.length) {
          const { domain: breakDomains, scope: breakScopes } = breakData(
            values,
            combineDomains(breakRanges),
            this._spec.breaks[0].scopeType
          );

          domain = combineDomains(breakDomains);
          this._break = {
            domain: breakDomains,
            scope: breakScopes,
            breakDomains: breakRanges,
            breaks
          };
        } else {
          domain = [minDomain, maxDomain];
        }
      } else {
        domain = [minDomain, maxDomain];
      }
    } else {
      // default value for linear axis
      domain[0] = 0;
      domain[1] = 0;
    }
    this.setSoftDomainMinMax(domain);
    this.expandDomain(domain);
    this.includeZero(domain);
    this.setDomainMinMax(domain);
    return domain;
  }

  protected expandDomain(domain: number[]): void {
    if (!this._expand) {
      return;
    }

    let domainMin = domain[0];
    let domainMax = last(domain);

    if (domainMin === domainMax) {
      if (domainMax === 0) {
        domainMax = 1;
      } else if (domainMax > 0) {
        domainMin = 0;
      } else if (domainMax < 0) {
        domainMax = 0;
      }
    }

    if (isValid(this._expand.min)) {
      domain[0] = domainMin - (domainMax - domainMin) * this._expand.min;
    }
    if (isValid(this._expand.max)) {
      domain[domain.length - 1] = domainMax + (domainMax - domainMin) * this._expand.max;
    }
  }

  protected niceDomain(domain: number[]) {
    const { min: userMin, max: userMax } = getLinearAxisSpecDomain(this._spec);
    if (isValid(userMin) || isValid(userMax) || this._spec.type !== 'linear') {
      // 如果用户设置了 min 或者 max 则按照用户设置的为准
      // 如果是非 linear 类型也不处理
      return domain;
    }
    if (Math.abs(minInArr(domain) - maxInArr(domain)) <= 1e-12) {
      let num = domain[0];
      const flag = num >= 0 ? 1 : -1;
      num = Math.abs(num);
      if (num < 1) {
        domain[0] = 0;
        domain[domain.length - 1] = 1; // 在[0, 1) 区间变成[0, 1]
      } else {
        let step = num / DEFAULT_TICK_COUNT; // 默认5个ticks
        const power = Math.floor(Math.log(step) / Math.LN10);
        const err = step / Math.pow(10, power);
        step = (err >= e10 ? 10 : err >= e5 ? 5 : err >= e2 ? 2 : 1) * Math.pow(10, power);

        domain[0] = 0;
        domain[domain.length - 1] = step * 10;
      }
      if (flag < 0) {
        domain.reverse();
        domain[0] *= -1;
        domain[domain.length - 1] *= -1;
      }
    }
    return domain;
  }

  protected includeZero(domain: number[]): void {
    if (this._zero) {
      domain[0] = Math.min(domain[0], 0);
      domain[domain.length - 1] = Math.max(last(domain), 0);
    }
  }

  // 用户其他模块扩充轴scale的区间
  setExtendDomain(key: string, value: number | undefined) {
    if (value === undefined) {
      if (!Object.prototype.hasOwnProperty.call(this._extend, key)) {
        return;
      }
      delete this._extend[key];
    } else {
      if (this._extend[key] === value) {
        return;
      }
      this._extend[key] = value;
    }
    this.updateScaleDomain();
  }

  protected extendDomain(domain: number[]) {
    let temp;
    const domainLast = domain.length - 1;
    const reverse = domain[0] - domain[domainLast] > 0;
    const min = reverse ? domainLast : 0;
    const max = reverse ? 0 : domainLast;
    for (const key in this._extend) {
      temp = this._extend[key];
      temp > domain[max] && (domain[max] = temp);
      temp < domain[min] && (domain[min] = temp);
    }
  }

  getDomainSpec() {
    return this._domain;
  }

  protected setDomainMinMax(domain: number[]): void {
    if (!this._domain) {
      return;
    }
    const { min, max } = this._domain;
    isValid(min) && (domain[0] = min);
    isValid(max) && (domain[domain.length - 1] = max);
  }

  protected setSoftDomainMinMax(domain: number[]): void {
    const { softMin, softMax } = this._spec;

    if (isValid(softMin)) {
      let softMinValue = isFunction(softMin) ? softMin(domain) : (softMin as number);

      if (isNil(softMinValue)) {
        softMinValue = domain[0];
      }

      if (softMinValue <= domain[0]) {
        domain[0] = softMinValue;
        this._softMinValue = softMinValue;
      }
    }

    if (isValid(softMax)) {
      let softMaxValue = isFunction(softMax) ? softMax(domain) : (softMax as number);

      if (isNil(softMaxValue)) {
        softMaxValue = last(domain);
      }

      if (softMaxValue >= last(domain)) {
        domain[domain.length - 1] = softMaxValue;
      }

      this._softMaxValue = softMaxValue;
    }
  }

  setZero(zero: boolean) {
    if (this._zero !== zero) {
      this._zero = zero;
      this.updateScaleDomain();
    }
  }
  /**
   * @override
   * TODO event.emit是否可以考虑用decorator
   */
  protected updateScaleDomain() {
    if (!this.isSeriesDataEnable()) {
      return;
    }
    if (!this._rawDomain?.length && this._scale) {
      this._updateRawDomain();
    }
    const data = this.collectData();
    const domain: number[] = this.computeLinearDomain(data) as number[];
    this.updateScaleDomainByModel(domain);
  }

  /**
   * TODO event.emit是否可以考虑用decorator
   * 数据逻辑外，模块的设置更新对scale-domain的修改操作
   */
  protected updateScaleDomainByModel(domain?: number[]) {
    domain = domain ?? this._scale.domain();
    // 其他模块的设置 domain
    this.extendDomain(domain);
    this.includeZero(domain);
    // 用户 spec 的 min-max
    this.setDomainMinMax(domain);
    // nice 优先级最高
    this.niceDomain(domain);
    this._scale.domain(domain, this._nice);
    // 设置scale的nice-min-max
    if (this._nice) {
      const niced = this.setScaleNice();

      !niced && this._scale.rescale();
    }
    this._updateNiceLabelFormatter(domain);

    this._domainAfterSpec = this._scale.domain();
    this._refreshVisibilityByData();
    this.event.emit(ChartEvent.scaleDomainUpdate, { model: this as any });
    this.event.emit(ChartEvent.scaleUpdate, { model: this as any, value: 'domain' });
  }

  getDomainAfterSpec() {
    return this._domainAfterSpec;
  }

  protected _updateNiceLabelFormatter(domain: number[]) {
    // 根据轴 domain 范围做动态判断，取最多 n + 2 位小数
    const domainSpan = Math.abs(last(domain) - domain[0]);
    const n = Math.max(-Math.floor(Math.log10(domainSpan)), 0) + 2;
    const unit = Math.pow(10, n);
    this.niceLabelFormatter = (value: StringOrNumber) => {
      if (isValidNumber(+value)) {
        return Math.round((+value as number) * unit) / unit;
      }
      return value;
    };
  }

  protected _updateRawDomain() {
    const data = this.collectData(0, true);
    const domain: number[] = this.computeLinearDomain(data) as number[];
    this._rawDomain = domain;
    this.event.emit(ChartEvent.scaleRawDomainUpdate, { model: this as unknown as IModel });
  }

  protected _clearRawDomain() {
    this._rawDomain = [];
  }
}
