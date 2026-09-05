import type { LogScale } from '@visactor/vscale';
// eslint-disable-next-line no-duplicate-imports
import { LinearScale } from '@visactor/vscale';
import { CartesianAxis } from './axis';
import { isValid, isValidNumber, last, mixin } from '@visactor/vutils';
import type { IAxisHelper, ICartesianAxisCommonTheme, ICartesianLinearAxisSpec } from './interface';
import { ComponentTypeEnum } from '../../interface/type';
import { LinearAxisMixin } from '../mixin/linear-axis-mixin';
import { Factory } from '../../../core/factory';
import { registerAxis } from '../base-axis';
import { registerDataSetInstanceTransform } from '../../../data/register';
import type { ICartesianTickDataOpt } from '@visactor/vrender-components/axis/type';
import { continuousTicks } from '@visactor/vrender-components/axis/tick-data/continuous';
import { LineAxisGrid } from '@visactor/vrender-components/axis/grid/line';
import { LineAxis } from '@visactor/vrender-components/axis/line';
import { isXAxis, isZAxis } from './util';
import { combineDomains, isPercent } from '../../../util';
import type { VRenderComponentOptions } from '../../../core/interface';
import type { IGroup } from '@visactor/vrender-core';
import { AxisEnum, GridEnum } from '../interface';
import { axisLinear } from '../../../theme/builtin/common/component/axis/linear-axis';
import { axisX, axisY } from '../../../theme/builtin/common/component/axis/cartesian-axis';
import { commonAxis } from '../../../theme/builtin/common/component/axis/common-axis';

export interface CartesianLinearAxis<T extends ICartesianLinearAxisSpec = ICartesianLinearAxisSpec>
  extends Pick<
      LinearAxisMixin,
      | 'setExtraAttrFromSpec'
      | 'computeLinearDomain'
      | 'valueToPosition'
      | 'setScaleNice'
      | 'reTransformDomainByLayout'
      | '_domain'
      | 'transformScaleDomain'
      | 'setExtendDomain'
      | '_break'
    >,
    CartesianAxis<T> {}

export class CartesianLinearAxis<
  T extends ICartesianLinearAxisSpec = ICartesianLinearAxisSpec
> extends CartesianAxis<T> {
  static type = ComponentTypeEnum.cartesianLinearAxis;
  type = ComponentTypeEnum.cartesianLinearAxis;

  static specKey = 'axes';
  static readonly builtInTheme: Record<string, ICartesianAxisCommonTheme> = {
    axis: commonAxis,
    axisLinear,
    axisX,
    axisY
  };

  protected _zero: boolean = true;
  protected _nice: boolean = true;
  protected _extend: { [key: string]: number } = {};

  protected _scale: LinearScale | LogScale = new LinearScale();
  protected declare _scales: LinearScale[] | LogScale[];

  setAttrFromSpec(): void {
    super.setAttrFromSpec();
    this.setExtraAttrFromSpec();
    const tickTransform = this._tickData?.[0]
      ?.getDataView()
      .transformsArr.find(t => t.type === this.registerTicksTransform());
    tickTransform && (tickTransform.options = this._tickTransformOption());
  }

  /**
   * @override
   */
  protected initScales() {
    super.initScales();
    const range = [0, 1];
    if (isValid(this._domain?.min)) {
      range[0] = this._domain.min;
    }
    if (isValid(this._domain?.max)) {
      range[1] = this._domain.max;
    }
    this._scale.domain(range);
    // this.setScaleNice();
  }

  /**
   * @override
   * scale.range 更新到真实绘图区长度后，立刻用真实轴长重算依赖轴长的 nice（tickCount 为函数时）。
   * 这里既覆盖布局测量阶段（getBoundsInRect 内、computeData('range') 与 bounds 测量之前），
   * 也覆盖 onLayoutEnd（基类 onLayoutEnd 同样会调 updateScaleRange），
   * 从而让刻度数 / nice 天花板与最终绘图区一致，且 bounds 测量基于正确刻度（不会按布局前 viewRect
   * 的偏密刻度分配轴空间）。详见 LinearAxisMixin.reTransformDomainByLayout
   */
  updateScaleRange() {
    const isScaleChange = super.updateScaleRange();
    if (isScaleChange) {
      this.reTransformDomainByLayout();
    }
    return isScaleChange;
  }

  protected _tickTransformOption() {
    return {
      ...super._tickTransformOption(),
      breakData: this._spec.breaks?.length ? () => this._break : null
    } as ICartesianTickDataOpt;
  }

  protected _getUpdateAttribute(ignoreGrid: boolean) {
    const attrs = super._getUpdateAttribute(ignoreGrid);

    // get axis break configuration
    if (!isZAxis(this._orient) && this._break?.breaks?.length) {
      const { width, height } = this.getLayoutRect();
      const isX = isXAxis(this._orient);
      const axisLength = isX ? width : height;

      attrs.breaks = this._break.breaks.map(obj => {
        const { range, breakSymbol, gap = 6 } = obj;
        const position = this.valueToPosition((range[0] + range[1]) / 2);
        const ratio = position / axisLength;

        let gapRatio;
        if (isPercent(gap)) {
          gapRatio = Number(gap.substring(0, gap.length - 1)) / 100;
        } else {
          gapRatio = (gap as number) / axisLength;
        }
        const symbolAngle = isValidNumber(breakSymbol?.angle) ? breakSymbol.angle : isX ? 60 : 15;

        return {
          range: [ratio - gapRatio / 2, ratio + gapRatio / 2],
          breakSymbol: {
            visible: true,
            ...breakSymbol,
            angle: (symbolAngle * Math.PI) / 180
          },
          rawRange: range
        };
      });
    }

    return attrs;
  }

  protected getNewScaleRange() {
    let newRange = super.getNewScaleRange();
    if (this._spec.breaks?.length && this._break?.scope) {
      // get axis breaks
      newRange = combineDomains(this._break.scope).map(val => newRange[0] + (last(newRange) - newRange[0]) * val);
    }

    return newRange;
  }

  protected computeDomain(data: { min: number; max: number; values: any[] }[]): number[] {
    return this.computeLinearDomain(data);
  }

  protected axisHelper() {
    const helper: IAxisHelper = super.axisHelper();
    helper.setExtendDomain = this.setExtendDomain.bind(this);
    helper.valueToPosition = this.valueToPosition.bind(this);
    return helper;
  }

  protected registerTicksTransform() {
    const name = `${this.type}-ticks`;
    registerDataSetInstanceTransform(this._option.dataSet, name, continuousTicks);

    return name;
  }
}

mixin(CartesianLinearAxis, LinearAxisMixin);

export const registerCartesianLinearAxis = () => {
  Factory.registerGraphicComponent(AxisEnum.lineAxis, (attrs: any, options: VRenderComponentOptions) => {
    return new LineAxis(attrs, options) as unknown as IGroup;
  });
  Factory.registerGraphicComponent(GridEnum.lineAxisGrid, (attrs: any, options: VRenderComponentOptions) => {
    return new LineAxisGrid(attrs, options) as unknown as IGroup;
  });
  registerAxis();
  Factory.registerComponent(CartesianLinearAxis.type, CartesianLinearAxis);
};
