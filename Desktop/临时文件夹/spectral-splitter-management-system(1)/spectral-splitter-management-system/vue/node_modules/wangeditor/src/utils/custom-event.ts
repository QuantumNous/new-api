/**
 * @description 自定义事件（暂时无用，有谁需要用时，一定要联系作者确认！！！）
 * @author wangfupeng
 */

export default class CustomEvent {
    private events: {
        // 如 'change': [fn1, fn2, fn3]
        [key: string]: Function[]
    }
    constructor() {
        this.events = {}
    }

    /**
     * 绑定自定义事件
     * @param type 事件类型
     * @param fn 函数
     */
    public on(type: string, fn: Function) {
        const events = this.events
        if (events[type] == null) events[type] = []

        events[type].push(fn)
    }

    /**
     * 解绑
     * @param type 事件类型
     * @param fn 函数
     */
    public off(type: string, fn?: Function) {
        const events = this.events

        // 解绑所有的事件
        if (!fn) {
            events[type] = []
            return
        }

        // 解绑单个事件
        events[type] = events[type].filter(f => f !== fn)
    }

    /**
     * 触发事件
     * @param type 事件类型
     */
    public emit(type: string) {
        const events = this.events
        let curEvents = events[type] || []

        curEvents.forEach(f => f())
    }
}
