/**
 * @description 编辑器配置
 * @author wangfupeng
 */
import { EmotionsType, FontSizeConfType, IndentationType, tooltipPositionType, FontStyleType } from './menus';
import { UploadImageHooksType } from './image';
import langConfig from './lang';
import { UploadVideoHooksType } from './video';
export declare type DicType = {
    [key: string]: string;
};
export declare type ConfigType = {
    height: number;
    languageType: string[];
    languageTab: string;
    menus: string[];
    excludeMenus: string[];
    fontNames: FontStyleType;
    lineHeights: string[];
    showMenuTooltips: boolean;
    indentation: IndentationType;
    fontSizes: FontSizeConfType;
    colors: string[];
    emotions: EmotionsType[];
    zIndex: number;
    onchange: Function | null;
    onfocus: Function;
    onblur: Function;
    onchangeTimeout: number;
    pasteFilterStyle: boolean;
    pasteIgnoreImg: boolean;
    pasteTextHandle: Function;
    styleWithCSS: boolean;
    linkImgCallback: Function;
    onSelectionChange: Function;
    placeholder: string;
    zIndexFullScreen: number;
    showFullScreen: boolean;
    showLinkImg: boolean;
    showLinkImgAlt: boolean;
    showLinkImgHref: boolean;
    uploadImgAccept: string[];
    uploadImgServer: string;
    uploadImgShowBase64: boolean;
    uploadImgMaxSize: number;
    uploadImgMaxLength: number;
    uploadFileName: string;
    uploadImgParams: DicType;
    uploadImgParamsWithUrl: boolean;
    uploadImgHeaders: DicType;
    uploadImgHooks: UploadImageHooksType;
    uploadImgTimeout: number;
    withCredentials: boolean;
    customUploadImg: Function | null;
    uploadImgFromMedia: Function | null;
    customAlert: Function;
    onCatalogChange: Function | null;
    lang: string;
    languages: typeof langConfig;
    linkCheck: Function;
    linkImgCheck: Function;
    compatibleMode: () => boolean;
    historyMaxSize: number;
    focus: boolean;
    onlineVideoCheck: Function;
    onlineVideoCallback: Function;
    showLinkVideo: Boolean;
    uploadVideoAccept: string[];
    uploadVideoServer: string;
    uploadVideoMaxSize: number;
    uploadVideoName: string;
    uploadVideoParams: DicType;
    uploadVideoParamsWithUrl: boolean;
    uploadVideoHeaders: DicType;
    uploadVideoHooks: UploadVideoHooksType;
    uploadVideoTimeout: number;
    withVideoCredentials: boolean;
    customUploadVideo: Function | null;
    customInsertVideo: Function | null;
    menuTooltipPosition: tooltipPositionType;
};
export declare type Resource = {
    [language: string]: ResourceLanguage;
};
export declare type ResourceLanguage = {
    [namespace: string]: ResourceKey;
};
export declare type ResourceKey = string | {
    [key: string]: any;
};
declare const defaultConfig: any;
export default defaultConfig;
