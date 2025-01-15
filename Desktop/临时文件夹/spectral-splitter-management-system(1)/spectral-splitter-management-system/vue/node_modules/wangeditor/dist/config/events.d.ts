/**
 * @description 事件配置
 * @author wangfupeng
 */
import { EMPTY_FN } from '../utils/const';
export declare type TCatalog = {
    tag: string;
    id: string;
    text: string;
};
/**
 * 提示信息
 * @param alertInfo alert info
 * @param alertType 错误提示类型
 * @param debugInfo debug info
 */
declare function customAlert(alertInfo: string, alertType: string, debugInfo?: string): void;
declare const _default: {
    onchangeTimeout: number;
    onchange: null;
    onfocus: typeof EMPTY_FN;
    onblur: typeof EMPTY_FN;
    onCatalogChange: null;
    customAlert: typeof customAlert;
};
export default _default;
