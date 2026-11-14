import { BaseComponentProps, createComponent } from './BaseComponent';
import type { ICartesianAxisSpec, IPolarAxisSpec } from '@visactor/vchart';

export type AxisProps = (ICartesianAxisSpec | IPolarAxisSpec) & BaseComponentProps;

export const Axis = createComponent<AxisProps>('Axis', 'axes');
