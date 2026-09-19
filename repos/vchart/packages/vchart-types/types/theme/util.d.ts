import type { ITheme } from './interface';
import type { IThemeColorScheme } from './color-scheme/interface';
import type { IModelOption } from '../model/interface';
export declare const mergeThemeAndGet: (path: string, currentThemeName?: string, optionTheme?: string | ITheme, specTheme?: string | ITheme, colorScheme?: IThemeColorScheme) => any;
export declare const getThemeFromOption: (path: string, option: Partial<IModelOption>) => any;
