/**
 * @description 双栈实现撤销恢复
 * @author fangzhicong
 */

import { CeilStack } from './stack'

export default class Cache<T> {
    /**
     * 正常操作（用户输入、js代码修改内容、恢复操作）产生的缓存
     */
    protected data: CeilStack<T>

    /**
     * 撤销操作产生的缓存（恢复操作时需要这些数据）
     */
    protected revokeData: CeilStack<T>

    /**
     * 上一步操作是否为 撤销/恢复
     */
    protected isRe: boolean = false

    constructor(protected maxSize: number) {
        this.data = new CeilStack(maxSize)
        this.revokeData = new CeilStack(maxSize)
    }

    /**
     * 返回当前栈中的数据长度。格式为：[正常的数据的条数，被撤销的数据的条数]
     */
    public get size() {
        return [this.data.size, this.revokeData.size]
    }

    /**
     * 重设数据缓存器的缓存长度（第一次有效）
     */
    public resetMaxSize(maxSize: number) {
        this.data.resetMax(maxSize)
        this.revokeData.resetMax(maxSize)
    }

    /**
     * 保存数据
     */
    public save(data: T) {
        if (this.isRe) {
            this.revokeData.clear()
            this.isRe = false
        }
        this.data.instack(data)
        return this
    }

    /**
     * 撤销
     * @param fn 撤销时，如果有数据，执行的回调函数
     */
    public revoke(fn: (data: T) => void) {
        !this.isRe && (this.isRe = true)
        let data = this.data.outstack()
        if (data) {
            this.revokeData.instack(data)
            fn(data)
            return true
        }
        return false
    }

    /**
     * 恢复
     * @param fn 恢复时，如果有数据，执行的回调函数
     */
    public restore(fn: (data: T) => void) {
        !this.isRe && (this.isRe = true)
        let data = this.revokeData.outstack()
        if (data) {
            this.data.instack(data)
            fn(data)
            return true
        }
        return false
    }
}
