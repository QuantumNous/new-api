import type { ISeriesTheme } from '../series/interface';
import type { IMarkTheme } from '../typings/spec';
import type { IArcMarkSpec, IAreaMarkSpec, ILineMarkSpec, IRectMarkSpec, ISymbolMarkSpec, ITextMarkSpec, IPathMarkSpec, ILayoutPaddingSpec } from '../typings';
import type { MarkTypeEnum } from '../mark/interface';
import type { IColorKey, IThemeColorScheme } from './color-scheme/interface';
import type { IColor } from '@visactor/vrender-core';
import type { IComponentTheme } from '../component/interface';
import type { ITokenKey, TokenMap } from './token/interface';
import type { ChartType } from '../chart/interface';
export interface ITheme {
    name?: string;
    description?: string;
    type?: 'light' | 'dark';
    background?: IColor | IColorKey;
    padding?: ILayoutPaddingSpec;
    fontFamily?: string | ITokenKey;
    token?: TokenMap;
    colorScheme?: IThemeColorScheme;
    mark?: IGlobalMarkThemeByType;
    markByName?: IGlobalMarkThemeByName;
    series?: ISeriesTheme;
    animationThreshold?: number;
    component?: IComponentTheme;
    chart?: Record<ChartType, Omit<ITheme, 'name' | 'type' | 'description'>>;
}
export interface IGlobalMarkThemeByType {
    [MarkTypeEnum.line]?: Partial<IMarkTheme<ILineMarkSpec>>;
    [MarkTypeEnum.symbol]?: Partial<IMarkTheme<ISymbolMarkSpec>>;
    [MarkTypeEnum.area]?: Partial<IMarkTheme<IAreaMarkSpec>>;
    [MarkTypeEnum.rect]?: Partial<IMarkTheme<IRectMarkSpec>>;
    [MarkTypeEnum.arc]?: Partial<IMarkTheme<IArcMarkSpec>>;
    [MarkTypeEnum.text]?: Partial<IMarkTheme<ITextMarkSpec>>;
    [MarkTypeEnum.path]?: Partial<IMarkTheme<IPathMarkSpec>>;
}
export interface IGlobalMarkThemeByName {
    line?: Partial<IMarkTheme<ILineMarkSpec>>;
    point?: Partial<IMarkTheme<ISymbolMarkSpec>>;
    area?: Partial<IMarkTheme<IAreaMarkSpec>>;
    bar?: Partial<IMarkTheme<IRectMarkSpec>>;
    label?: Partial<IMarkTheme<ITextMarkSpec>>;
    [markName: string]: Partial<IMarkTheme<any>>;
}
