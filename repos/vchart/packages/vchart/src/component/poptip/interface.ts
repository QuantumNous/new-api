import type { PopTipAttributes } from '@visactor/vrender-components';
import type { IColorKey } from '../../theme/color-scheme/interface';
import type { ITokenKey } from '../../theme/token/interface';

export interface IPoptipTheme extends Omit<PopTipAttributes, 'titleStyle' | 'contentStyle' | 'panel'> {
  titleStyle?: Partial<Omit<PopTipAttributes['titleStyle'], 'fill' | 'fontSize'>> & {
    fill?: PopTipAttributes['titleStyle']['fill'] | IColorKey;
    fontSize?: PopTipAttributes['titleStyle']['fontSize'] | ITokenKey;
  };
  contentStyle?: Partial<Omit<PopTipAttributes['contentStyle'], 'fill' | 'fontSize'>> & {
    fill?: PopTipAttributes['contentStyle']['fill'] | IColorKey;
    fontSize?: PopTipAttributes['contentStyle']['fontSize'] | ITokenKey;
  };
  panel?: Partial<Omit<PopTipAttributes['panel'], 'fill' | 'stroke' | 'shadowColor'>> & {
    fill?: PopTipAttributes['panel']['fill'] | IColorKey;
    stroke?: PopTipAttributes['panel']['stroke'] | IColorKey;
    shadowColor?: PopTipAttributes['panel']['shadowColor'] | IColorKey;
  };
}
