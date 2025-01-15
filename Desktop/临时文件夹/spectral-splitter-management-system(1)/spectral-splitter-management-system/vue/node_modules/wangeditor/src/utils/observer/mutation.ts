/**
 * @description 封装 MutationObserver
 * @author fangzhicong
 */

export type callback = (mutations: MutationRecord[], observer: Mutation) => void

/**
 * 封装 MutationObserver，抽离成公共类
 */
export default class Mutation {
    /**
     * MutationObserver 实例
     */
    protected observer: MutationObserver

    /**
     * 被监听的 Node 节点（可继承的，方便扩展但又不会在外部被修改）
     */
    protected node?: Node

    /**
     * 默认的 MutationObserverInit 配置
     */
    protected options: MutationObserverInit = {
        subtree: true,
        childList: true,
        attributes: true,
        attributeOldValue: true,
        characterData: true,
        characterDataOldValue: true,
    }

    /**
     * MutationCallback
     */
    protected callback: (mutations: MutationRecord[]) => void

    /**
     * 构造器
     * @param fn 发生变化时执行的回调函数
     * @param options 自定义配置项
     */
    constructor(fn: callback, options?: MutationObserverInit) {
        this.callback = mutations => {
            fn(mutations, this)
        }
        this.observer = new MutationObserver(this.callback)
        options && (this.options = options)
    }

    public get target() {
        return this.node
    }

    /**
     * 绑定监听节点（初次绑定有效）
     * @param node 需要被监听的节点
     */
    public observe(node: Node) {
        if (!(this.node instanceof Node)) {
            this.node = node
            this.connect()
        }
    }

    /**
     * 连接监听器（开始观察）
     */
    public connect() {
        if (this.node) {
            this.observer.observe(this.node, this.options)
            return this
        }
        throw new Error('还未初始化绑定，请您先绑定有效的 Node 节点')
    }

    /**
     * 断开监听器（停止观察）
     */
    public disconnect() {
        let list = this.observer.takeRecords()
        list.length && this.callback(list)
        this.observer.disconnect()
    }
}
