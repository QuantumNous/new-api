import { BaseComponentProps, createComponent } from './BaseComponent';
import type { IMarkPointSpec } from '@visactor/vchart';
import { registerMarkPoint } from '@visactor/vchart';

export type MarkPointProps = IMarkPointSpec & BaseComponentProps;

export const MarkPoint = createComponent<MarkPointProps>('MarkPoint', 'markPoint', null, false, [registerMarkPoint]);
