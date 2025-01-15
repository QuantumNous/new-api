/**
 * @description Tooltip class
 * @author wangfupeng
 */

import $, { DomElement } from '../../utils/dom-core'
import Editor from '../../editor/index'

type PositionDataType = {
    top: number
    left: number
}

export type TooltipConfItemType = {
    $elem: DomElement
    onClick: Function
}
export type TooltipConfType = Array<TooltipConfItemType>

class Tooltip {
    private $container: DomElement
    private $targetElem: DomElement
    private editor: Editor
    private conf: TooltipConfType
    private _show: boolean
    private _isInsertTextContainer: boolean

    constructor(editor: Editor, $elem: DomElement, conf: TooltipConfType) {
        this.editor = editor
        this.$targetElem = $elem
        this.conf = conf
        this._show = false
        this._isInsertTextContainer = false
        // 定义 container
        const $container = $('<div></div>')
        $container.addClass('w-e-tooltip')
        this.$container = $container
    }

    /**
     * 获取 tooltip 定位
     */
    private getPositionData(): PositionDataType {
        const $container = this.$container

        let top = 0
        let left = 0

        // tooltip 的高度
        const tooltipHeight = 20
        // 网页的 scrollTop
        const pageScrollTop = document.documentElement.scrollTop
        // 目标元素的 rect
        const targetElemRect = this.$targetElem.getBoundingClientRect()
        // 编辑区域的 rect
        const textElemRect = this.editor.$textElem.getBoundingClientRect()
        // 获取基于 textContainerElem 的 位置信息
        const targetOffset = this.$targetElem.getOffsetData()
        const targetParentElem = $(targetOffset.parent)
        // 获取 编辑区域的滚动条信息
        const scrollTop = this.editor.$textElem.elems[0].scrollTop
        // 是否插入 textContainer 中
        this._isInsertTextContainer = targetParentElem.equal(this.editor.$textContainerElem)

        if (this._isInsertTextContainer) {
            // 父容器的高度
            const targetParentElemHeight = targetParentElem.getBoundingClientRect().height
            // 相对于父容器的位置信息
            const { top: offsetTop, left: offsetLeft, height: offsetHeight } = targetOffset
            // 元素基于父容器的 绝对top信息
            const absoluteTop = offsetTop - scrollTop
            if (absoluteTop > tooltipHeight + 5) {
                // 说明模板元素的顶部空间足够
                top = absoluteTop - tooltipHeight - 15
                $container.addClass('w-e-tooltip-up')
            } else if (absoluteTop + offsetHeight + tooltipHeight < targetParentElemHeight) {
                // 说明模板元素的底部空间足够
                top = absoluteTop + offsetHeight + 10
                $container.addClass('w-e-tooltip-down')
            } else {
                // 其他情况，tooltip 放在目标元素左上角
                top = (absoluteTop > 0 ? absoluteTop : 0) + tooltipHeight + 10
                $container.addClass('w-e-tooltip-down')
            }
            // 计算 left
            if (offsetLeft < 0) {
                left = 0
            } else {
                left = offsetLeft
            }
        } else {
            if (targetElemRect.top < tooltipHeight) {
                // 说明目标元素的顶部，因滑动隐藏在浏览器上方。tooltip 要放在目标元素下面
                top = targetElemRect.bottom + pageScrollTop + 5 // 5px 间距
                $container.addClass('w-e-tooltip-down')
            } else if (targetElemRect.top - textElemRect.top < tooltipHeight) {
                // 说明目标元素的顶部，因滑动隐藏在编辑区域上方。tooltip 要放在目标元素下面
                top = targetElemRect.bottom + pageScrollTop + 5 // 5px 间距
                $container.addClass('w-e-tooltip-down')
            } else {
                // 其他情况，tooltip 放在目标元素上方
                top = targetElemRect.top + pageScrollTop - tooltipHeight - 15 // 减去 toolbar 的高度，还有 15px 间距
                $container.addClass('w-e-tooltip-up')
            }
            // 计算 left
            if (targetElemRect.left < 0) {
                left = 0
            } else {
                left = targetElemRect.left
            }
        }

        // 返回结果
        return { top, left }
    }

    /**
     * 添加 tooltip 菜单
     */
    private appendMenus(): void {
        const conf = this.conf
        const editor = this.editor
        const $targetElem = this.$targetElem
        const $container = this.$container

        conf.forEach((item: TooltipConfItemType, index: number) => {
            // 添加元素
            const $elem = item.$elem
            const $wrapper = $('<div></div>')
            $wrapper.addClass('w-e-tooltip-item-wrapper ')
            $wrapper.append($elem)
            $container.append($wrapper)

            // 绑定点击事件
            $elem.on('click', (e: Event) => {
                e.preventDefault()
                const res = item.onClick(editor, $targetElem)
                if (res) this.remove()
            })
        })
    }

    /**
     * 创建 tooltip
     */
    public create(): void {
        const editor = this.editor
        const $container = this.$container

        // 生成 container 的内容
        this.appendMenus()

        // 设置定位
        const { top, left } = this.getPositionData()
        $container.css('top', `${top}px`)
        $container.css('left', `${left}px`)

        // 设置 z-index
        $container.css('z-index', editor.zIndex.get('tooltip'))

        // 添加到 DOM
        if (this._isInsertTextContainer) {
            this.editor.$textContainerElem.append($container)
        } else {
            $('body').append($container)
        }

        this._show = true

        editor.beforeDestroy(this.remove.bind(this))
        editor.txt.eventHooks.onBlurEvents.push(this.remove.bind(this))
    }

    /**
     * 移除该 tooltip
     */
    public remove(): void {
        this.$container.remove()
        this._show = false
    }

    /**
     * 是否显示
     */
    public get isShow(): boolean {
        return this._show
    }
}

export default Tooltip
