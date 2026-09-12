import type { AdaptiveSpec } from '../../../typings';
import { isArray } from '../../../util';
import { BaseComponentSpecTransformer } from '../../base';
import type { IDataZoomSpec, IDataZoomTheme } from './interface';
import { mergeSpec } from '@visactor/vutils-extension';

export class DataZoomSpecTransformer<
  T extends IDataZoomSpec = IDataZoomSpec,
  K extends IDataZoomTheme = IDataZoomTheme
> extends BaseComponentSpecTransformer<AdaptiveSpec<T, 'width' | 'height'>, K> {
  /** 将 theme merge 到 spec 中 */
  protected _mergeThemeToSpec(
    spec: AdaptiveSpec<T, 'width' | 'height'>,
    chartSpec: any
  ): { spec: AdaptiveSpec<T, 'width' | 'height'>; theme: K } {
    const theme = this._theme;
    let newSpec = spec;
    if (this._shouldMergeThemeToSpec()) {
      // this._originalSpec + this._theme = this._spec
      const merge = (originalSpec: any) => {
        const result = mergeSpec(
          {
            selectedBackgroundChart: {
              line: {},
              area: {}
            }
          },
          this._theme,
          originalSpec
        );

        // 兼容：为了减少主题更改造成的影响，如果用户在 spec 配置了主题默认关闭的 mark，则自动加上 visible: true
        const { selectedBackgroundChart = {} } = originalSpec;
        const { line, area } = selectedBackgroundChart;

        if (line && line.visible !== false) {
          result.selectedBackgroundChart.line.style = {
            ...result.selectedBackgroundChart.line.style,
            visible: true // FIXME: visible 应该提到更上面，等 datazoom 支持
          };
        }
        if (area && area.visible !== false) {
          result.selectedBackgroundChart.area.style = {
            ...result.selectedBackgroundChart.area.style,
            visible: true // FIXME: visible 应该提到更上面，等 datazoom 支持
          };
        }

        return result;
      };

      const baseSpec = spec;
      if (isArray(baseSpec)) {
        newSpec = baseSpec.map(spec => merge(spec)) as unknown as any;
      } else {
        newSpec = merge(baseSpec);
      }
    }

    this._adjustPadding(newSpec);
    return { spec: newSpec, theme };
  }
}
