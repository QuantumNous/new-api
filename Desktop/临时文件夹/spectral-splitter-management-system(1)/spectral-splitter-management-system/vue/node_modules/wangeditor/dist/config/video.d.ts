/**
 * @description 视频相关的配置
 * @author hutianhao
 */
import Editor from '../editor/index';
import { EMPTY_FN } from '../utils/const';
import { ResType } from '../menus/video/upload-video';
export declare type UploadVideoHooksType = {
    before?: (xhr: XMLHttpRequest, editor: Editor, files: File[]) => {
        prevent: boolean;
        msg: string;
    } | void;
    success?: (xhr: XMLHttpRequest, editor: Editor, result: ResType) => void;
    fail?: (xhr: XMLHttpRequest, editor: Editor, err: ResType | string) => void;
    error?: (xhr: XMLHttpRequest, editor: Editor) => void;
    timeout?: (xhr: XMLHttpRequest, editor: Editor) => void;
    customInsert?: (inserVideo: (this: Editor, src: string) => void, result: ResType, editor: Editor) => void;
};
declare const _default: {
    onlineVideoCheck: (video: string) => string | boolean;
    onlineVideoCallback: typeof EMPTY_FN;
    showLinkVideo: boolean;
    uploadVideoAccept: string[];
    uploadVideoServer: string;
    uploadVideoMaxSize: number;
    uploadVideoName: string;
    uploadVideoParams: {};
    uploadVideoParamsWithUrl: boolean;
    uploadVideoHeaders: {};
    uploadVideoHooks: {};
    uploadVideoTimeout: number;
    withVideoCredentials: boolean;
    customUploadVideo: null;
    customInsertVideo: null;
};
export default _default;
