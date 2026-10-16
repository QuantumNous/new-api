import type { Maybe } from '@visactor/vutils';
import type { IGlobalMarkThemeByName, IGlobalMarkThemeByType, ITheme } from '../../theme';
import type { IThemeColorScheme } from '../../theme/color-scheme/interface';
export declare function mergeTheme(target: Maybe<ITheme>, ...sources: Maybe<ITheme>[]): Maybe<ITheme>;
export declare function transformColorSchemeToMerge(colorScheme?: Maybe<IThemeColorScheme>): Maybe<IThemeColorScheme>;
export declare function transformSeriesThemeToMerge(seriesTheme: any, seriesType: string, markByType: IGlobalMarkThemeByType, markByName: IGlobalMarkThemeByName): any;
