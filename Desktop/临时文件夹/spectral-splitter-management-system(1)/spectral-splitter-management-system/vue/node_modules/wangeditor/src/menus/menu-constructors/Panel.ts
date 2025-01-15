/**
 * @description panel class
 * @author wangfupeng
 */

import $, { DomElement } from '../../utils/dom-core'
import PanelMenu from './PanelMenu'
import { EMPTY_FN } from '../../utils/const'

// Panel 配置格式
export type TabEventConf = {
    selector: string
    type: string
    fn: Function
    bindEnter?: Boolean
}
export type PanelTabConf = {
    title: string
    tpl: string
    events: TabEventConf[]
}
export type PanelConf = {
    width: number | 0
    height: number | 0
    tabs: PanelTabConf[]
    setLinkValue?: ($container: DomElement, type: string) => void
}

class Panel {
    // 记录已经创建过的 panelMenu
    static createdMenus: Set<PanelMenu> = new Set()

    private menu: PanelMenu
    private conf: PanelConf
    public $container: DomElement

    constructor(menu: PanelMenu, conf: PanelConf) {
        this.menu = menu
        this.conf = conf
        this.$container = $('<div class="w-e-panel-container"></div>')

        // 隐藏 panel
        const editor = menu.editor
        editor.txt.eventHooks.clickEvents.push(Panel.hideCurAllPanels)
        editor.txt.eventHooks.toolbarClickEvents.push(Panel.hideCurAllPanels)
        editor.txt.eventHooks.dropListMenuHoverEvents.push(Panel.hideCurAllPanels)
    }

    /**
     * 创建并展示 panel
     */
    public create(): void {
        const menu = this.menu
        if (Panel.createdMenus.has(menu)) {
            // 创建过了
            return
        }

        const conf = this.conf

        // panel 的容器
        const $container = this.$container
        const width = conf.width || 300 // 默认 300px
        const rect = menu.editor.$toolbarElem.getBoundingClientRect()
        const menuRect = menu.$elem.getBoundingClientRect()
        const top = rect.height + rect.top - menuRect.top
        let left = (rect.width - width) / 2 + rect.left - menuRect.left
        const offset = 300 // icon与panel菜单距离偏移量暂定 300
        if (Math.abs(left) > offset) {
            // panel菜单离工具栏icon过远时，让panel菜单出现在icon正下方，处理边界逻辑
            if (menuRect.left < document.documentElement.clientWidth / 2) {
                // icon在左侧
                left = -menuRect.width / 2
            } else {
                // icon在右侧
                left = -width + menuRect.width / 2
            }
        }

        $container
            .css('width', width + 'px')
            .css('margin-top', `${top}px`)
            .css('margin-left', `${left}px`)
            .css('z-index', menu.editor.zIndex.get('panel'))

        // 添加关闭按钮
        const $closeBtn = $('<i class="w-e-icon-close w-e-panel-close"></i>')
        $container.append($closeBtn)
        $closeBtn.on('click', () => {
            this.remove()
        })

        // 准备 tabs 容器
        const $tabTitleContainer = $('<ul class="w-e-panel-tab-title"></ul>')
        const $tabContentContainer = $('<div class="w-e-panel-tab-content"></div>')
        $container.append($tabTitleContainer).append($tabContentContainer)

        // 设置高度
        const height = conf.height // height: 0 即不用设置
        if (height) {
            $tabContentContainer.css('height', height + 'px').css('overflow-y', 'auto')
        }

        // tabs
        const tabs = conf.tabs || []
        const tabTitleArr: DomElement[] = []
        const tabContentArr: DomElement[] = []

        tabs.forEach((tab: PanelTabConf, tabIndex: number) => {
            if (!tab) {
                return
            }
            const title = tab.title || ''
            const tpl = tab.tpl || ''

            // 添加到 DOM
            const $title = $(`<li class="w-e-item">${title}</li>`)
            $tabTitleContainer.append($title)
            const $content = $(tpl)
            $tabContentContainer.append($content)

            // 记录到内存
            tabTitleArr.push($title)
            tabContentArr.push($content)

            // 设置 active 项
            if (tabIndex === 0) {
                $title.data('active', true)
                $title.addClass('w-e-active')
            } else {
                $content.hide()
            }

            // 绑定 tab 的事件
            $title.on('click', () => {
                if ($title.data('active')) {
                    return
                }
                // 隐藏所有的 tab
                tabTitleArr.forEach($title => {
                    $title.data('active', false)
                    $title.removeClass('w-e-active')
                })
                tabContentArr.forEach($content => {
                    $content.hide()
                })

                // 显示当前的 tab
                $title.data('active', true)
                $title.addClass('w-e-active')
                $content.show()
            })
        })

        // 绑定关闭事件
        $container.on('click', (e: Event) => {
            // 点击时阻止冒泡
            e.stopPropagation()
        })

        // 添加到 DOM
        menu.$elem.append($container)

        // 设置tab内input的值
        conf.setLinkValue && conf.setLinkValue($container, 'text')
        conf.setLinkValue && conf.setLinkValue($container, 'link')

        // 绑定 conf events 的事件，只有添加到 DOM 之后才能绑定成功
        tabs.forEach((tab: PanelTabConf, index: number) => {
            if (!tab) {
                return
            }
            const events = tab.events || []
            events.forEach((event: TabEventConf) => {
                const selector = event.selector
                const type = event.type
                const fn = event.fn || EMPTY_FN
                const $content = tabContentArr[index]
                const bindEnter = event.bindEnter ?? false

                const doneFn = async (e: Event) => {
                    e.stopPropagation()
                    const needToHide = await fn(e)
                    // 执行完事件之后，是否要关闭 panel
                    if (needToHide) {
                        this.remove()
                    }
                }
                // 给按钮绑定相应的事件
                $content.find(selector).on(type, doneFn)
                // 绑定enter键入事件
                if (bindEnter && type === 'click') {
                    $content.on('keyup', (e: KeyboardEvent) => {
                        if (e.keyCode == 13) {
                            doneFn(e)
                        }
                    })
                }
            })
        })

        // focus 第一个 elem
        let $inputs = $container.find('input[type=text],textarea')
        if ($inputs.length) {
            $inputs.get(0).focus()
        }

        // 隐藏其他 panel
        Panel.hideCurAllPanels()

        // 记录该 menu 已经创建了 panel
        menu.setPanel(this)
        Panel.createdMenus.add(menu)
    }

    /**
     * 移除 penal
     */
    public remove(): void {
        const menu = this.menu
        const $container = this.$container
        if ($container) {
            $container.remove()
        }

        // 将该 menu 记录中移除
        Panel.createdMenus.delete(menu)
    }

    /**
     * 隐藏当前所有的 panel
     */
    static hideCurAllPanels(): void {
        if (Panel.createdMenus.size === 0) {
            return
        }
        Panel.createdMenus.forEach(menu => {
            const panel = (menu as PanelMenu).panel
            panel && panel.remove()
        })
    }
}

export default Panel
