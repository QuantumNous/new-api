/**
 * @description 封装 document.execCommand
 * @author wangfupeng
 */

import $, { DomElement } from '../utils/dom-core'
import Editor from './index'

class Command {
    public editor: Editor

    constructor(editor: Editor) {
        this.editor = editor
    }

    /**
     * 执行富文本操作的命令
     * @param name name
     * @param value value
     */
    public do(name: string, value?: string | DomElement): void {
        const editor = this.editor

        if (editor.config.styleWithCSS) {
            document.execCommand('styleWithCSS', false, 'true')
        }

        const selection = editor.selection

        // 如果无选区，忽略
        if (!selection.getRange()) {
            return
        }

        // 恢复选取
        selection.restoreSelection()

        // 执行
        switch (name) {
            case 'insertHTML':
                this.insertHTML(value as string)
                break
            case 'insertElem':
                this.insertElem(value as DomElement)
                break
            default:
                // 默认 command
                this.execCommand(name, value as string)
                break
        }

        // 修改菜单状态
        editor.menus.changeActive()

        // 最后，恢复选取保证光标在原来的位置闪烁
        selection.saveRange()
        selection.restoreSelection()
    }

    /**
     * 插入 html
     * @param html html 字符串
     */
    private insertHTML(html: string): void {
        const editor = this.editor
        const range = editor.selection.getRange()
        if (range == null) return

        if (this.queryCommandSupported('insertHTML')) {
            // W3C
            this.execCommand('insertHTML', html)
        } else if (range.insertNode) {
            // IE
            range.deleteContents()
            if ($(html).elems.length > 0) {
                range.insertNode($(html).elems[0])
            } else {
                let newNode = document.createElement('p')
                newNode.appendChild(document.createTextNode(html))
                range.insertNode(newNode)
            }
            editor.selection.collapseRange()
        }
        // else if (range.pasteHTML) {
        //     // IE <= 10
        //     range.pasteHTML(html)
        // }
    }

    /**
     * 插入 DOM 元素
     * @param $elem DOM 元素
     */
    private insertElem($elem: DomElement): void {
        const editor = this.editor
        const range = editor.selection.getRange()
        if (range == null) return

        if (range.insertNode) {
            range.deleteContents()
            range.insertNode($elem.elems[0])
        }
    }

    /**
     * 执行 document.execCommand
     * @param name name
     * @param value value
     */
    private execCommand(name: string, value: string): void {
        document.execCommand(name, false, value)
    }

    /**
     * 执行 document.queryCommandValue
     * @param name name
     */
    public queryCommandValue(name: string): string {
        return document.queryCommandValue(name)
    }

    /**
     * 执行 document.queryCommandState
     * @param name name
     */
    public queryCommandState(name: string): boolean {
        return document.queryCommandState(name)
    }

    /**
     * 执行 document.queryCommandSupported
     * @param name name
     */
    public queryCommandSupported(name: string): boolean {
        return document.queryCommandSupported(name)
    }
}

export default Command
