import { BaseComponentProps, createComponent } from './BaseComponent';
import type { ITitleSpec } from '@visactor/vchart';

export type TitleProps = ITitleSpec & BaseComponentProps;

export const Title = createComponent<TitleProps>('Title', 'title', null, true);
