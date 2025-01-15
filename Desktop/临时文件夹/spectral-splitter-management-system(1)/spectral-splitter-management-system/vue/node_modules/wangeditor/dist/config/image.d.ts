/**
 * @description 图片相关的配置
 * @author wangfupeng
 */
import Editor from '../editor/index';
import { EMPTY_FN } from '../utils/const';
import { ResType } from '../menus/img/upload-img';
export declare type UploadImageHooksType = {
    before?: (xhr: XMLHttpRequest, editor: Editor, files: File[]) => {
        prevent: boolean;
        msg: string;
    } | void;
    success?: (xhr: XMLHttpRequest, editor: Editor, result: ResType) => void;
    fail?: (xhr: XMLHttpRequest, editor: Editor, err: ResType | string) => void;
    error?: (xhr: XMLHttpRequest, editor: Editor) => void;
    timeout?: (xhr: XMLHttpRequest, editor: Editor) => void;
    customInsert?: (inserImg: (this: Editor, src: string) => void, result: ResType, editor: Editor) => void;
};
declare const _default: {
    linkImgCheck: (src: string, alt?: string | undefined, href?: string | undefined) => string | boolean;
    showLinkImg: boolean;
    showLinkImgAlt: boolean;
    showLinkImgHref: boolean;
    linkImgCallback: typeof EMPTY_FN;
    uploadImgAccept: string[];
    uploadImgServer: string;
    uploadImgShowBase64: boolean;
    uploadImgMaxSize: number;
    uploadImgMaxLength: number;
    uploadFileName: string;
    uploadImgParams: {};
    uploadImgParamsWithUrl: boolean;
    uploadImgHeaders: {};
    uploadImgHooks: {};
    uploadImgTimeout: number;
    withCredentials: boolean;
    customUploadImg: null;
    uploadImgFromMedia: null;
};
export default _default;
