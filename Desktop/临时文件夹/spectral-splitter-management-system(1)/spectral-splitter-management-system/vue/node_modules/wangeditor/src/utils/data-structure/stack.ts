/**
 * @description 数据结构 - 栈
 * @author fangzhicong
 */

/**
 * 栈（限制最大数据条数，栈满后可以继续入栈，而先入栈的数据将失效）
 */
// 取名灵感来自 Math.ceil，向上取有效值
export class CeilStack<T> {
    /**
     * 数据缓存
     */
    protected data: T[] = []

    /**
     * 栈的最大长度。为零则长度不限
     */
    protected max: number = 0

    /**
     * 标识是否重设过 max 值
     */
    protected reset: boolean = false

    constructor(max: number = 0) {
        max = Math.abs(max)
        max && (this.max = max)
    }

    /**
     * 允许用户重设一次 max 值
     */
    public resetMax(maxSize: number) {
        maxSize = Math.abs(maxSize)
        if (!this.reset && !isNaN(maxSize)) {
            this.max = maxSize
            this.reset = true
        }
    }

    /**
     * 当前栈中的数据条数
     */
    public get size() {
        return this.data.length
    }

    /**
     * 入栈
     * @param data 入栈的数据
     */
    public instack(data: T) {
        this.data.unshift(data)
        if (this.max && this.size > this.max) {
            this.data.length = this.max
        }
        return this
    }

    /**
     * 出栈
     */
    public outstack(): T | undefined {
        return this.data.shift()
    }

    /**
     * 清空栈
     */
    public clear() {
        this.data.length = 0
        return this
    }
}
