import { BaseComponentProps, createComponent } from './BaseComponent';
import type { ICartesianCrosshairSpec, IPolarCrosshairSpec } from '@visactor/vchart';

export type CrosshairProps = (ICartesianCrosshairSpec | IPolarCrosshairSpec) & BaseComponentProps;

export const Crosshair = createComponent<CrosshairProps>('Crosshair', 'crosshair');
