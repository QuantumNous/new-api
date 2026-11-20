import type { IRegionSpec } from '@visactor/vchart';
import { BaseComponentProps, createComponent } from './BaseComponent';

export type RegionProps = BaseComponentProps & IRegionSpec;

export const Region = createComponent<RegionProps>('Region', 'region');
