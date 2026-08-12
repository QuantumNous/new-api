import type { ITextMarkSpec, IMarkSpec, ISeriesSpec, ITextFormatMethod, IRectMarkSpec } from '../../typings';
import type { IAnimationSpec, IMarkAnimateSpec, IStateAnimateSpec } from '../../animation/spec';
import type { SeriesMarkNameEnum } from '../interface/type';
import type { shapes, GeometricMaskShape, TextShapeMask } from '@visactor/vlayouts';
import type { IAnimationTypeConfig } from '../../animation/interface';

export interface IWordcloudAnimationParams {
  animationConfig: () => IAnimationTypeConfig;
}

export type WordcloudAppearPreset = 'scaleIn' | 'fadeIn';

export type WordCloudShapeType = keyof typeof shapes;

export type EllipsisType = {
  /**
   * 超长文本替代字符串
   * @default '...'
   */
  string?: string;
  /**
   * 限制长度
   * @description 超过该长度的部分展示用户指定字符串
   */
  limitLength?: number;
};

export type ZoomToFitType = {
  repeat?: boolean;
  /**
   * 是否缩小
   */
  shrink?: boolean;
  /**
   * 是否放大
   */
  enlarge?: boolean;
  /**
   * 缩小的最小字号
   * @description shrink: true时生效
   */
  fontSizeLimitMin?: number;
  /**
   * 放大的最大字号
   * @description enlarge: true时生效
   */
  fontSizeLimitMax?: number;
};
/**
 * 超出画布的超长文本处理方式
 * @description 'clip': 绘制超长文本，超出画布的部分裁剪掉; 'hidden': 不绘制超长文本; 'ellipsis'绘制超长文本，且使用用户指定的字符串代替超出的文本
 */
export type DrawOutOfBoundType = 'clip' | 'hidden' | 'ellipsis';

export type WordCloudConfigType = {
  /**
   * 超长文本省略策略, 超出画布
   * @default 'hidden'
   */
  drawOutOfBound?: DrawOutOfBoundType; // 默认hidden
  /**
   * TODO: 省略文本的配置
   */
  ellipsis?: EllipsisType;
  /**
   * 布局模式:
   * 'fast': 快速布局，用于小程序 & 小组件环境
   * 'grid': 基于grid像素布局
   * 'default': 基于像素布局
   */
  layoutMode?: 'fast' | 'grid' | 'default';
  /**
   * 自适应缩放配置
   */
  zoomToFit: ZoomToFitType;
  /**
   * 渐进式渲染配置 - 布局时间
   */
  progressiveTime?: number;
  /**
   * 渐进式渲染配置 - 布局次数
   */
  progressiveStep?: number;
};
export type WordCloudShapeConfigType = {
  /**
   * 填充词 - 颜色通道
   */
  fillingSeriesField?: string;
  /**
   * 填充词 - 颜色列表
   */
  fillingColorList?: string[];
  /**
   * 填充词 - 字体字段
   */
  fillingFontFamilyField?: string;
  /**
   * 填充词 - 字重字段
   */
  fillingFontWeightField?: string;
  /**
   * 填充词 - 字体样式字段
   */
  fillingFontStyleField?: string;
  /**
   * 填充词 - 直接指定 hex 颜色字段
   */
  fillingColorHexField?: string;
  /**
   * 填充词 - 可旋转角度 随机取范围
   */
  fillingRotateAngles?: number[];
  /**
   * 整体布局 - 自动计算核心词时期望的比例
   */
  ratio?: number;
  /**
   * 整体布局 - 是否对输入图片去除白边
   */
  removeWhiteBorder?: boolean;
  /**
   * 整体布局 - 布局模式
   */
  layoutMode?: 'default' | 'ensureMapping' | 'ensureMappingEnlarge';
  /**
   * 填充布局 - 填充文字填充次数
   */
  fillingTimes?: number;
  /**
   * 填充布局 - 填充时 x 的前进范围
   */
  fillingXStep?: number;
  /**
   * 填充布局 - 填充时 y 的前进范围
   */
  fillingYStep?: number;
  /**
   * 填充布局 - 填充时 x 的前进范围（相对宽度比例）
   */
  fillingXRatioStep?: number;
  /**
   * 填充布局 - 填充时 y 的前进范围（相对高度比例）
   */
  fillingYRatioStep?: number;
  /**
   * 填充布局 - 填充文字初始大小
   */
  fillingInitialFontSize?: number;
  /**
   * 填充布局 - 填充文字每次填充大小缩小值
   */
  fillingDeltaFontSize?: number;
  /**
   * 填充布局 - 填充文字初始透明度
   */
  fillingInitialOpacity?: number;
  /**
   * 填充布局 - 填充文字每次透明度缩小值
   */
  fillingDeltaOpacity?: number;
  /**
   * 填充布局 - 单词尝试布局次数
   */
  textLayoutTimes?: number;
  /**
   * 填充布局 - 每次布局失败后，缩小字号的系数
   */
  fontSizeShrinkFactor?: number;
  /**
   * 填充布局 - 布局步长系数
   */
  stepFactor?: number;
  /**
   * 填充布局 - 重要词数
   */
  importantWordCount?: number;
  /**
   * 填充布局 - 字号缩小限制
   */
  globalShinkLimit?: number;
  /**
   * 填充布局 - 每次布局成功后，放大字号的系数
   */
  fontSizeEnlargeFactor?: number;
  /**
   * 填充布局 - 填充词自动计算字号后，每次迭代字号缩小的系数
   */
  fillingDeltaFontSizeFactor?: number;
  /**
   * 填充布局 - 自动计算填充词时期望的比例
   */
  fillingRatio?: number;
};

export interface IWordCloudSeriesBaseSpec
  extends ISeriesSpec,
    IAnimationSpec<SeriesMarkNameEnum.word, WordcloudAppearPreset> {
  /**
   * 文本字段
   */
  nameField: string;
  /**
   * 权重字段
   */
  valueField?: string;
  /**
   * 字体字段
   */
  fontFamilyField?: string;
  /**
   * 字重字段
   */
  fontWeightField?: string;
  /**
   * 字体样式字段
   */
  fontStyleField?: string;
  /**
   * 直接指定 hex 颜色字段
   */
  colorHexField?: string;
  /**
   * 颜色模式
   * TODO: 'linear' 待支持
   */
  colorMode?: 'ordinal';
  /**
   * 颜色列表
   */
  colorList?: string[];
  /**
   * 可旋转角度 随机取范围
   */
  rotateAngles?: number[];
  /**
   * 字重范围
   * @default [200,500]
   */
  fontWeightRange?: [number, number]; // 需要固定字重大小的话，数组里面的数就配置成一样的
  /**
   * 字体大小范围
   * @description 当valueField存在时，默认值[20,40]; 当valueField不存在时，默认值[10, 10]
   * @since 1.8.7 如果配置为'auto', 则fontSizeRange不传入, 字体大小会随画布大小改变而改变
   */
  fontSizeRange?: [number, number] | 'auto'; // 需要固定字体大小的话，数组里面的数就配置成一样的
  /**
   * 词云形状
   * @default 'circle'
   *
   * 注意，文字类型和几何形状类型的shape自 1.12.0 版本开始支持
   */
  maskShape?: string | WordCloudShapeType | TextShapeMask | GeometricMaskShape; // url 或 svg字符串 或 base64，或shape字符串
  /**
   * TODO: 缩放mask时是否保持比例
   */
  keepAspect?: boolean;
  /**
   * 是否开始随机摆放方向(顺时针｜逆时针), 主要用于spec测试
   */
  random?: boolean;
  /**
   * 词云特殊配置
   */
  wordCloudConfig?: WordCloudConfigType;
  /**
   * 形状词云特殊配置
   */
  wordCloudShapeConfig?: WordCloudShapeConfigType;
  /**
   * 词云文字图元配置 或 形状词云核心词文字图元配置
   * @description hover配置随图元state，此外增加padding: 字体间距 和 formatMethod: 文本格式化
   */
  [SeriesMarkNameEnum.word]?: IMarkSpec<ITextMarkSpec> & {
    padding?: number;
    formatMethod?: ITextFormatMethod<[datum?: any]>;
  };
  /**
   * 形状词云填充词文字图元配置
   * @description hover配置随图元state，此外增加padding: 字体间距
   * @description 不增加formatMethod的原因：形状词云在做布局时，word和fillingWord用的是同一份数据，即text相同，所以fillingWords的format不会生效
   * @deprecated
   */
  [SeriesMarkNameEnum.fillingWord]?: IMarkSpec<ITextMarkSpec> & {
    padding?: number;
  };

  /**
   * 当形状词云的形状为文字类型和几何形状类型的时候，支持绘制形状轮廓
   * @since 1.12.0
   */
  [SeriesMarkNameEnum.wordMask]?: IMarkSpec<IRectMarkSpec>;

  animationAppear?:
    | boolean
    | (IStateAnimateSpec<WordcloudAppearPreset> & {
        /**
         * 默认prest('scaleIn')时，duration为词云中单个词的动画参考时长。当单词数过多，会根据单词总数和总动画时长进行动态调整
         * prest为 'fadeIn' 时，则为总动画时长。
         */
        duration?: number;
        /**
         * 词云入场动画总时长，在默认prest('scaleIn')时生效。
         * @default 1000
         * @since 1.4.0
         */
        totalTime?: number;
      })
    | IMarkAnimateSpec<string>;
}

export interface IWordCloudSeriesSpec extends IWordCloudSeriesBaseSpec {
  type: 'wordCloud';
}
export interface IWordCloudSeriesTheme {
  [SeriesMarkNameEnum.word]?: IMarkSpec<ITextMarkSpec> & {
    padding?: number;
  };
  [SeriesMarkNameEnum.fillingWord]?: IMarkSpec<ITextMarkSpec> & {
    padding?: number;
  };
}
