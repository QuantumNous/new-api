import { BRUSH_CUSTOMIZED_EVENTS, BrushEventProps } from '../eventsUtils';
import { BaseComponentProps, createComponent } from './BaseComponent';
import type { IBrushSpec } from '@visactor/vchart';

export type BrushProps = IBrushSpec & BaseComponentProps & BrushEventProps;

export const Brush = createComponent<BrushProps>('Brush', 'brush', BRUSH_CUSTOMIZED_EVENTS, true);
