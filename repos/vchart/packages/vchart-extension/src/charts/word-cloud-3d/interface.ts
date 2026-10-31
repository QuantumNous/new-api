import type {
  IChartExtendsSeriesSpec,
  IChartSpec,
  IMarkSpec,
  ITextMarkSpec,
  IWordCloudSeriesBaseSpec,
  SeriesMarkNameEnum
} from '@visactor/vchart';

export interface IWordCloud3dChartSpec extends IChartSpec, IChartExtendsSeriesSpec<IWordCloud3dSeriesSpec> {
  type: 'wordCloud3d';
  series?: IWordCloud3dSeriesSpec[];
}

export interface IWordcloud3dAnimationParams {
  radius: number;
  depth_3d: number;
}

export interface IWordCloud3dSeriesSpec extends IWordCloudSeriesBaseSpec {
  type: 'wordCloud3d';
  depth_3d?: number; // 词云的半径深度
  postProjection?: 'StereographicProjection'; // 词云投影的算法
}

export interface IWordCloud3dSeriesTheme {
  [SeriesMarkNameEnum.word]?: IMarkSpec<ITextMarkSpec> & {
    padding?: number;
  };
  [SeriesMarkNameEnum.fillingWord]?: IMarkSpec<ITextMarkSpec> & {
    padding?: number;
  };
}
