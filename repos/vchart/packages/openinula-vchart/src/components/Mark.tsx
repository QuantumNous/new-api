import type { ICustomMarkSpec, EnableMarkType } from '@visactor/vchart';
import { BaseComponentProps, createComponent } from './BaseComponent';

export type MarkProps = ICustomMarkSpec<EnableMarkType> & BaseComponentProps;

export const Mark = createComponent<MarkProps>('Mark', 'customMark');
