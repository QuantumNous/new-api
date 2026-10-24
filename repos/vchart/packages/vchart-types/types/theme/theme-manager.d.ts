import type { ITheme } from './interface';
export declare class ThemeManager {
    static readonly themes: Map<string, ITheme>;
    private static _currentThemeName;
    static registerTheme(name: string, theme: Partial<ITheme>): void;
    static getTheme(name: string, transformed?: boolean): ITheme;
    static removeTheme(name: string): boolean;
    static themeExist(name: any): boolean;
    static getDefaultTheme(): ITheme;
    static setCurrentTheme(name: string): void;
    static getCurrentTheme(transformed?: boolean): ITheme;
    static getCurrentThemeName(): string;
}
