/**
 * @description 差异备份
 * @author fangzhicong
 */

import Cache from '../../../../utils/data-structure/cache'
import compile from './compile'
import { revoke, restore } from './decompilation'
import { Compile } from '../type'
import Editor from '../../../index'

export default class NodeCache extends Cache<Compile[]> {
    constructor(public editor: Editor) {
        super(editor.config.historyMaxSize)
    }

    public observe() {
        this.resetMaxSize(this.editor.config.historyMaxSize)
    }

    /**
     * 编译并保存数据
     */
    public compile(data: MutationRecord[]) {
        this.save(compile(data))
        return this
    }

    /**
     * 撤销
     */
    public revoke() {
        return super.revoke(data => {
            revoke(data)
        })
    }

    /**
     * 恢复
     */
    public restore() {
        return super.restore(data => {
            restore(data)
        })
    }
}
