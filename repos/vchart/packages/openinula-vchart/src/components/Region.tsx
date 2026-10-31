import type { IRegionSpec } from '@visactor/vchart';
import { BaseComponentProps, createComponent } from './BaseComponent';

export interface RegionProps extends BaseComponentProps, IRegionSpec {
  //
}

export const Region = createComponent<RegionProps>('Region', 'region');
