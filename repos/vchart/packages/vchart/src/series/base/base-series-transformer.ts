import { isBoolean, isFunction, isNil, isObject } from '@visactor/vutils';
import type { IChartSpecInfo } from '../../chart/interface';
import type { ILabelSpec, TransformedLabelSpec } from '../../component/label';
import { BaseModelSpecTransformer } from '../../model/base-model-transformer';
import type { ISeriesSpec } from '../../typings';
import { array, get, isArray, isValid, transformSeriesThemeToMerge } from '../../util';
import { mergeSpec } from '@visactor/vutils-extension';
import type { ISeriesSpecTransformerResult, SeriesMarkNameEnum } from '../interface';
// eslint-disable-next-line no-duplicate-imports
import type { ISeries } from '../interface';
import { getDirectionFromSeriesSpec } from '../util/spec';
import { Factory } from '../../core/factory';

export class BaseSeriesSpecTransformer<T extends ISeriesSpec, K> extends BaseModelSpecTransformer<T, K> {
  markLabelSpec: Partial<Record<SeriesMarkNameEnum, TransformedLabelSpec[]>> = {};
  stack: boolean;
  protected _supportStack: boolean;

  getLabelSpec(markName: string) {
    return this.markLabelSpec[markName];
  }

  setLabelSpec(markName: string, label: TransformedLabelSpec | TransformedLabelSpec[]) {
    this.markLabelSpec[markName] = array(label);
  }

  addLabelSpec(markName: string, label: TransformedLabelSpec, head = false) {
    if (!this.markLabelSpec[markName]) {
      this.markLabelSpec[markName] = [];
    }
    if (head) {
      // 排序靠前的 label 优先布局，尽可能避免碰撞隐藏
      this.markLabelSpec[markName].unshift(label);
    } else {
      this.markLabelSpec[markName].push(label);
    }
  }

  getTheme(spec: T, chartSpec: any): K {
    const direction = getDirectionFromSeriesSpec(spec);
    const getTheme = this._option?.getTheme;
    // const { markByName, mark } = chartTheme;
    const type = this._option.type;
    // 基本主题
    const seriesMarkMap = Factory.getSeriesMarkMap(type);

    const theme = seriesMarkMap ? transformSeriesThemeToMerge(getTheme('series', type), type, getTheme) : {};
    // 区分方向的主题
    const themeWithDirection = getTheme('series', `${type}_${direction}`);
    // stack 状态下的主题
    const stack = this.stack ?? themeWithDirection?.stack ?? theme?.stack;
    const themeWithStack = stack ? getTheme('series', `${type}_stack`) : undefined;
    return mergeSpec({}, theme, themeWithDirection, themeWithStack);
  }

  /** 不建议重写该方法，最好重写对应子步骤 */
  transformSpec(spec: T, chartSpec: any, chartSpecInfo?: IChartSpecInfo): ISeriesSpecTransformerResult<T, K> {
    this._transformStack(spec);
    const result = super.transformSpec(spec, chartSpec, chartSpecInfo);
    this._transformLabelSpec(result.spec);
    return {
      ...result,
      markLabelSpec: this.markLabelSpec,
      stack: this.stack
    };
  }

  protected _transformLabelSpec(spec: T) {
    // empty
  }

  protected _transformStack(spec: T) {
    if (isBoolean(spec.stack)) {
      this.stack = spec.stack;
    }
    if (isBoolean(spec.percent)) {
      this.stack = spec.percent || this.stack; // this.stack is `true` in bar/area series
    }

    if (isNil(this.stack) && this._supportStack && spec.seriesField) {
      // only set default value of stack to be `true` when series support stack and seriesField is not null
      this.stack = true;
    }
  }

  protected _addMarkLabelSpec<V extends ISeries = ISeries>(
    spec: T,
    markName: string | ((spec: ILabelSpec) => string),
    labelSpecKey: keyof T = 'label' as any,
    styleHandlerName: keyof V = 'initLabelMarkStyle',
    hasAnimation: boolean = true,
    head?: boolean
  ): void {
    if (!spec) {
      return;
    }
    const labels = array<ILabelSpec>(spec[labelSpecKey]);
    labels.forEach(labelSpec => {
      if (labelSpec && labelSpec.visible) {
        // animation config priority: option.animation > spec.animation > spec.label.animation
        const {
          animation = true,
          animationUpdate: labelAnimationUpdate = true,
          animationEnter: labelAnimationEnter = true,
          animationExit: labelAnimationExit = true
        } = labelSpec;
        const { animationUpdate = true, animationEnter = true, animationExit = true } = spec as any;
        const animationEnabled =
          this._option.globalInstance?.isAnimationEnable() ?? spec.animation ?? labelSpec.animation;
        const labelAnimationEnabled = !!animationEnabled && !!hasAnimation;

        this.addLabelSpec(
          isFunction(markName) ? markName(labelSpec) : markName,
          {
            ...labelSpec,
            animation: labelAnimationEnabled ? animation : false,
            animationUpdate: labelAnimationEnabled && animationUpdate && labelAnimationUpdate ? animationUpdate : false,
            animationEnter: labelAnimationEnabled && animationEnter && labelAnimationEnter ? animationEnter : false,
            animationExit: labelAnimationEnabled && animationEnter && labelAnimationExit ? animationExit : false,
            getStyleHandler: (series: V) => (series[styleHandlerName] as any)?.bind(series)
          } as TransformedLabelSpec,
          head
        );
      }
    });
  }

  protected _getDefaultSpecFromChart(chartSpec: any): any {
    const spec = (super._getDefaultSpecFromChart(chartSpec) as any) ?? {};
    const { outerRadius, innerRadius, direction } = chartSpec;
    if (isValid(outerRadius)) {
      spec.outerRadius = outerRadius;
    }
    if (isValid(innerRadius)) {
      spec.innerRadius = innerRadius;
    }

    if (isValid(direction)) {
      spec.direction = direction;
    }

    return Object.keys(spec).length > 0 ? spec : undefined;
  }

  protected _mergeThemeToSpec(spec: T, chartSpec: any): { spec: T; theme: K } {
    const theme = this._theme;

    if (this._shouldMergeThemeToSpec()) {
      const specFromChart = this._getDefaultSpecFromChart(chartSpec);
      // this._originalSpec + specFromChart + this._theme = spec
      const merge = (originalSpec: any) => {
        const result = mergeSpec({}, theme, specFromChart, originalSpec);
        const labelTheme = (theme as any).label;
        if (labelTheme && isObject(labelTheme) && isArray(result.label)) {
          result.label = result.label.map((label: ILabelSpec) => mergeSpec({}, labelTheme, label));
        }
        return result;
      };

      if (isArray(spec)) {
        return {
          spec: spec.map(specItem => merge(specItem)) as unknown as T,
          theme
        };
      }

      return {
        spec: merge(spec),
        theme
      };
    }
    return { spec, theme };
  }
}
