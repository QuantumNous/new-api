/**
 * @description 记录 range 变化
 * @author fangzhicong
 */

import Cache from '../../../../utils/data-structure/cache'
import Editor from '../../../index'
import { RangeItem } from '../type'
import $ from '../../../../utils/dom-core'
import { debounce } from '../../../../utils/util'

/**
 * 把 Range 对象转换成缓存对象
 * @param range Range 对象
 */
function rangeToObject(range: Range): RangeItem {
    return {
        start: [range.startContainer, range.startOffset],
        end: [range.endContainer, range.endOffset],
        root: range.commonAncestorContainer,
        collapsed: range.collapsed,
    }
}

/**
 * 编辑区 range 缓存管理器
 */
export default class RangeCache extends Cache<[RangeItem, RangeItem]> {
    /**
     * 变化前的 Range 数据
     */
    private lastRange: RangeItem

    /**
     * 有效选区的根节点
     */
    private root: Element

    public updateLastRange: Function

    constructor(public editor: Editor) {
        super(editor.config.historyMaxSize)
        this.lastRange = rangeToObject(document.createRange())
        this.root = editor.$textElem.elems[0]
        this.updateLastRange = debounce(() => {
            this.lastRange = rangeToObject(this.rangeHandle)
        }, editor.config.onchangeTimeout)
    }

    /**
     * 获取 Range 对象
     */
    public get rangeHandle() {
        const selection = document.getSelection()
        return selection && selection.rangeCount ? selection.getRangeAt(0) : document.createRange()
    }

    /**
     * 初始化绑定
     */
    public observe() {
        const self = this
        // 同步节点数据
        this.root = this.editor.$textElem.elems[0]
        this.resetMaxSize(this.editor.config.historyMaxSize)
        // selection change 回调函数
        function selectionchange() {
            const handle = self.rangeHandle
            if (
                self.root === handle.commonAncestorContainer ||
                self.root.contains(handle.commonAncestorContainer)
            ) {
                // 非中文输入状态下才进行记录
                if (!self.editor.isComposing) {
                    self.updateLastRange()
                }
            }
        }
        // backspace 和 delete 手动更新 Range 缓存
        function deletecallback(e: KeyboardEvent) {
            if (e.key == 'Backspace' || e.key == 'Delete') {
                // self.lastRange = rangeToObject(self.rangeHandle)
                self.updateLastRange()
            }
        }
        // 绑定事件（必须绑定在 document 上，不能绑定在 window 上）
        $(document).on('selectionchange', selectionchange)
        // 解除事件绑定
        this.editor.beforeDestroy(function () {
            $(document).off('selectionchange', selectionchange)
        })

        // 删除文本时手动更新 range
        self.editor.$textElem.on('keydown', deletecallback)
    }

    /**
     * 保存 Range
     */
    public save() {
        let current = rangeToObject(this.rangeHandle)
        super.save([this.lastRange, current])
        this.lastRange = current
        return this
    }

    /**
     * 设置 Range，在 撤销/恢复 中调用
     * @param range 缓存的 Range 数据
     */
    public set(range: RangeItem | undefined) {
        try {
            if (range) {
                const handle = this.rangeHandle
                handle.setStart(...range.start)
                handle.setEnd(...range.end)
                this.editor.menus.changeActive()
                return true
            }
        } catch (err) {
            return false
        }
        return false
    }

    /**
     * 撤销
     */
    public revoke() {
        return super.revoke(data => {
            this.set(data[0])
        })
    }

    /**
     * 恢复
     */
    public restore() {
        return super.restore(data => {
            this.set(data[1])
        })
    }
}
