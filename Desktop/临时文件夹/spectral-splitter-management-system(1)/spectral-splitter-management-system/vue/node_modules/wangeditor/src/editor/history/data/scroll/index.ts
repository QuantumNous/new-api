/**
 * @description 记录 scrollTop
 * @author fangzhicong
 */

import Cache from '../../../../utils/data-structure/cache'
import Editor from '../../../index'
import { ScrollItem } from '../type'

export default class ScrollCache extends Cache<ScrollItem> {
    /**
     * 上一次的 scrollTop
     */
    private last: number = 0

    /**
     * 编辑区容器元素节点
     */
    private target: Element

    constructor(public editor: Editor) {
        super(editor.config.historyMaxSize)
        this.target = editor.$textElem.elems[0]
    }

    /**
     * 给编辑区容器绑定 scroll 事件
     */
    public observe() {
        this.target = this.editor.$textElem.elems[0]
        this.editor.$textElem.on('scroll', () => {
            this.last = this.target.scrollTop
        })
        this.resetMaxSize(this.editor.config.historyMaxSize)
    }

    /**
     * 保存 scrollTop 值
     */
    public save() {
        super.save([this.last, this.target.scrollTop])
        return this
    }

    /**
     * 撤销
     */
    public revoke() {
        return super.revoke(data => {
            this.target.scrollTop = data[0]
        })
    }

    /**
     * 恢复
     */
    public restore() {
        return super.restore(data => {
            this.target.scrollTop = data[1]
        })
    }
}
