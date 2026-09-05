import { BaseComponentProps, createComponent } from './BaseComponent';
import type { IMarkLineSpec } from '@visactor/vchart';

export type MarkLineProps = IMarkLineSpec & BaseComponentProps;

export const MarkLine = createComponent<MarkLineProps>('MarkLine', 'markLine');
