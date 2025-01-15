/**
 * @description 入口文件
 * @author wangfupeng
 */

import './assets/style/common.less'
import './assets/style/icon.less'
import './assets/style/menus.less'
import './assets/style/text.less'
import './assets/style/panel.less'
import './assets/style/droplist.less'

import './utils/polyfill'
import Editor from './editor/index'

export * from './menus/menu-constructors/index'

// 检验是否浏览器环境
try {
    document
} catch (ex) {
    throw new Error('请在浏览器环境下运行')
}

export default Editor
