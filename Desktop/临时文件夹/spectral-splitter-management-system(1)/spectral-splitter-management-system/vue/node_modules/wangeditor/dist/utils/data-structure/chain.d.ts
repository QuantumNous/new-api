/**
 * @description 数据结构 - 链表
 * @author fangzhicong
 */
/**
 * 特殊链表（数据尾插入、插入前自动清理指针后边的数据、插入后指针永远定位于最后一位元素、可限制链表长度、指针双向移动）
 */
export declare class TailChain<T> {
    /**
     * 链表数据
     */
    protected data: T[];
    /**
     * 链表最大长度，零表示长度不限
     */
    protected max: number;
    /**
     * 指针
     */
    protected point: number;
    protected isRe: boolean;
    /**
     * 允许用户重设一次 max 值
     */
    resetMax(maxSize: number): void;
    /**
     * 当前链表的长度
     */
    get size(): number;
    /**
     * 尾插入
     * @param data 插入的数据
     */
    insertLast<K extends T>(data: K): this;
    /**
     * 获取当前指针元素
     */
    current(): T | undefined;
    /**
     * 获取上一指针元素
     */
    prev(): T | undefined;
    /**
     * 下一指针元素
     */
    next(): T | undefined;
}
