/**
 * @description tooltip 事件
 * @author wangfupeng
 */

import $, { DomElement } from '../../../utils/dom-core'
import Tooltip, { TooltipConfType } from '../../menu-constructors/Tooltip'
import Editor from '../../../editor/index'
import { EXTRA_TAG } from '../is-active'

/**
 * 生成 Tooltip 的显示隐藏函数
 */
function createShowHideFn(editor: Editor) {
    let tooltip: Tooltip | null

    /**
     * 显示 tooltip
     * @param $link 链接元素
     */
    function showLinkTooltip($link: DomElement) {
        const conf: TooltipConfType = [
            {
                $elem: $(`<span>${editor.i18next.t('menus.panelMenus.link.查看链接')}</span>`),
                onClick: (editor: Editor, $link: DomElement) => {
                    const link = $link.attr('href')
                    window.open(link, '_target')

                    // 返回 true，表示执行完之后，隐藏 tooltip。否则不隐藏。
                    return true
                },
            },
            {
                $elem: $(`<span>${editor.i18next.t('menus.panelMenus.link.取消链接')}</span>`),
                onClick: (editor: Editor, $link: DomElement) => {
                    // 选中链接元素
                    editor.selection.createRangeByElem($link)
                    editor.selection.restoreSelection()

                    const $childNodes = $link.childNodes()
                    // 如果链接是图片
                    if ($childNodes?.getNodeName() === 'IMG') {
                        // 获取选中的图片
                        const $selectIMG = editor.selection.getSelectionContainerElem()?.children()
                            ?.elems[0].children[0]
                        // 插入图片
                        editor.cmd.do(
                            'insertHTML',
                            `<img 
                                src=${$selectIMG?.getAttribute('src')} 
                                style=${$selectIMG?.getAttribute('style')}>`
                        )
                    } else {
                        /**
                         * 替换链接
                         *
                         * 两种情况
                         * 1. a标签里面可能会含有其他元素如：b, i等，要保留： <a><b></b></a> 先添加链接后加粗
                         * 2. 特殊标签里嵌套a，也要保留特殊标签：<b><a></a></b>  先加粗后添加链接
                         */
                        const linkElem = $link.elems[0]

                        // a标签里面的html结构
                        const selectionContent = linkElem.innerHTML

                        // a标签的父元素
                        const linkParentNode = linkElem.parentElement

                        if (linkParentNode && EXTRA_TAG.includes(linkParentNode.nodeName)) {
                            linkParentNode.innerHTML = selectionContent
                        } else {
                            editor.cmd.do('insertHTML', '<span>' + selectionContent + '</span>')
                        }
                    }

                    // 返回 true，表示执行完之后，隐藏 tooltip。否则不隐藏。
                    return true
                },
            },
        ]

        // 创建 tooltip
        tooltip = new Tooltip(editor, $link, conf)
        tooltip.create()
    }

    /**
     * 隐藏 tooltip
     */
    function hideLinkTooltip() {
        // 移除 tooltip
        if (tooltip) {
            tooltip.remove()
            tooltip = null
        }
    }

    return {
        showLinkTooltip,
        hideLinkTooltip,
    }
}

/**
 * 绑定 tooltip 事件
 * @param editor 编辑器实例
 */
function bindTooltipEvent(editor: Editor) {
    const { showLinkTooltip, hideLinkTooltip } = createShowHideFn(editor)

    // 点击链接元素是，显示 tooltip
    editor.txt.eventHooks.linkClickEvents.push(showLinkTooltip)

    // 点击其他地方，或者滚动时，隐藏 tooltip
    editor.txt.eventHooks.clickEvents.push(hideLinkTooltip)
    editor.txt.eventHooks.keyupEvents.push(hideLinkTooltip)
    editor.txt.eventHooks.toolbarClickEvents.push(hideLinkTooltip)
    editor.txt.eventHooks.menuClickEvents.push(hideLinkTooltip)
    editor.txt.eventHooks.textScrollEvents.push(hideLinkTooltip)
}

export default bindTooltipEvent
