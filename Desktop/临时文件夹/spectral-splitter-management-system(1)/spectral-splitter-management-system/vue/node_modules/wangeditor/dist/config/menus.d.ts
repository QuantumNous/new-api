/**
 * @description 菜单配置
 * @author wangfupeng
 */
export declare type EmotionsContentType = {
    alt: string;
    src: string;
};
export declare type EmotionsType = {
    title: string;
    type: string;
    content: Array<EmotionsContentType | string>;
};
export declare type FontSizeConfType = {
    [key: string]: {
        name: string;
        value: string;
    };
};
export declare type FontStyleType = Array<{
    name: string;
    value: string;
} | string>;
export interface IndentationOptions {
    value: number;
    unit: string;
}
export declare type IndentationType = string | IndentationOptions;
export declare type tooltipPositionType = 'up' | 'down';
declare const _default: {
    menus: string[];
    fontNames: string[];
    fontSizes: {
        'x-small': {
            name: string;
            value: string;
        };
        small: {
            name: string;
            value: string;
        };
        normal: {
            name: string;
            value: string;
        };
        large: {
            name: string;
            value: string;
        };
        'x-large': {
            name: string;
            value: string;
        };
        'xx-large': {
            name: string;
            value: string;
        };
        'xxx-large': {
            name: string;
            value: string;
        };
    };
    colors: string[];
    languageType: string[];
    languageTab: string;
    /**
     * 表情配置菜单
     * 如果为emoji表情直接作为元素插入
     * emoticon:Array<EmotionsType>
     */
    emotions: {
        title: string;
        type: string;
        content: string[];
    }[];
    lineHeights: string[];
    undoLimit: number;
    indentation: string;
    showMenuTooltips: boolean;
    menuTooltipPosition: string;
};
export default _default;
