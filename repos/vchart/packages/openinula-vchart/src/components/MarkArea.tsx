import { BaseComponentProps, createComponent } from './BaseComponent';
import type { IMarkAreaSpec } from '@visactor/vchart';

export type MarkAreaProps = IMarkAreaSpec & BaseComponentProps;

export const MarkArea = createComponent<MarkAreaProps>('MarkArea', 'markArea');
