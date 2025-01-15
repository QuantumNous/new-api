/**
 * @description 数据结构 - 栈
 * @author fangzhicong
 */
/**
 * 栈（限制最大数据条数，栈满后可以继续入栈，而先入栈的数据将失效）
 */
export declare class CeilStack<T> {
    /**
     * 数据缓存
     */
    protected data: T[];
    /**
     * 栈的最大长度。为零则长度不限
     */
    protected max: number;
    /**
     * 标识是否重设过 max 值
     */
    protected reset: boolean;
    constructor(max?: number);
    /**
     * 允许用户重设一次 max 值
     */
    resetMax(maxSize: number): void;
    /**
     * 当前栈中的数据条数
     */
    get size(): number;
    /**
     * 入栈
     * @param data 入栈的数据
     */
    instack(data: T): this;
    /**
     * 出栈
     */
    outstack(): T | undefined;
    /**
     * 清空栈
     */
    clear(): this;
}
