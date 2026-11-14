import { BaseComponentSpecTransformer } from '@visactor/vchart';
import type { IMapLabelSpec, IMapLabelStyleSpec } from './type';
import { mapLabel } from './theme';

export class MapLabelSpecTransformer<
  T extends IMapLabelSpec = IMapLabelSpec,
  K extends IMapLabelStyleSpec = IMapLabelStyleSpec
> extends BaseComponentSpecTransformer<T, K> {
  protected _getDefaultSpecFromChart(): Partial<T> {
    return mapLabel as Partial<T>;
  }
}
