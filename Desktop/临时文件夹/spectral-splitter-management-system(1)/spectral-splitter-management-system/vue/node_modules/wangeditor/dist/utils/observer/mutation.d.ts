/**
 * @description 封装 MutationObserver
 * @author fangzhicong
 */
export declare type callback = (mutations: MutationRecord[], observer: Mutation) => void;
/**
 * 封装 MutationObserver，抽离成公共类
 */
export default class Mutation {
    /**
     * MutationObserver 实例
     */
    protected observer: MutationObserver;
    /**
     * 被监听的 Node 节点（可继承的，方便扩展但又不会在外部被修改）
     */
    protected node?: Node;
    /**
     * 默认的 MutationObserverInit 配置
     */
    protected options: MutationObserverInit;
    /**
     * MutationCallback
     */
    protected callback: (mutations: MutationRecord[]) => void;
    /**
     * 构造器
     * @param fn 发生变化时执行的回调函数
     * @param options 自定义配置项
     */
    constructor(fn: callback, options?: MutationObserverInit);
    get target(): Node | undefined;
    /**
     * 绑定监听节点（初次绑定有效）
     * @param node 需要被监听的节点
     */
    observe(node: Node): void;
    /**
     * 连接监听器（开始观察）
     */
    connect(): this;
    /**
     * 断开监听器（停止观察）
     */
    disconnect(): void;
}
