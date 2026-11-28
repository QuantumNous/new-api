import type { ITooltipSpec, ITooltipTextTheme, ITooltipTheme } from '../../../../component/tooltip';
export declare const getPixelPropertyStr: (num?: number | number[], defaultStr?: string) => string;
export declare const getTextStyle: (style?: ITooltipTextTheme, textStyle?: Partial<CSSStyleDeclaration>) => Partial<CSSStyleDeclaration>;
export declare const getLineHeight: (style?: ITooltipTextTheme) => number;
export declare const getDomStyle: (spec?: ITooltipSpec) => {
    panelPadding: number[];
    row: Partial<CSSStyleDeclaration>;
    panel: Partial<CSSStyleDeclaration>;
    title: Partial<CSSStyleDeclaration>;
    shape: Partial<CSSStyleDeclaration>;
    key: Partial<CSSStyleDeclaration>;
    value: Partial<CSSStyleDeclaration>;
};
export declare const getPanelStyle: (style: ITooltipTheme['panel']) => {
    panelStyle: Partial<CSSStyleDeclaration>;
    panelPadding?: number[];
};
export declare function setStyleToDom(dom: HTMLElement, style: Partial<CSSStyleDeclaration>): void;
