/**
 * @description selection range API
 * @author wangfupeng
 */
import $, { DomElement } from '../utils/dom-core'
import { UA } from '../utils/util'
import Editor from './index'
import { EMPTY_P } from '../utils/const'

class SelectionAndRange {
    public editor: Editor
    private _currentRange: Range | null | undefined = null

    constructor(editor: Editor) {
        this.editor = editor
    }

    /**
     * 获取当前 range
     */
    public getRange(): Range | null | undefined {
        return this._currentRange
    }

    /**
     * 保存选区范围
     * @param _range 选区范围
     */
    public saveRange(_range?: Range): void {
        if (_range) {
            // 保存已有选区
            this._currentRange = _range
            return
        }

        // 获取当前的选区
        const selection = window.getSelection() as Selection
        if (selection.rangeCount === 0) {
            return
        }
        const range = selection.getRangeAt(0)

        // 获取选区范围的 DOM 元素
        const $containerElem = this.getSelectionContainerElem(range)
        if (!$containerElem?.length) {
            // 当 选区范围内没有 DOM元素 则抛出
            return
        }
        if (
            $containerElem.attr('contenteditable') === 'false' ||
            $containerElem.parentUntil('[contenteditable=false]')
        ) {
            // 这里大体意义上就是个保险
            // 确保 编辑区域 的 contenteditable属性 的值为 true
            return
        }

        const editor = this.editor
        const $textElem = editor.$textElem
        if ($textElem.isContain($containerElem)) {
            if ($textElem.elems[0] === $containerElem.elems[0]) {
                if ($textElem.html().trim() === EMPTY_P) {
                    const $children = $textElem.children()
                    const $last = $children?.last()
                    editor.selection.createRangeByElem($last as DomElement, true, true)
                    editor.selection.restoreSelection()
                }
            }
            // 是编辑内容之内的
            this._currentRange = range
        }
    }

    /**
     * 折叠选区范围
     * @param toStart true 开始位置，false 结束位置
     */
    public collapseRange(toStart: boolean = false): void {
        const range = this._currentRange
        if (range) {
            range.collapse(toStart)
        }
    }

    /**
     * 获取选区范围内的文字
     */
    public getSelectionText(): string {
        const range = this._currentRange
        if (range) {
            return range.toString()
        } else {
            return ''
        }
    }

    /**
     * 获取选区范围的 DOM 元素
     * @param range 选区范围
     */
    public getSelectionContainerElem(range?: Range): DomElement | undefined {
        let r: Range | null | undefined
        r = range || this._currentRange
        let elem: Node
        if (r) {
            elem = r.commonAncestorContainer
            return $(elem.nodeType === 1 ? elem : elem.parentNode)
        }
    }

    /**
     * 选区范围开始的 DOM 元素
     * @param range 选区范围
     */
    public getSelectionStartElem(range?: Range): DomElement | undefined {
        let r: Range | null | undefined
        r = range || this._currentRange
        let elem: Node
        if (r) {
            elem = r.startContainer
            return $(elem.nodeType === 1 ? elem : elem.parentNode)
        }
    }

    /**
     * 选区范围结束的 DOM 元素
     * @param range 选区范围
     */
    public getSelectionEndElem(range?: Range): DomElement | undefined {
        let r: Range | null | undefined
        r = range || this._currentRange
        let elem: Node
        if (r) {
            elem = r.endContainer
            return $(elem.nodeType === 1 ? elem : elem.parentNode)
        }
    }

    /**
     * 选区是否为空（没有选择文字）
     */
    public isSelectionEmpty(): boolean {
        const range = this._currentRange
        if (range && range.startContainer) {
            if (range.startContainer === range.endContainer) {
                if (range.startOffset === range.endOffset) {
                    return true
                }
            }
        }
        return false
    }

    /**
     * 恢复选区范围
     */
    public restoreSelection(): void {
        const selection = window.getSelection()
        const r = this._currentRange
        if (selection && r) {
            selection.removeAllRanges()
            selection.addRange(r)
        }
    }

    /**
     * 创建一个空白（即 &#8203 字符）选区
     */
    public createEmptyRange(): void {
        const editor = this.editor
        const range = this.getRange()
        let $elem: DomElement

        if (!range) {
            // 当前无 range
            return
        }
        if (!this.isSelectionEmpty()) {
            // 当前选区必须没有内容才可以，有内容就直接 return
            return
        }

        try {
            // 目前只支持 webkit 内核
            if (UA.isWebkit()) {
                // 插入 &#8203
                editor.cmd.do('insertHTML', '&#8203;')
                // 修改 offset 位置
                range.setEnd(range.endContainer, range.endOffset + 1)
                // 存储
                this.saveRange(range)
            } else {
                $elem = $('<strong>&#8203;</strong>')
                editor.cmd.do('insertElem', $elem)
                this.createRangeByElem($elem, true)
            }
        } catch (ex) {
            // 部分情况下会报错，兼容一下
        }
    }
    /**
     * 重新设置选区
     * @param startDom 选区开始的元素
     * @param endDom 选区结束的元素
     */
    public createRangeByElems(startDom: Node, endDom: Node): void {
        let selection = window.getSelection ? window.getSelection() : document.getSelection()
        //清除所有的选区
        selection?.removeAllRanges()
        const range = document.createRange()
        range.setStart(startDom, 0)
        // 设置多行标签之后，第二个参数会被h标签内的b、font标签等影响range范围的选取
        range.setEnd(endDom, endDom.childNodes.length || 1)
        // 保存设置好的选区
        this.saveRange(range)
        //恢复选区
        this.restoreSelection()
    }
    /**
     * 根据 DOM 元素设置选区
     * @param $elem DOM 元素
     * @param toStart true 开始位置，false 结束位置
     * @param isContent 是否选中 $elem 的内容
     */
    public createRangeByElem($elem: DomElement, toStart?: boolean, isContent?: boolean): void {
        if (!$elem.length) {
            return
        }

        const elem = $elem.elems[0]
        const range = document.createRange()

        if (isContent) {
            range.selectNodeContents(elem)
        } else {
            // 如果用户没有传入 isContent 参数，那就默认为 false
            range.selectNode(elem)
        }

        if (toStart != null) {
            // 传入了 toStart 参数，折叠选区。如果没传入 toStart 参数，则忽略这一步
            range.collapse(toStart)

            if (!toStart) {
                this.saveRange(range)
                this.editor.selection.moveCursor(elem)
            }
        }

        // 存储 range
        this.saveRange(range)
    }

    /**
     * 获取 当前 选取范围的 顶级(段落) 元素
     * @param $editor
     */
    public getSelectionRangeTopNodes(): DomElement[] {
        // 清空，防止叠加元素
        let $nodeList: DomElement[]

        const $startElem = this.getSelectionStartElem()?.getNodeTop(this.editor)
        const $endElem = this.getSelectionEndElem()?.getNodeTop(this.editor)

        $nodeList = this.recordSelectionNodes($($startElem), $($endElem))

        return $nodeList
    }

    /**
     * 移动光标位置,默认情况下在尾部
     * 有一个特殊情况是firefox下的文本节点会自动补充一个br元素，会导致自动换行
     * 所以默认情况下在firefox下的文本节点会自动移动到br前面
     * @param {Node} node 元素节点
     * @param {number} position 光标的位置
     */
    public moveCursor(node: Node, position?: number): void {
        const range = this.getRange()
        //对文本节点特殊处理
        let len: number =
            node.nodeType === 3 ? (node.nodeValue?.length as number) : node.childNodes.length
        if ((UA.isFirefox || UA.isIE()) && len !== 0) {
            // firefox下在节点为文本节点和节点最后一个元素为文本节点的情况下
            if (node.nodeType === 3 || node.childNodes[len - 1].nodeName === 'BR') {
                len = len - 1
            }
        }
        let pos: number = position ?? len
        if (!range) {
            return
        }
        if (node) {
            range.setStart(node, pos)
            range.setEnd(node, pos)
            this.restoreSelection()
        }
    }

    /**
     * 获取光标在当前选区的位置
     */
    public getCursorPos(): number | undefined {
        const selection = window.getSelection()

        return selection?.anchorOffset
    }

    /**
     * 清除当前选区的Range,notice:不影响已保存的Range
     */
    public clearWindowSelectionRange(): void {
        const selection = window.getSelection()
        if (selection) {
            selection.removeAllRanges()
        }
    }

    /**
     * 记录节点 - 从选区开始节点开始 一直到匹配到选区结束节点为止
     * @param $node 节点
     */
    public recordSelectionNodes($node: DomElement, $endElem: DomElement): DomElement[] {
        let $list: DomElement[] = []
        let isEnd = true
        /**  
        @author:lw
        @description 解决ctrl+a全选报错的bug $elem.getNodeName()可能会触发$elem[0]未定义
        **/
        try {
            let $NODE: DomElement = $node
            const $textElem = this.editor.$textElem
            // $NODE元素为空时不需要进行循环
            while (isEnd) {
                const $elem = $NODE?.getNodeTop(this.editor)
                if ($elem.getNodeName() === 'BODY') isEnd = false // 兜底
                if ($elem.length > 0) {
                    $list.push($($NODE))
                    // 两个边界情况：
                    // 1. 当前元素就是我们要找的末尾元素
                    // 2. 当前元素已经是编辑区顶级元素（否则会找到编辑区的兄弟节点，比如placeholder元素）
                    if ($endElem?.equal($elem) || $textElem.equal($elem)) {
                        isEnd = false
                    } else {
                        $NODE = $elem.getNextSibling()
                    }
                }
            }
        } catch (e) {
            isEnd = false
        }
        return $list
    }

    /**
     * 将当前 range 设置到 node 元素并初始化位置
     * 解决编辑器内容为空时，菜单不生效的问题
     * @param node 元素节点
     */
    public setRangeToElem(node: Node): void {
        const range = this.getRange()
        range?.setStart(node, 0)
        range?.setEnd(node, 0)
    }
}

export default SelectionAndRange
