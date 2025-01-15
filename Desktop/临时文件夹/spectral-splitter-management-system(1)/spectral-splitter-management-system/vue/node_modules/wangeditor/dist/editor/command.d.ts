/**
 * @description 封装 document.execCommand
 * @author wangfupeng
 */
import { DomElement } from '../utils/dom-core';
import Editor from './index';
declare class Command {
    editor: Editor;
    constructor(editor: Editor);
    /**
     * 执行富文本操作的命令
     * @param name name
     * @param value value
     */
    do(name: string, value?: string | DomElement): void;
    /**
     * 插入 html
     * @param html html 字符串
     */
    private insertHTML;
    /**
     * 插入 DOM 元素
     * @param $elem DOM 元素
     */
    private insertElem;
    /**
     * 执行 document.execCommand
     * @param name name
     * @param value value
     */
    private execCommand;
    /**
     * 执行 document.queryCommandValue
     * @param name name
     */
    queryCommandValue(name: string): string;
    /**
     * 执行 document.queryCommandState
     * @param name name
     */
    queryCommandState(name: string): boolean;
    /**
     * 执行 document.queryCommandSupported
     * @param name name
     */
    queryCommandSupported(name: string): boolean;
}
export default Command;
