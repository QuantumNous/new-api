/**
 * @description 对齐方式
 * @author liuwei
 */

import DropListMenu from '../menu-constructors/DropListMenu'
import $, { DomElement } from '../../utils/dom-core'
import Editor from '../../editor/index'
import { MenuActive } from '../menu-constructors/Menu'

const SPECIAL_NODE_LIST = ['LI']
const SPECIAL_TOP_NODE_LIST = ['BLOCKQUOTE']

class Justify extends DropListMenu implements MenuActive {
    constructor(editor: Editor) {
        const $elem = $(
            '<div class="w-e-menu" data-title="对齐"><i class="w-e-icon-paragraph-left"></i></div>'
        )

        const dropListConf = {
            width: 100,
            title: '对齐方式',
            type: 'list', // droplist 以列表形式展示
            list: [
                {
                    $elem: $(
                        `<p>
                            <i class="w-e-icon-paragraph-left w-e-drop-list-item"></i>
                            ${editor.i18next.t('menus.dropListMenu.justify.靠左')}
                        </p>`
                    ),
                    value: 'left',
                },
                {
                    $elem: $(
                        `<p>
                            <i class="w-e-icon-paragraph-center w-e-drop-list-item"></i>
                            ${editor.i18next.t('menus.dropListMenu.justify.居中')}
                        </p>`
                    ),
                    value: 'center',
                },
                {
                    $elem: $(
                        `<p>
                            <i class="w-e-icon-paragraph-right w-e-drop-list-item"></i>
                            ${editor.i18next.t('menus.dropListMenu.justify.靠右')}
                        </p>`
                    ),
                    value: 'right',
                },
                {
                    $elem: $(
                        `<p>
                            <i class="w-e-icon-paragraph-justify w-e-drop-list-item"></i>
                            ${editor.i18next.t('menus.dropListMenu.justify.两端')}
                        </p>`
                    ),
                    value: 'justify',
                },
            ],
            clickHandler: (value: string) => {
                // 执行对应的value操作
                this.command(value)
            },
        }
        super($elem, editor, dropListConf)
    }
    /**
     * 执行命令
     * @param value value
     */
    public command(value: string): void {
        const editor = this.editor
        const selection = editor.selection
        const $selectionElem = selection.getSelectionContainerElem()

        // 保存选区
        selection.saveRange()

        // 获取顶级元素
        const $elems = editor.selection.getSelectionRangeTopNodes()
        if ($selectionElem?.length) {
            // list 在chrome下默认多包裹一个 p，导致不能通过顶层元素判断，所以单独加个判断
            if (this.isSpecialNode($selectionElem, $elems[0]) || this.isSpecialTopNode($elems[0])) {
                const el = this.getSpecialNodeUntilTop($selectionElem, $elems[0])
                if (el == null) return

                $(el).css('text-align', value)
            } else {
                $elems.forEach((el: DomElement) => {
                    el.css('text-align', value)
                })
            }
        }
        //恢复选区
        selection.restoreSelection()
    }

    /**
     * 获取选区中的特殊元素，如果不存在，则直接返回顶层元素子元素
     * @param el DomElement
     * @param topEl DomElement
     */
    private getSpecialNodeUntilTop(el: DomElement, topEl: DomElement) {
        let parentNode: Node | null = el.elems[0]
        const topNode = topEl.elems[0]
        // 可能出现嵌套的情况，所以一级一级向上找，是否是特殊元素
        while (parentNode != null) {
            if (SPECIAL_NODE_LIST.indexOf(parentNode?.nodeName) !== -1) {
                return parentNode
            }
            // 如果再到 top 元素之前还没找到特殊元素，直接返回元素
            if (parentNode.parentNode === topNode) {
                return parentNode
            }
            parentNode = parentNode.parentNode
        }
        return parentNode
    }

    /**
     * 当选区元素或者顶层元素是某些特殊元素时，只需要修改子元素的对齐样式的元素
     * @param el DomElement
     * @param topEl DomElement
     */
    private isSpecialNode(el: DomElement, topEl: DomElement) {
        // 如果以后有类似的元素要这样处理，直接修改这个数组即可
        const parentNode = this.getSpecialNodeUntilTop(el, topEl)

        if (parentNode == null) return false

        return SPECIAL_NODE_LIST.indexOf(parentNode.nodeName) !== -1
    }

    /**
     * 当选区 top 元素为某些特殊元素时，只需要修改子元素的对齐样式的元素
     * @param el DomElement
     */
    private isSpecialTopNode(topEl: DomElement) {
        if (topEl == null) return false

        return SPECIAL_TOP_NODE_LIST.indexOf(topEl.elems[0]?.nodeName) !== -1
    }

    /**
     * 尝试改变菜单激活（高亮）状态
     * 默认左对齐,若选择其他对其方式对active进行高亮否则unActive
     * ?考虑优化的话 是否可以对具体选中的进行高亮
     */
    public tryChangeActive(): void {}
}

export default Justify
