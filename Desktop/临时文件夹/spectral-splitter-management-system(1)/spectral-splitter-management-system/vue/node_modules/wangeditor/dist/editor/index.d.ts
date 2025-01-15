/**
 * @description 编辑器 class
 * @author wangfupeng
 */
import $, { DomElement, DomElementSelector } from '../utils/dom-core';
import { ConfigType } from '../config';
import SelectionAndRangeAPI from './selection';
import CommandAPI from './command';
import Text from '../text/index';
import Menus from '../menus/index';
import ZIndex from './z-index';
import Change from './change/index';
import History from './history/index';
import SelectionChange from './selection-change';
import { RegisterOptions, pluginsListType } from '../plugins';
import { MenuListType } from '../menus/menu-list';
import BtnMenu from '../menus/menu-constructors/BtnMenu';
import DropList from '../menus/menu-constructors/DropList';
import DropListMenu from '../menus/menu-constructors/DropListMenu';
import Panel from '../menus/menu-constructors/Panel';
import PanelMenu from '../menus/menu-constructors/PanelMenu';
import Tooltip from '../menus/menu-constructors/Tooltip';
declare class Editor {
    static $: typeof $;
    static BtnMenu: typeof BtnMenu;
    static DropList: typeof DropList;
    static DropListMenu: typeof DropListMenu;
    static Panel: typeof Panel;
    static PanelMenu: typeof PanelMenu;
    static Tooltip: typeof Tooltip;
    static globalCustomMenuConstructorList: MenuListType;
    static globalPluginsFunctionList: pluginsListType;
    pluginsFunctionList: pluginsListType;
    id: string;
    toolbarSelector: DomElementSelector;
    textSelector?: DomElementSelector;
    config: ConfigType;
    $toolbarElem: DomElement;
    $textContainerElem: DomElement;
    $textElem: DomElement;
    toolbarElemId: string;
    textElemId: string;
    isFocus: boolean;
    isComposing: boolean;
    isCompatibleMode: boolean;
    selection: SelectionAndRangeAPI;
    cmd: CommandAPI;
    txt: Text;
    menus: Menus;
    i18next: any;
    highlight: any;
    zIndex: ZIndex;
    change: Change;
    history: History;
    isEnable: Boolean;
    onSelectionChange: SelectionChange;
    private beforeDestroyHooks;
    /** 禁用api */
    disable: Function;
    /** 启用api */
    enable: Function;
    /**
     * 构造函数
     * @param toolbarSelector 工具栏 DOM selector
     * @param textSelector 文本区域 DOM selector
     */
    constructor(toolbarSelector: DomElementSelector, textSelector?: DomElementSelector);
    /**
     * 初始化选区
     * @param newLine 新建一行
     */
    initSelection(newLine?: boolean): void;
    /**
     * 创建编辑器实例
     */
    create(): void;
    /**
     * 提供给用户添加销毁前的钩子函数
     * @param fn 钩子函数
     */
    beforeDestroy(fn: Function): Editor;
    /**
     * 销毁当前编辑器实例
     */
    destroy(): void;
    /**
     * 将编辑器设置为全屏
     */
    fullScreen(): void;
    /**
     * 将编辑器退出全屏
     */
    unFullScreen(): void;
    /**
     * 滚动到指定标题锚点
     * @param id 标题锚点id
     */
    scrollToHead(id: string): void;
    /**
     * 自定义添加菜单
     * @param key 菜单 key
     * @param Menu 菜单构造函数
     */
    static registerMenu(key: string, Menu: any): void;
    /**
     * 自定义添加插件
     * @param { string } name 插件的名称
     * @param { RegisterOptions } options 插件的选项
     */
    registerPlugin(name: string, options: RegisterOptions): void;
    /**
     * 自定义添加插件
     * @param { string } name 插件的名称
     * @param { RegisterOptions } options 插件的选项
     */
    static registerPlugin(name: string, options: RegisterOptions): void;
}
export default Editor;
