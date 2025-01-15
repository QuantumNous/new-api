/**
 * @description 事件配置
 * @author wangfupeng
 */

import { EMPTY_FN } from '../utils/const'

export type TCatalog = {
    tag: string
    id: string
    text: string
}

/**
 * 提示信息
 * @param alertInfo alert info
 * @param alertType 错误提示类型
 * @param debugInfo debug info
 */
function customAlert(alertInfo: string, alertType: string, debugInfo?: string): void {
    window.alert(alertInfo)
    if (debugInfo) {
        console.error('wangEditor: ' + debugInfo)
    }
}

export default {
    onchangeTimeout: 200,

    onchange: null,
    onfocus: EMPTY_FN,
    onblur: EMPTY_FN,

    onCatalogChange: null,
    customAlert,
}
