import type { IModelSpec } from '../../model/interface';
import type { StringOrNumber } from '../../typings';
export interface IComponentSpec extends IModelSpec {
    regionIndex?: number | number[];
    regionId?: StringOrNumber | StringOrNumber[];
    seriesIndex?: number | number[];
    seriesId?: StringOrNumber | StringOrNumber[];
}
