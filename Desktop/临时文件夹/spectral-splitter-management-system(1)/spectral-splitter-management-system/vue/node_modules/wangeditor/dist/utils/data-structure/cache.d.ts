/**
 * @description 双栈实现撤销恢复
 * @author fangzhicong
 */
import { CeilStack } from './stack';
export default class Cache<T> {
    protected maxSize: number;
    /**
     * 正常操作（用户输入、js代码修改内容、恢复操作）产生的缓存
     */
    protected data: CeilStack<T>;
    /**
     * 撤销操作产生的缓存（恢复操作时需要这些数据）
     */
    protected revokeData: CeilStack<T>;
    /**
     * 上一步操作是否为 撤销/恢复
     */
    protected isRe: boolean;
    constructor(maxSize: number);
    /**
     * 返回当前栈中的数据长度。格式为：[正常的数据的条数，被撤销的数据的条数]
     */
    get size(): number[];
    /**
     * 重设数据缓存器的缓存长度（第一次有效）
     */
    resetMaxSize(maxSize: number): void;
    /**
     * 保存数据
     */
    save(data: T): this;
    /**
     * 撤销
     * @param fn 撤销时，如果有数据，执行的回调函数
     */
    revoke(fn: (data: T) => void): boolean;
    /**
     * 恢复
     * @param fn 恢复时，如果有数据，执行的回调函数
     */
    restore(fn: (data: T) => void): boolean;
}
