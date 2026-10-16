import { baseSeriesMark, MarkTypeEnum } from '@visactor/vchart';

export const IMAGE_CLOUD_CHART_TYPE = 'imageCloud';
export const IMAGE_CLOUD_SERIES_TYPE = 'imageCloud';

export const enum ImageCloudMarkNameEnum {
  image = 'image',
  imageMask = 'imageMask'
}

export const imageCloudSeriesMark = {
  ...baseSeriesMark,
  [ImageCloudMarkNameEnum.image]: { name: ImageCloudMarkNameEnum.image, type: MarkTypeEnum.image },
  [ImageCloudMarkNameEnum.imageMask]: { name: ImageCloudMarkNameEnum.imageMask, type: MarkTypeEnum.rect }
};
