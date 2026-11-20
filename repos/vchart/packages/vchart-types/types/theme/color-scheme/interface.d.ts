import type { SeriesTypeEnum, SeriesTypeForThemeEnum } from '../../series/interface';
import type { IGradient } from '../../typings';
export type IColorSchemeStruct = {
    dataScheme: Array<DataSchemeItem> | ProgressiveDataScheme<DataSchemeItem>;
    palette?: {
        bandColor?: ColorSchemeItem;
        backgroundColor?: ColorSchemeItem;
        [key: string]: ColorSchemeItem;
    };
};
export type ProgressiveDataScheme<T> = Array<IProgressiveDataSchemeCase<T>>;
export interface IProgressiveDataSchemeCase<T> {
    maxDomainLength?: number;
    isAvailable?: boolean | IsProgressiveDataSchemeAvailableCallback;
    scheme: T[];
}
export type IsProgressiveDataSchemeAvailableCallback = (domain: any[]) => boolean;
export interface IColorKey {
    type: 'palette';
    key: string;
    l?: number;
    a?: number;
    default?: ColorSchemeItem;
}
export type DataSchemeItem = string | IColorKey;
export type ColorSchemeItem = string | IGradient;
export type ColorScheme = Array<string> | ProgressiveDataScheme<string> | IColorSchemeStruct;
export type IThemeColorScheme = {
    default: ColorScheme;
} & Partial<Record<SeriesTypeEnum, ColorScheme>> & Partial<Record<SeriesTypeForThemeEnum, ColorScheme>>;
