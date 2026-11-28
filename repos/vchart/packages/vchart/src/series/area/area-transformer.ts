import { isValid } from '@visactor/vutils';
import type { IChartSpecInfo } from '../../chart/interface';
import { SeriesMarkNameEnum } from '../interface';
import { LineLikeSeriesSpecTransformer } from '../mixin/line-mixin-transformer';
import type { AreaSeries } from './area';
import type { IAreaSeriesSpec, IAreaSeriesTheme } from './interface';
import type { ConvertToMarkStyleSpec, IAreaMarkSpec } from '../../typings';
import { mergeSpec } from '@visactor/vutils-extension';

export class AreaSeriesSpecTransformer<
  T extends IAreaSeriesSpec = IAreaSeriesSpec,
  K extends IAreaSeriesTheme = IAreaSeriesTheme
> extends LineLikeSeriesSpecTransformer<T, K> {
  protected _supportStack: boolean = true;

  protected _transformLabelSpec(spec: T): void {
    const isPointVisible = spec.point?.visible !== false && spec.point?.style?.visible !== false;

    this._addMarkLabelSpec(spec, (spec: any) => {
      const isAreaMiddle = spec.position === 'inside-middle';
      return !isPointVisible || isAreaMiddle ? SeriesMarkNameEnum.area : SeriesMarkNameEnum.point;
    });

    this._addMarkLabelSpec<AreaSeries>(
      spec,
      SeriesMarkNameEnum.area,
      'areaLabel' as any,
      'initLineLabelMarkStyle',
      undefined,
      true
    );
  }

  protected _transformSpecAfterMergingTheme(spec: T, chartSpec: any, chartSpecInfo?: IChartSpecInfo) {
    super._transformSpecAfterMergingTheme(spec, chartSpec, chartSpecInfo);

    const { area = {}, line = {}, seriesMark } = spec;
    const isAreaVisible = area.visible !== false && area.style?.visible !== false;
    const isLineVisible = line.visible !== false && line.style?.visible !== false;
    // merge line to area

    area.support3d = !!(area.support3d || line.support3d);
    area.zIndex =
      isValid(area.zIndex) || isValid(line.zIndex) ? Math.max(area.zIndex ?? 0, line.zIndex ?? 0) : undefined;

    // remove area stroke
    if (area.style) {
      delete area.style.stroke;
    }
    if (area.state) {
      Object.keys(area.state).forEach(state => {
        if ('style' in area.state[state]) {
          delete area.state[state].style.stroke;
        } else {
          delete (<ConvertToMarkStyleSpec<IAreaMarkSpec>>area.state[state]).stroke;
        }
      });
    }
    // check which one is main
    let mainSpec = area;
    let subSpec = line;
    if (seriesMark === 'line' || (isLineVisible && !isAreaVisible)) {
      mainSpec = line;
      subSpec = area;
    }
    area.style = mergeSpec({}, subSpec.style, mainSpec.style);
    area.state = mergeSpec({}, subSpec.state, mainSpec.state);

    if (area.interactive === false) {
      area.style.fillPickable = false;
    }
    if (line.interactive === false) {
      line.style.strokePickable = false;
    }

    area.interactive = !!(area.interactive || (line.interactive ?? true));

    spec.area = area;
    spec.line = line;
  }
}
