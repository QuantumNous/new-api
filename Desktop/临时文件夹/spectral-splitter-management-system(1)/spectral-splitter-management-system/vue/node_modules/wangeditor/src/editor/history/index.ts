/**
 * @description 历史记录
 * @author fangzhicong
 */

import ContentCache from './data/content'
import ScrollCache from './data/scroll'
import RangeCache from './data/range'
import Editor from '../index'

/**
 * 历史记录（撤销、恢复）
 */
export default class History {
    // 数据缓存器实例
    private content: ContentCache

    // scroll 缓存
    private scroll: ScrollCache

    // Range 缓存
    private range: RangeCache

    constructor(public editor: Editor) {
        this.content = new ContentCache(editor)
        this.scroll = new ScrollCache(editor)
        this.range = new RangeCache(editor)
    }

    /**
     *  获取缓存中的数据长度。格式为：[正常的数据的条数，被撤销的数据的条数]
     */
    public get size() {
        return this.scroll.size
    }

    /**
     * 初始化绑定。在 editor.create() 结尾时调用
     */
    public observe() {
        this.content.observe()
        this.scroll.observe()
        // 标准模式下才进行初始化绑定
        !this.editor.isCompatibleMode && this.range.observe()
    }

    /**
     * 保存数据
     */
    public save(mutations: MutationRecord[]) {
        if (mutations.length) {
            this.content.save(mutations)
            this.scroll.save()
            // 标准模式下才进行缓存
            !this.editor.isCompatibleMode && this.range.save()
        }
    }

    /**
     * 撤销
     */
    public revoke() {
        this.editor.change.disconnect()
        const res = this.content.revoke()
        if (res) {
            this.scroll.revoke()
            // 标准模式下才执行
            if (!this.editor.isCompatibleMode) {
                this.range.revoke()
                this.editor.$textElem.focus()
            }
        }
        this.editor.change.connect()
        // 如果用户在 onchange 中修改了内容（DOM），那么缓存中的节点数据可能不连贯了，不连贯的数据必将导致恢复失败，所以必须将用户的 onchange 处于监控状态中
        res && this.editor.change.emit()
    }

    /**
     * 恢复
     */
    public restore() {
        this.editor.change.disconnect()
        const res = this.content.restore()
        if (res) {
            this.scroll.restore()
            // 标准模式下才执行
            if (!this.editor.isCompatibleMode) {
                this.range.restore()
                this.editor.$textElem.focus()
            }
        }
        this.editor.change.connect()
        // 与 revoke 同理
        res && this.editor.change.emit()
    }
}
