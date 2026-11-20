import { baseSeriesMark, MarkTypeEnum } from '@visactor/vchart';

export const PICTOGRAM_CHART_TYPE = 'pictogram';
export const PICTOGRAM_SERIES_TYPE = 'pictogram';

export const ELEMENT_HIGHLIGHT_BY_GRPHIC_NAME = 'element-highlight-by-graphic-name';
export const ELEMENT_SELECT_BY_GRPHIC_NAME = 'element-select-by-graphic-name';

export const enum PictogramMarkNameEnum {
  pictogram = 'pictogram'
}

export const PictogramSeriesMark = {
  ...baseSeriesMark,
  [PictogramMarkNameEnum.pictogram]: { name: PictogramMarkNameEnum.pictogram, type: MarkTypeEnum.group }
};
