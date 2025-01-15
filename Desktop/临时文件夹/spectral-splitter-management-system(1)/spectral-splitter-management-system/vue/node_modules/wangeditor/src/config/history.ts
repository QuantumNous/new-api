/**
 * @description 历史记录 - 数据缓存的模式
 * @author fangzhicong
 */

import { UA } from '../utils/util'

/**
 * 是否为兼容模式。返回 true 表示当前使用兼容（内容备份）模式，否则使用标准（差异备份）模式
 */
function compatibleMode() {
    if (UA.isIE() || UA.isOldEdge) {
        return true
    }
    return false
}

export default {
    compatibleMode,
    historyMaxSize: 30,
}
