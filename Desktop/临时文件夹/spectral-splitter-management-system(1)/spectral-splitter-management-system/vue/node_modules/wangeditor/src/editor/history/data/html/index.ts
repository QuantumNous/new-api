/**
 * @description 完整的内容备份，每次变化都将备份整个编辑器的内容
 * @author fangzhicong
 */
import Editor from '../../../index'
import { TailChain } from '../../../../utils/data-structure/chain'

export default class HtmlCache {
    // 缓存数据
    private data: TailChain<string>

    constructor(public editor: Editor) {
        this.data = new TailChain()
    }

    /**
     * 初始化绑定
     */
    observe() {
        this.data.resetMax(this.editor.config.historyMaxSize)
        // 保存初始化值
        this.data.insertLast(this.editor.$textElem.html())
    }

    /**
     * 保存
     */
    public save() {
        this.data.insertLast(this.editor.$textElem.html())
        return this
    }

    /**
     * 撤销
     */
    public revoke() {
        let data = this.data.prev()
        if (data) {
            this.editor.$textElem.html(data)
            return true
        }
        return false
    }

    /**
     * 恢复
     */
    public restore() {
        let data = this.data.next()
        if (data) {
            this.editor.$textElem.html(data)
            return true
        }
        return false
    }
}
