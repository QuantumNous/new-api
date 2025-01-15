/**
 * @description 上传的核心方法
 * @author wangfupeng
 */
import { DicType } from '../../config/index';
declare type PostOptionType<T> = {
    timeout?: number;
    formData?: FormData;
    headers?: DicType;
    withCredentials?: boolean;
    onTimeout?: (xhr: XMLHttpRequest) => void;
    onProgress?: (percent: number, event: ProgressEvent) => void;
    beforeSend?: (xhr: XMLHttpRequest) => {
        prevent: boolean;
        msg: string;
    } | void;
    onError?: (xhr: XMLHttpRequest) => void;
    onFail?: (xhr: XMLHttpRequest, msg: string) => void;
    onSuccess: (xhr: XMLHttpRequest, result: T) => void;
};
/**
 * 发送 post 请求（用于文件上传）
 * @param url url
 * @param option 配置项
 */
declare function post<T extends Object>(url: string, option: PostOptionType<T>): XMLHttpRequest | string;
export default post;
