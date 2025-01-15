/**
 * @description 编辑器 change 事件
 * @author fangzhicong
 */

import Editor from '../index'
import Mutation from '../../utils/observer/mutation'
import { debounce } from '../../utils/util'
import { EMPTY_FN } from '../../utils/const'

/**
 * 剔除编辑区容器的 attribute 变化中的非 contenteditable 变化
 * @param mutations MutationRecord[]
 * @param tar 编辑区容器的 DOM 节点
 */
function mutationsFilter(mutations: MutationRecord[], tar: Node) {
    // 剔除编辑区容器的 attribute 变化中的非 contenteditable 变化
    return mutations.filter(({ type, target, attributeName }) => {
        return (
            type != 'attributes' ||
            (type == 'attributes' && (attributeName == 'contenteditable' || target != tar))
        )
    })
}

/**
 * Change 实现
 */
export default class Change extends Mutation {
    /**
     * 变化的数据集合
     */
    private data: MutationRecord[] = []

    /**
     * 异步保存数据
     */
    private asyncSave: Function = EMPTY_FN

    constructor(public editor: Editor) {
        super((mutations, observer) => {
            // 数据过滤
            mutations = mutationsFilter(mutations, observer.target as Node)

            // 存储数据
            this.data.push(...mutations)

            // 标准模式下
            if (!editor.isCompatibleMode) {
                // 在非中文输入状态下时才保存数据
                if (!editor.isComposing) {
                    return this.asyncSave()
                }
            }
            // 兼容模式下
            else {
                this.asyncSave()
            }
        })
    }

    /**
     * 保存变化的数据并发布 change event
     */
    private save() {
        // 有数据
        if (this.data.length) {
            // 保存变化数据
            this.editor.history.save(this.data)

            // 清除缓存
            this.data.length = 0

            this.emit()
        }
    }

    /**
     * 发布 change event
     */
    public emit() {
        // 执行 onchange 回调
        this.editor.txt.eventHooks.changeEvents.forEach(fn => fn())
    }

    // 重写 observe
    public observe() {
        super.observe(this.editor.$textElem.elems[0])

        let timeout = this.editor.config.onchangeTimeout
        this.asyncSave = debounce(() => {
            this.save()
        }, timeout)

        if (!this.editor.isCompatibleMode) {
            this.editor.$textElem.on('compositionend', () => {
                this.asyncSave()
            })
        }
    }
}
