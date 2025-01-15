/**
 * @description 整合差异备份和内容备份，进行统一管理
 * @author fangzhicong
 */

import NodeCache from './node'
import HtmlCache from './html'
import Editor from '../../index'

export default class ContentCache {
    /**
     * 内容备份的管理器
     */
    public cache?: HtmlCache | NodeCache

    constructor(public editor: Editor) {}

    /**
     * 初始化绑定
     */
    observe() {
        if (this.editor.isCompatibleMode) {
            // 兼容模式（内容备份）
            this.cache = new HtmlCache(this.editor)
        } else {
            // 标准模式（差异备份/节点备份）
            this.cache = new NodeCache(this.editor)
        }
        this.cache.observe()
    }

    /**
     * 保存
     */
    public save(mutations: MutationRecord[]) {
        if (this.editor.isCompatibleMode) {
            ;(this.cache as HtmlCache).save()
        } else {
            ;(this.cache as NodeCache).compile(mutations)
        }
    }

    /**
     * 撤销
     */
    public revoke() {
        return this.cache?.revoke()
    }

    /**
     * 恢复
     */
    public restore() {
        return this.cache?.restore()
    }
}
