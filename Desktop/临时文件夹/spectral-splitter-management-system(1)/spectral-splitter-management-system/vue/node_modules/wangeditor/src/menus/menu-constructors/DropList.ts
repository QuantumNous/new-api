/**
 * @description 下拉列表 class
 */

import $, { DomElement } from '../../utils/dom-core'
import DropListMenu from './DropListMenu'
import { EMPTY_FN } from '../../utils/const'

export type DropListItem = {
    $elem: DomElement
    value: string
}

// droplist 的配置数据
export type DropListConf = {
    title: string
    list: DropListItem[]
    type: string // 'list' 列表形式（如“标题”菜单）； 'inline-block' 块状形式（如“颜色”菜单）
    clickHandler: (value: DropListItem['value']) => void
    width: number | 100
}

class DropList {
    private menu: DropListMenu
    private conf: DropListConf
    private $container: DomElement
    private rendered: boolean
    private _show: boolean

    public hideTimeoutId: number

    constructor(menu: DropListMenu, conf: DropListConf) {
        this.hideTimeoutId = 0
        this.menu = menu
        this.conf = conf

        // 容器
        const $container = $('<div class="w-e-droplist"></div>')

        // 标题
        const $title = $(`<p>${conf.title}</p>`)
        $title.addClass('w-e-dp-title')
        $container.append($title)

        // 列表和类型
        const list = conf.list || []
        const type = conf.type || 'list'
        // item 的点击事件
        const clickHandler = conf.clickHandler || EMPTY_FN

        // 加入 DOM 并绑定事件
        const $list = $('<ul class="' + (type === 'list' ? 'w-e-list' : 'w-e-block') + '"></ul>')
        list.forEach(item => {
            const $elem = item.$elem

            const value = item.value
            const $li = $('<li class="w-e-item"></li>')
            if ($elem) {
                $li.append($elem)
                $list.append($li)
                $li.on('click', (e: Event) => {
                    clickHandler(value)

                    // 阻止冒泡
                    e.stopPropagation()

                    // item 点击之后，隐藏 list
                    this.hideTimeoutId = window.setTimeout(() => {
                        this.hide()
                    })
                })
            }
        })
        $container.append($list)

        // 绑定隐藏事件
        $container.on('mouseleave', () => {
            this.hideTimeoutId = window.setTimeout(() => {
                this.hide()
            })
        })

        // 记录属性
        this.$container = $container
        this.rendered = false
        this._show = false
    }

    /**
     * 显示 DropList
     */
    public show() {
        if (this.hideTimeoutId) {
            // 清除之前的定时隐藏
            clearTimeout(this.hideTimeoutId)
        }

        const menu = this.menu
        const $menuELem = menu.$elem
        const $container = this.$container
        if (this._show) {
            return
        }
        if (this.rendered) {
            // 显示
            $container.show()
        } else {
            // 加入 DOM 之前先定位位置
            const menuHeight = $menuELem.getBoundingClientRect().height || 0
            const width = this.conf.width || 100 // 默认为 100
            $container.css('margin-top', menuHeight + 'px').css('width', width + 'px')

            // 加入到 DOM
            $menuELem.append($container)
            this.rendered = true
        }

        // 修改属性
        this._show = true
    }

    /**
     * 隐藏 DropList
     */
    public hide() {
        const $container = this.$container
        if (!this._show) {
            return
        }
        // 隐藏并需改属性
        $container.hide()
        this._show = false
    }

    public get isShow() {
        return this._show
    }
}

export default DropList
