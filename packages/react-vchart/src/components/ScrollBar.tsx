import { SCROLLBAR_CUSTOMIZED_EVENTS, ScrollBarEventProps } from '../eventsUtils';
import { BaseComponentProps, createComponent } from './BaseComponent';
import type { IScrollBarSpec } from '@visactor/vchart';
import { registerScrollBar } from '@visactor/vchart';

export type ScrollBarProps = IScrollBarSpec & BaseComponentProps & ScrollBarEventProps;

export const ScrollBar = createComponent<ScrollBarProps>('ScrollBar', 'scrollBar', SCROLLBAR_CUSTOMIZED_EVENTS, false, [
  registerScrollBar
]);
