import type {
  LayoutConfigType as ImageCloudLayoutConfig,
  GeometricMaskShape,
  shapes,
  TextShapeMask
} from '@visactor/vchart';

import type { ImageCloudAppearPresetType } from './animation';
import type { IAnimationSpec, IImageMarkSpec, IMarkSpec, ISeriesSpec } from '@visactor/vchart';
import type { ImageCloudMarkNameEnum } from './constant';

export interface IImageCloudSeriesSpec extends ISeriesSpec, IAnimationSpec<'image', ImageCloudAppearPresetType> {
  type: 'imageCloud';
  /**
   * 图片 url 字段
   */
  urlField: string;
  /**
   * 文本字段
   */
  nameField?: string;
  /**
   * 权重字段
   */
  valueField?: string;
  /**
   * 图片大小
   */
  imageSize?: number;
  /**
   * 图片大小范围
   * @default [50,50]
   */
  imageSizeRange?: [number, number];
  /**
   * 图片大小与画布大小的比例
   * @description 当 layoutType 为 spiral 时，ratio 默认 0.45；其他 layoutType 时，ratio 默认 0.1
   */
  ratio?: number;
  /**
   * 图云形状
   * @default 'circle'
   */
  maskShape?: string | keyof typeof shapes | TextShapeMask | GeometricMaskShape;

  imageMask?: {
    /**
     * 是否显示遮罩图元
     * @default false
     */
    visible?: boolean;
    /**
     * 二值化阈值。
     * 默认情况下，透明或白色的像素会被认为是背景进行剔除。
     * @default undefined
     */
    threshold?: number;
    /**
     * 反转图像
     * @default false
     */
    invert?: boolean;
    /**
     * 是否对遮罩图片去除白边
     * @default false
     */
    removeWhiteBorder?: boolean;
    style?: Partial<IImageMarkSpec>;
  };

  /**
   * 布局相关配置
   */
  layoutConfig?: ImageCloudLayoutConfig;
  /**
   * 图片图元配置
   * @description 可以根据 datum._frequency 来区分图片是否为填充图片
   */
  [ImageCloudMarkNameEnum.image]?: IMarkSpec<Partial<IImageMarkSpec>> & {
    padding?: number;
  };
}
