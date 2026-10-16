import type { DirectionType, ISeriesSpec } from '../../typings';
import type { ICartesianSeriesSpec } from '../cartesian';
import { SeriesTypeEnum } from '../interface';
import type { ISankeySeriesSpec } from '../sankey/interface';

export function getDirectionFromSeriesSpec(spec: ISeriesSpec): DirectionType {
  const { type } = spec;

  if (type === SeriesTypeEnum.sankey) {
    return (spec as ISankeySeriesSpec).direction ?? 'horizontal';
  }

  return (spec as ICartesianSeriesSpec).direction ?? 'vertical';
}
