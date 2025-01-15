/**
 * @description 无序列表/有序列表
 * @author tonghan
 */

import $, { DomElement } from '../../utils/dom-core'
import Editor from '../../editor/index'
import DropListMenu from '../menu-constructors/DropListMenu'
import { MenuActive } from '../menu-constructors/Menu'

import { updateRange } from './utils'

import { HandlerListOptions } from './ListHandle/ListHandle'
import ListHandleCommand, { createListHandle, ClassType } from './ListHandle'

/**
 * 列表的种类
 */
export enum ListType {
    OrderedList = 'OL',
    UnorderedList = 'UL',
}

// 序列类型
type ListTypeValue = ListType

class List extends DropListMenu implements MenuActive {
    constructor(editor: Editor) {
        const $elem = $(
            `<div class="w-e-menu" data-title="序列">
                <i class="w-e-icon-list2"></i>
            </div>`
        )

        const dropListConf = {
            width: 130,
            title: '序列',
            type: 'list',
            list: [
                {
                    $elem: $(`
                        <p>
                            <i class="w-e-icon-list2 w-e-drop-list-item"></i>
                            ${editor.i18next.t('menus.dropListMenu.list.无序列表')}
                        <p>`),
                    value: ListType.UnorderedList,
                },

                {
                    $elem: $(
                        `<p>
                            <i class="w-e-icon-list-numbered w-e-drop-list-item"></i>
                            ${editor.i18next.t('menus.dropListMenu.list.有序列表')}
                        <p>`
                    ),
                    value: ListType.OrderedList,
                },
            ],
            clickHandler: (value: string) => {
                // 注意 this 是指向当前的 List 对象
                this.command(value as ListTypeValue)
            },
        }

        super($elem, editor, dropListConf)
    }

    public command(type: ListTypeValue): void {
        const editor = this.editor
        const $selectionElem = editor.selection.getSelectionContainerElem()

        // 选区范围的 DOM 元素不存在，不执行命令
        if ($selectionElem === undefined) return

        // 获取选区范围内的顶级 DOM 元素
        this.handleSelectionRangeNodes(type)

        // 是否激活
        this.tryChangeActive()
    }

    public validator($startElem: DomElement, $endElem: DomElement, $textElem: DomElement): boolean {
        if (
            !$startElem.length ||
            !$endElem.length ||
            $textElem.equal($startElem) ||
            $textElem.equal($endElem)
        ) {
            return false
        }

        return true
    }

    private handleSelectionRangeNodes(listType: ListTypeValue): void {
        const editor = this.editor
        const selection = editor.selection

        // 获取 序列标签
        const listTarget = listType.toLowerCase()

        // 获取相对应的 元属节点
        let $selectionElem = selection.getSelectionContainerElem() as DomElement
        const $startElem = (selection.getSelectionStartElem() as DomElement).getNodeTop(editor)
        const $endElem = (selection.getSelectionEndElem() as DomElement).getNodeTop(editor)

        // 验证是否执行 处理逻辑
        if (!this.validator($startElem, $endElem, editor.$textElem)) {
            return
        }

        // 获取选区
        const _range = selection.getRange()
        const _collapsed = _range?.collapsed

        // 防止光标的时候判断异常
        if (!editor.$textElem.equal($selectionElem)) {
            $selectionElem = $selectionElem.getNodeTop(editor)
        }

        const options: HandlerListOptions = {
            editor,
            listType,
            listTarget,
            $selectionElem,
            $startElem,
            $endElem,
        }

        let classType: ClassType

        // =====================================
        // 当 selectionElem 属于序列元素的时候
        // 代表着当前选区一定是在一个序列元素内的
        // =====================================
        if (this.isOrderElem($selectionElem as DomElement)) {
            classType = ClassType.Wrap
        }

        // =====================================
        // 当 startElem 和 endElem 属于序列元素的时候
        // 代表着当前选区一定是在再两个序列的中间(包括两个序列)
        // =====================================
        else if (
            this.isOrderElem($startElem as DomElement) &&
            this.isOrderElem($endElem as DomElement)
        ) {
            classType = ClassType.Join
        }

        // =====================================
        // 选区开始元素为 序列 的时候
        // =====================================
        else if (this.isOrderElem($startElem as DomElement)) {
            classType = ClassType.StartJoin
        }

        // =====================================
        // 选区结束元素为 序列 的时候
        // =====================================
        else if (this.isOrderElem($endElem as DomElement)) {
            classType = ClassType.EndJoin
        }

        // =====================================
        // 当选区不是序列内且开头和结尾不是序列的时候
        // 直接获取所有顶级段落然后过滤
        // 代表着 设置序列 的操作
        // =====================================
        else {
            classType = ClassType.Other
        }

        const listHandleCmd = new ListHandleCommand(
            createListHandle(classType, options, _range as Range)
        )

        // 更新选区
        updateRange(editor, listHandleCmd.getSelectionRangeElem(), !!_collapsed)
    }

    /**
     * 是否是序列元素节点 UL and OL
     * @param $node
     */
    private isOrderElem($node: DomElement) {
        const nodeName = $node.getNodeName()
        if (nodeName === ListType.OrderedList || nodeName === ListType.UnorderedList) {
            return true
        }
        return false
    }

    public tryChangeActive(): void {}
}

export default List
