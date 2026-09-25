import { DATAZOOM_CUSTOMIZED_EVENTS, DataZoomEventProps } from '../eventsUtils';
import { BaseComponentProps, createComponent } from './BaseComponent';
import type { IDataZoomSpec } from '@visactor/vchart';

export type DataZoomProps = IDataZoomSpec & BaseComponentProps & DataZoomEventProps;
export const DataZoom = createComponent<DataZoomProps>('DataZoom', 'dataZoom', DATAZOOM_CUSTOMIZED_EVENTS);
