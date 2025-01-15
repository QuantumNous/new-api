/**
 * @description 获取dom节点
 * @author lichunlin
 */

import $ from '../../../../utils/dom-core'
import Editor from '../../../../editor/index'

class getNode {
    public editor: Editor
    constructor(editor: Editor) {
        this.editor = editor
    }

    /**
     * 获取焦点所在行
     * @param $node 当前table
     */
    public getRowNode($node: HTMLElement): HTMLElement | null | undefined {
        let DOM: HTMLElement | null | undefined = $($node).elems[0]
        if (!DOM.parentNode) {
            return DOM
        }
        DOM = $(DOM).parentUntil('TR', DOM)?.elems[0]
        return DOM
    }

    /**
     * 获取当前行的下标
     * @param $node 当前table
     * @param $dmo 当前行节点
     */
    public getCurrentRowIndex($node: HTMLElement, $dom: HTMLElement): Number {
        let _index: number = 0
        let $nodeChild = $node.children[0]
        //粘贴的table 最后一个节点才是tbody
        if ($nodeChild.nodeName === 'COLGROUP') {
            $nodeChild = $node.children[$node.children.length - 1]
        }
        Array.from($nodeChild.children).forEach((item, index) => {
            item === $dom ? (_index = index) : ''
        })
        return _index
    }

    /**
     * 获取当前列的下标
     * @param $node 当前点击元素
     */
    public getCurrentColIndex($node: HTMLElement): number {
        //当前行
        let _index: number = 0
        //获取当前列 td或th
        let rowDom =
            $($node).getNodeName() === 'TD' || $($node).getNodeName() === 'TH'
                ? $node
                : $($node).parentUntil('TD', $node)?.elems[0]
        let colDom = $(rowDom).parent()
        Array.from(colDom.elems[0].children).forEach((item, index) => {
            item === rowDom ? (_index = index) : ''
        })
        return _index
    }

    /**
     * 返回元素html字符串
     * @param $node
     */
    public getTableHtml($node: HTMLElement): string {
        const htmlStr = `<table border="0" width="100%" cellpadding="0" cellspacing="0">${$(
            $node
        ).html()}</table>`
        return htmlStr
    }
}

export default getNode
