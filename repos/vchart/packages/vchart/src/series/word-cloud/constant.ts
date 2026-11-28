import { MarkTypeEnum } from '../../mark/interface/type';
import { baseSeriesMark } from '../base/constant';
import type { SeriesMarkMap } from '../interface/common';
import { SeriesMarkNameEnum } from '../interface/type';

export const wordCloudSeriesMark: SeriesMarkMap = {
  ...baseSeriesMark,
  [SeriesMarkNameEnum.word]: { name: SeriesMarkNameEnum.word, type: MarkTypeEnum.text },
  [SeriesMarkNameEnum.fillingWord]: { name: SeriesMarkNameEnum.fillingWord, type: MarkTypeEnum.text },
  [SeriesMarkNameEnum.wordMask]: { name: SeriesMarkNameEnum.wordMask, type: MarkTypeEnum.rect }
};
