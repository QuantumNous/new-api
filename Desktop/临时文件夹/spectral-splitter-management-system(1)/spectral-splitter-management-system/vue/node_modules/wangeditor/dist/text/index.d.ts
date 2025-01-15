/**
 * @description 编辑区域，入口文件
 * @author wangfupeng
 */
import { DomElement } from '../utils/dom-core';
import Editor from '../editor/index';
import { NodeListType } from './getChildrenJSON';
/** 按键函数 */
declare type KeyBoardHandler = (event: KeyboardEvent) => unknown;
/** 普通事件回调 */
declare type EventHandler = (event?: Event) => unknown;
declare type TextEventHooks = {
    onBlurEvents: EventHandler[];
    changeEvents: (() => void)[];
    dropEvents: ((event: DragEvent) => unknown)[];
    clickEvents: EventHandler[];
    keydownEvents: KeyBoardHandler[];
    keyupEvents: KeyBoardHandler[];
    /** tab 键（keyCode === ）Up 时 */
    tabUpEvents: KeyBoardHandler[];
    /** tab 键（keyCode === 9）Down 时 */
    tabDownEvents: KeyBoardHandler[];
    /** enter 键（keyCode === 13）up 时 */
    enterUpEvents: KeyBoardHandler[];
    /** enter 键（keyCode === 13）down 时 */
    enterDownEvents: KeyBoardHandler[];
    /** 删除键（keyCode === 8）up 时 */
    deleteUpEvents: KeyBoardHandler[];
    /** 删除键（keyCode === 8）down 时 */
    deleteDownEvents: KeyBoardHandler[];
    /** 粘贴事件 */
    pasteEvents: ((e: ClipboardEvent) => void)[];
    /** 点击链接事件 */
    linkClickEvents: ((e: DomElement) => void)[];
    /** 点击代码事件 */
    codeClickEvents: ((e: DomElement) => void)[];
    /** 编辑区域滑动事件 */
    textScrollEvents: EventHandler[];
    /** 菜单栏被点击 */
    toolbarClickEvents: EventHandler[];
    /** 图片被点击事件 */
    imgClickEvents: ((e: DomElement) => void)[];
    /** 图片拖拽MouseDown */
    imgDragBarMouseDownEvents: (() => void)[];
    /** 表格点击 */
    tableClickEvents: (($dom: DomElement, e: MouseEvent) => void)[];
    /** 每个菜单被点击时，按理说这个不属于 txt 的，先暂时在这放着吧 */
    menuClickEvents: (() => void)[];
    /** droplist 菜单悬浮事件。暂时放这里 */
    dropListMenuHoverEvents: (() => void)[];
    /** 点击分割线时 */
    splitLineEvents: ((e: DomElement) => void)[];
    /** 视频点击事件 */
    videoClickEvents: ((e: DomElement) => void)[];
};
declare class Text {
    editor: Editor;
    eventHooks: TextEventHooks;
    constructor(editor: Editor);
    /**
     * 初始化
     */
    init(): void;
    /**
     * 切换placeholder
     */
    togglePlaceholder(): void;
    /**
     * 清空内容
     */
    clear(): void;
    /**
     * 设置/获取 html
     * @param val html 字符串
     */
    html(val?: string): void | string;
    /**
     * 将json设置成html至编辑器
     * @param nodeList json格式
     */
    setJSON(nodeList: NodeListType): void;
    /**
     * 获取 json 格式的数据
     */
    getJSON(): NodeListType;
    /**
     * 设置 字符串内容
     * @param val text 字符串
     */
    text(val: string): void;
    /**
     * 获取 字符串内容
     */
    text(): string;
    /**
     * 追加 html 内容
     * @param html html 字符串
     */
    append(html: string): void;
    /**
     * 每一步操作，都实时保存选区范围
     */
    private _saveRange;
    /**
     * 绑定事件，事件会触发钩子函数
     */
    private _bindEventHooks;
}
export default Text;
