/* eslint-disable no-duplicate-imports */
import { SeriesTypeEnum } from '../interface/type';
import type { IWordCloudSeriesSpec } from './interface';
import { BaseWordCloudSeries } from './base';
import { Factory } from '../../core/factory';
import { registerWordCloudAnimation } from './animation';
import { wordcloudTransform, wordcloudShapeTransform } from '@visactor/vlayouts';
import { registerTextMark } from '../../mark/text';

export class WordCloudSeries<T extends IWordCloudSeriesSpec = IWordCloudSeriesSpec> extends BaseWordCloudSeries<T> {
  static readonly type: string = SeriesTypeEnum.wordCloud;
  type = SeriesTypeEnum.wordCloud;
}

export const registerWordCloudSeries = () => {
  Factory.registerGrammarTransform('wordcloud', {
    transform: wordcloudTransform
  });
  registerTextMark();
  registerWordCloudAnimation();
  Factory.registerSeries(WordCloudSeries.type, WordCloudSeries);
};

export const registerWordCloudShapeSeries = () => {
  Factory.registerGrammarTransform('wordcloudShape', {
    transform: wordcloudShapeTransform
  });
  registerWordCloudSeries();
};
