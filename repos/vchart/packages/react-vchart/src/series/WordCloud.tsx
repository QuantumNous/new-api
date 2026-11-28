import { BaseSeriesProps, createSeries } from './BaseSeries';
import type { IWordCloudSeriesSpec } from '@visactor/vchart';
import { registerWordCloudSeries } from '@visactor/vchart';

export type WordCloudProps = BaseSeriesProps & Omit<IWordCloudSeriesSpec, 'type'>;

export const WordCloud = createSeries<WordCloudProps>('WordCloud', ['wordCloud'], 'wordCloud', [
  registerWordCloudSeries
]);
