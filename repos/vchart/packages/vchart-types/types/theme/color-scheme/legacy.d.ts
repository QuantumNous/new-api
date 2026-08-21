import type { BuiltinColorPalette } from './builtin';
import type { ColorSchemeItem, IColorSchemeStruct } from './interface';
export declare const newTokenToLegacyToken: Record<keyof BuiltinColorPalette, string>;
export declare const legacyTokenToNewToken: Record<string, keyof BuiltinColorPalette>;
export declare function getUpgradedTokenValue(palette: IColorSchemeStruct['palette'], key: string): ColorSchemeItem;
