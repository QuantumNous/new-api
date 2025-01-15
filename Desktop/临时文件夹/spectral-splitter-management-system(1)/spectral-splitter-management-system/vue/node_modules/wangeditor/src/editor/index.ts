/**
 * @description 编辑器 class
 * @author wangfupeng
 */

import $, { DomElement, DomElementSelector } from '../utils/dom-core'
import { deepClone } from '../utils/util'
import defaultConfig, { ConfigType } from '../config'
import SelectionAndRangeAPI from './selection'
import CommandAPI from './command'
import Text from '../text/index'
import Menus from '../menus/index'
import initDom, { selectorValidator } from './init-fns/init-dom'
import initSelection from './init-fns/init-selection'
import bindEvent from './init-fns/bind-event'
import i18nextInit from './init-fns/i18next-init'
import initFullScreen, { setUnFullScreen, setFullScreen } from './init-fns/set-full-screen'
import scrollToHead from './init-fns/scroll-to-head'
import ZIndex from './z-index'
import Change from './change/index'
import History from './history/index'
import disableInit from './disable'
import SelectionChange from './selection-change'

import initPlugins, { RegisterOptions, pluginsListType, registerPlugin } from '../plugins'

// 创建菜单的 class
import { MenuListType } from '../menus/menu-list'
import BtnMenu from '../menus/menu-constructors/BtnMenu'
import DropList from '../menus/menu-constructors/DropList'
import DropListMenu from '../menus/menu-constructors/DropListMenu'
import Panel from '../menus/menu-constructors/Panel'
import PanelMenu from '../menus/menu-constructors/PanelMenu'
import Tooltip from '../menus/menu-constructors/Tooltip'

let EDITOR_ID = 1

class Editor {
    // 暴露 $
    static $ = $

    static BtnMenu = BtnMenu
    static DropList = DropList
    static DropListMenu = DropListMenu
    static Panel = Panel
    static PanelMenu = PanelMenu
    static Tooltip = Tooltip
    static globalCustomMenuConstructorList: MenuListType = {}
    static globalPluginsFunctionList: pluginsListType = {}
    public pluginsFunctionList: pluginsListType = {}

    public id: string
    public toolbarSelector: DomElementSelector
    public textSelector?: DomElementSelector
    public config: ConfigType
    public $toolbarElem: DomElement
    public $textContainerElem: DomElement
    public $textElem: DomElement
    public toolbarElemId: string
    public textElemId: string
    public isFocus: boolean
    public isComposing: boolean
    public isCompatibleMode: boolean
    public selection: SelectionAndRangeAPI
    public cmd: CommandAPI
    public txt: Text
    public menus: Menus
    public i18next: any
    public highlight: any
    public zIndex: ZIndex
    public change: Change
    public history: History
    public isEnable: Boolean
    public onSelectionChange: SelectionChange

    // 实例销毁前需要执行的钩子集合
    private beforeDestroyHooks: Function[] = []

    /** 禁用api */
    public disable: Function

    /** 启用api */
    public enable: Function

    /**
     * 构造函数
     * @param toolbarSelector 工具栏 DOM selector
     * @param textSelector 文本区域 DOM selector
     */
    constructor(toolbarSelector: DomElementSelector, textSelector?: DomElementSelector) {
        // id，用以区分单个页面不同的编辑器对象
        this.id = `wangEditor-${EDITOR_ID++}`

        this.toolbarSelector = toolbarSelector
        this.textSelector = textSelector

        selectorValidator(this)

        // 属性的默认值，后面可能会再修改
        // 默认配置 - 当一个页面有多个编辑器的时候，因为 JS 的特性(引用类型)会导致多个编辑器的 config 引用是同一个，所以需要 深度克隆 断掉引用
        this.config = deepClone(defaultConfig)
        this.$toolbarElem = $('<div></div>')
        this.$textContainerElem = $('<div></div>')
        this.$textElem = $('<div></div>')
        this.toolbarElemId = ''
        this.textElemId = ''
        this.isFocus = false
        this.isComposing = false
        this.isCompatibleMode = false

        this.selection = new SelectionAndRangeAPI(this)
        this.cmd = new CommandAPI(this)
        this.txt = new Text(this)
        this.menus = new Menus(this)
        this.zIndex = new ZIndex()
        this.change = new Change(this)
        this.history = new History(this)
        this.onSelectionChange = new SelectionChange(this)

        const { disable, enable } = disableInit(this)
        this.disable = disable
        this.enable = enable
        this.isEnable = true
    }

    /**
     * 初始化选区
     * @param newLine 新建一行
     */
    public initSelection(newLine?: boolean): void {
        initSelection(this, newLine)
    }

    /**
     * 创建编辑器实例
     */
    public create(): void {
        // 初始化 ZIndex
        this.zIndex.init(this)

        // 确定当前的历史记录模式
        this.isCompatibleMode = this.config.compatibleMode()

        // 标准模式下，重置延迟时间
        if (!this.isCompatibleMode) {
            this.config.onchangeTimeout = 30
        }

        // 国际化 因为要在创建菜单前使用 所以要最先 初始化
        i18nextInit(this)

        // 初始化 DOM
        initDom(this)

        // 初始化 text
        this.txt.init()

        // 初始化菜单
        this.menus.init()

        // 初始化全屏功能
        initFullScreen(this)

        // 初始化选区，将光标定位到内容尾部
        this.initSelection(true)

        // 绑定事件
        bindEvent(this)

        // 绑定监听的目标节点
        this.change.observe()

        this.history.observe()

        // 初始化插件
        initPlugins(this)
    }

    /**
     * 提供给用户添加销毁前的钩子函数
     * @param fn 钩子函数
     */
    public beforeDestroy(fn: Function): Editor {
        this.beforeDestroyHooks.push(fn)
        return this
    }

    /**
     * 销毁当前编辑器实例
     */
    public destroy(): void {
        // 调用钩子函数
        this.beforeDestroyHooks.forEach(fn => fn.call(this))
        // 销毁 DOM 节点
        this.$toolbarElem.remove()
        this.$textContainerElem.remove()
    }

    /**
     * 将编辑器设置为全屏
     */
    public fullScreen(): void {
        setFullScreen(this)
    }

    /**
     * 将编辑器退出全屏
     */
    public unFullScreen(): void {
        setUnFullScreen(this)
    }

    /**
     * 滚动到指定标题锚点
     * @param id 标题锚点id
     */
    public scrollToHead(id: string): void {
        scrollToHead(this, id)
    }

    /**
     * 自定义添加菜单
     * @param key 菜单 key
     * @param Menu 菜单构造函数
     */
    static registerMenu(key: string, Menu: any) {
        if (!Menu || typeof Menu !== 'function') return
        Editor.globalCustomMenuConstructorList[key] = Menu
    }

    /**
     * 自定义添加插件
     * @param { string } name 插件的名称
     * @param { RegisterOptions } options 插件的选项
     */
    public registerPlugin(name: string, options: RegisterOptions) {
        registerPlugin(name, options, this.pluginsFunctionList)
    }

    /**
     * 自定义添加插件
     * @param { string } name 插件的名称
     * @param { RegisterOptions } options 插件的选项
     */
    static registerPlugin(name: string, options: RegisterOptions) {
        registerPlugin(name, options, Editor.globalPluginsFunctionList)
    }
}

export default Editor
