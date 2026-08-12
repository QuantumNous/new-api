import { BaseSeriesProps, createSeries } from './BaseSeries';
import type { ILinkSeriesSpec } from '@visactor/vchart';
import { registerLinkSeries } from '@visactor/vchart';

export type LinkProps = BaseSeriesProps & Omit<ILinkSeriesSpec, 'type'>;

export const Link = createSeries<LinkProps>('Link', ['link'], 'link', [registerLinkSeries]);
