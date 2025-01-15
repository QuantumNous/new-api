/**
 * @description 下拉菜单 Class
 * @author wangfupeng
 */

import $, { DomElement } from '../../utils/dom-core'
import Editor from '../../editor/index'
import Menu from './Menu'
import DropList, { DropListConf } from './DropList'

class DropListMenu extends Menu {
    public dropList: DropList

    constructor($elem: DomElement, editor: Editor, conf: DropListConf) {
        super($elem, editor)

        // 国际化
        conf.title = editor.i18next.t(`menus.dropListMenu.${conf.title}`)

        // 非中文模式下 带 icon 的下拉列表居左
        const className: string = editor.config.lang === 'zh-CN' ? '' : 'w-e-drop-list-tl'
        if (className !== '' && conf.type === 'list') {
            conf.list.forEach(item => {
                const $elem = item.$elem
                const $children = $($elem.children())
                if ($children.length > 0) {
                    const nodeName = $children?.getNodeName()
                    if (nodeName && nodeName === 'I') {
                        $elem.addClass(className)
                    }
                }
            })
        }

        // 初始化 dropList
        const dropList = new DropList(this, conf)
        this.dropList = dropList

        // 绑定事件
        $elem
            .on('click', () => {
                if (editor.selection.getRange() == null) {
                    return
                }
                $elem.css('z-index', editor.zIndex.get('menu'))
                // 触发 droplist 悬浮事件
                editor.txt.eventHooks.dropListMenuHoverEvents.forEach(fn => fn())
                // 显示
                dropList.show()
            })
            .on('mouseleave', () => {
                $elem.css('z-index', 'auto')
                // 隐藏
                dropList.hideTimeoutId = window.setTimeout(() => {
                    dropList.hide()
                })
            })
    }
}

export default DropListMenu
