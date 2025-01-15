/**
 * @description 封装 DOM 操作
 * @wangfupeng
 */

import Editor from '../editor/index'
import { toArray } from './util'

// 记录元素基于上一个相对&绝对定位的位置信息
type OffsetDataType = {
    top: number
    left: number
    width: number
    height: number
    parent: Element | null
}

// 记录代理事件绑定
type listener = (e: Event) => void
type EventItem = {
    elem: HTMLElement
    selector: string
    fn: listener
    agentFn: listener
}
const AGENT_EVENTS: EventItem[] = []

/**
 * 根据 html 字符串创建 elem
 * @param {String} html html
 */
function _createElemByHTML(html: string): HTMLElement[] {
    const div = document.createElement('div')
    div.innerHTML = html
    const elems = div.children
    return toArray(elems)
}

/**
 * 判断是否是 DOM List
 * @param selector DOM 元素或列表
 */
function _isDOMList<T extends HTMLCollection | NodeList>(selector: unknown): selector is T {
    if (!selector) {
        return false
    }
    if (selector instanceof HTMLCollection || selector instanceof NodeList) {
        return true
    }
    return false
}

/**
 * 封装 querySelectorAll
 * @param selector css 选择器
 */
function _querySelectorAll(selector: string): HTMLElement[] {
    const elems = document.querySelectorAll(selector)
    return toArray(elems)
}

/**
 * 封装 _styleArrTrim
 * @param styleArr css
 */
function _styleArrTrim(style: string | string[]): string[] {
    let styleArr: string[] = []
    let resultArr: string[] = []

    if (!Array.isArray(style)) {
        // 有 style，将 style 按照 `;` 拆分为数组
        styleArr = style.split(';')
    } else {
        styleArr = style
    }

    styleArr.forEach(item => {
        // 对每项样式，按照 : 拆分为 key 和 value
        let arr = item.split(':').map(i => {
            return i.trim()
        })
        if (arr.length === 2) {
            resultArr.push(arr[0] + ':' + arr[1])
        }
    })
    return resultArr
}

export type DomElementSelector =
    | string
    | DomElement
    | Document
    | Node
    | NodeList
    | ChildNode
    | ChildNode[]
    | Element
    | HTMLElement
    | HTMLElement[]
    | HTMLCollection
    | EventTarget
    | null
    | undefined

// 构造函数
export class DomElement<T extends DomElementSelector = DomElementSelector> {
    // 定义属性
    selector!: T
    length: number
    elems: HTMLElement[]
    dataSource: Map<string, any>
    prior?: DomElement // 通过 getNodeTop 获取顶级段落的时候，可以通过 prior 去回溯来源的子节点

    /**
     * 构造函数
     * @param selector 任一类型的选择器
     */
    constructor(selector: T) {
        // 初始化属性
        this.elems = []
        this.length = this.elems.length
        this.dataSource = new Map()

        if (!selector) {
            return
        }

        // 原本就是 DomElement 实例，则直接返回
        if (selector instanceof DomElement) {
            return selector as DomElement<T>
        }

        let selectorResult: HTMLElement[] = [] // 存储查询结果
        const nodeType = selector instanceof Node ? selector.nodeType : -1
        this.selector = selector

        if (nodeType === 1 || nodeType === 9) {
            selectorResult = [selector as HTMLElement]
        } else if (_isDOMList(selector)) {
            // DOM List
            selectorResult = toArray(selector)
        } else if (selector instanceof Array) {
            // Element 数组（其他数据类型，暂时忽略）
            selectorResult = selector as HTMLElement[]
        } else if (typeof selector === 'string') {
            // 字符串
            const tmpSelector = selector.replace('/\n/mg', '').trim()
            if (tmpSelector.indexOf('<') === 0) {
                // 如 <div>
                selectorResult = _createElemByHTML(tmpSelector)
            } else {
                // 如 #id .class
                selectorResult = _querySelectorAll(tmpSelector)
            }
        }

        const length = selectorResult.length
        if (!length) {
            // 空数组
            return this
        }

        // 加入 DOM 节点
        let i = 0
        for (; i < length; i++) {
            this.elems.push(selectorResult[i])
        }
        this.length = length
    }

    /**
     * 获取元素 id
     */
    get id(): string {
        return this.elems[0].id
    }

    /**
     * 遍历所有元素，执行回调函数
     * @param fn 回调函数
     */
    forEach(fn: (ele: HTMLElement, index?: number) => boolean | unknown): DomElement {
        for (let i = 0; i < this.length; i++) {
            const elem = this.elems[i]
            const result = fn.call(elem, elem, i)
            if (result === false) {
                break
            }
        }
        return this
    }

    /**
     * 克隆元素
     * @param deep 是否深度克隆
     */
    clone(deep: boolean = false): DomElement {
        const cloneList: HTMLElement[] = []
        this.elems.forEach(elem => {
            cloneList.push(elem.cloneNode(!!deep) as HTMLElement)
        })
        return $(cloneList)
    }

    /**
     * 获取第几个元素
     * @param index index
     */
    get(index: number = 0): DomElement {
        const length = this.length
        if (index >= length) {
            index = index % length
        }
        return $(this.elems[index])
    }

    /**
     * 获取第一个元素
     */
    first(): DomElement {
        return this.get(0)
    }

    /**
     * 获取最后一个元素
     */
    last(): DomElement {
        const length = this.length
        return this.get(length - 1)
    }

    /**
     * 绑定事件
     * @param type 事件类型
     * @param selector DOM 选择器
     * @param fn 事件函数
     */
    on(type: string, fn: Function): DomElement
    on(type: string, selector: string, fn: Function): DomElement
    on(type: string, selector: string | Function, fn?: Function): DomElement {
        if (!type) return this

        // 没有 selector ，只有 type 和 fn
        if (typeof selector === 'function') {
            fn = selector
            selector = ''
        }

        return this.forEach(elem => {
            // 没有事件代理
            if (!selector) {
                // 无代理
                elem.addEventListener(type, fn as listener)
                return
            }

            // 有事件代理
            const agentFn: listener = function (e) {
                const target = e.target as HTMLElement
                if (target.matches(selector as string)) {
                    ;(fn as listener).call(target, e)
                }
            }
            elem.addEventListener(type, agentFn)

            // 缓存代理事件
            AGENT_EVENTS.push({
                elem: elem,
                selector: selector as string,
                fn: fn as listener,
                agentFn,
            })
        })
    }

    /**
     * 解绑事件
     * @param type 事件类型
     * @param selector DOM 选择器
     * @param fn 事件函数
     */
    off(type: string, fn: Function): DomElement
    off(type: string, selector: string, fn: Function): DomElement
    off(type: string, selector: string | Function, fn?: Function): DomElement {
        if (!type) return this

        // 没有 selector ，只有 type 和 fn
        if (typeof selector === 'function') {
            fn = selector
            selector = ''
        }

        return this.forEach(function (elem: HTMLElement) {
            // 解绑事件代理
            if (selector) {
                let idx = -1
                for (let i = 0; i < AGENT_EVENTS.length; i++) {
                    let item = AGENT_EVENTS[i]
                    if (item.selector === selector && item.fn === fn && item.elem === elem) {
                        idx = i
                        break
                    }
                }
                if (idx !== -1) {
                    const { agentFn } = AGENT_EVENTS.splice(idx, 1)[0]
                    elem.removeEventListener(type, agentFn)
                }
            } else {
                // @ts-ignore
                elem.removeEventListener(type, fn)
            }
        })
    }

    /**
     * 设置/获取 属性
     * @param key key
     * @param val value
     */
    attr(key: string): string
    attr(key: string, val: string): DomElement
    attr(key: string, val?: string): DomElement | string {
        if (val == null) {
            // 获取数据
            return this.elems[0].getAttribute(key) || ''
        }

        // 否则，设置属性
        return this.forEach(function (elem: HTMLElement) {
            elem.setAttribute(key, val)
        })
    }

    /**
     * 删除 属性
     * @param key key
     */
    removeAttr(key: string): void {
        this.forEach(function (elem: HTMLElement) {
            elem.removeAttribute(key)
        })
    }

    /**
     * 添加 css class
     * @param className css class
     */
    addClass(className?: string): DomElement {
        if (!className) {
            return this
        }

        return this.forEach(function (elem: HTMLElement) {
            if (elem.className) {
                // 当前有 class
                let arr: string[] = elem.className.split(/\s/)
                arr = arr.filter(item => {
                    return !!item.trim()
                })
                // 添加 class
                if (arr.indexOf(className) < 0) {
                    arr.push(className)
                }
                // 修改 elem.class
                elem.className = arr.join(' ')
            } else {
                // 当前没有 class
                elem.className = className
            }
        })
    }

    /**
     * 添加 css class
     * @param className css class
     */
    removeClass(className?: string): DomElement {
        if (!className) {
            return this
        }
        return this.forEach(function (elem: HTMLElement) {
            if (!elem.className) {
                // 当前无 class
                return
            }

            let arr: string[] = elem.className.split(/\s/)
            arr = arr.filter(item => {
                item = item.trim()
                // 删除 class
                if (!item || item === className) {
                    return false
                }
                return true
            })
            // 修改 elem.class
            elem.className = arr.join(' ')
        })
    }

    /**
     * 是否有传入的 css class
     * @param className css class
     */
    hasClass(className?: string): boolean {
        if (!className) {
            return false
        }
        const elem = this.elems[0]
        if (!elem.className) {
            // 当前无 class
            return false
        }
        let arr: string[] = elem.className.split(/\s/)
        return arr.includes(className) // 是否包含
    }

    /**
     * 修改 css
     * @param key css key
     * @param val css value
     */
    // css(key: string): string
    css(key: string, val?: string | number): DomElement {
        let currentStyle: string
        if (val == '') {
            currentStyle = ''
        } else {
            currentStyle = `${key}:${val};`
        }
        return this.forEach(elem => {
            const style = (elem.getAttribute('style') || '').trim()
            if (style) {
                // 有 style，将 style 按照 `;` 拆分为数组
                let resultArr: string[] = _styleArrTrim(style)

                // 替换现有的 style
                resultArr = resultArr.map(item => {
                    if (item.indexOf(key) === 0) {
                        return currentStyle
                    } else {
                        return item
                    }
                })
                // 新增 style
                if (currentStyle != '' && resultArr.indexOf(currentStyle) < 0) {
                    resultArr.push(currentStyle)
                }

                // 去掉 空白
                if (currentStyle == '') {
                    resultArr = _styleArrTrim(resultArr)
                }

                // 重新设置 style
                elem.setAttribute('style', resultArr.join('; '))
            } else {
                // 当前没有 style
                elem.setAttribute('style', currentStyle)
            }
        })
    }

    /**
     * 封装 getBoundingClientRect
     */
    getBoundingClientRect(): DOMRect {
        const elem = this.elems[0]
        return elem.getBoundingClientRect()
    }

    /**
     * 显示
     */
    show(): DomElement {
        return this.css('display', 'block')
    }

    /**
     * 隐藏
     */
    hide(): DomElement {
        return this.css('display', 'none')
    }

    /**
     * 获取子节点（只有 DOM 元素）
     */
    children(): DomElement | null {
        const elem = this.elems[0]
        if (!elem) {
            return null
        }

        return $(elem.children)
    }

    /**
     * 获取子节点（包括文本节点）
     */
    childNodes(): DomElement | null {
        const elem = this.elems[0]
        if (!elem) {
            return null
        }

        return $(elem.childNodes)
    }

    /**
     * 将子元素全部替换
     * @param $children 新的child节点
     */
    replaceChildAll($children: DomElement): void {
        const parent = this.getNode()
        const elem = this.elems[0]
        while (elem.hasChildNodes()) {
            parent.firstChild && elem.removeChild(parent.firstChild)
        }
        this.append($children)
    }

    /**
     * 增加子节点
     * @param $children 子节点
     */
    append($children: DomElement): DomElement {
        return this.forEach(elem => {
            $children.forEach(function (child: HTMLElement) {
                elem.appendChild(child)
            })
        })
    }

    /**
     * 移除当前节点
     */
    remove(): DomElement {
        return this.forEach(elem => {
            if (elem.remove) {
                elem.remove()
            } else {
                const parent = elem.parentElement
                parent && parent.removeChild(elem)
            }
        })
    }

    /**
     * 当前元素，是否包含某个子元素
     * @param $child 子元素
     */
    isContain($child: DomElement): boolean {
        const elem = this.elems[0]
        const child = $child.elems[0]
        return elem.contains(child)
    }

    /**
     * 获取当前元素 nodeName
     */
    getNodeName(): string {
        const elem = this.elems[0]
        return elem.nodeName
    }

    /**
     * 根据元素位置获取元素节点（默认获取0位置的节点）
     * @param n 元素节点位置
     */
    getNode(n: number = 0): Node {
        let elem: Node
        elem = this.elems[n]
        return elem
    }

    /**
     * 查询
     * @param selector css 选择器
     */
    find(selector: string): DomElement {
        const elem = this.elems[0]
        return $(elem.querySelectorAll(selector))
    }

    /**
     * 获取/设置 元素 text
     * @param val text 值
     */
    text(): string
    text(val: string): DomElement
    text(val?: string): DomElement | string {
        if (!val) {
            // 获取 text
            const elem = this.elems[0]

            return elem.innerHTML.replace(/<[^>]+>/g, () => '')
        } else {
            // 设置 text
            return this.forEach(function (elem: HTMLElement) {
                elem.innerHTML = val
            })
        }
    }

    /**
     * 设置/获取 元素 html
     * @param val html 值
     */
    html(): string
    html(val: string): DomElement
    html(val?: string): DomElement | string {
        const elem = this.elems[0]
        if (!val) {
            // 获取 html
            return elem.innerHTML
        } else {
            // 设置 html
            elem.innerHTML = val
            return this
        }
    }

    /**
     * 获取元素 value
     */
    val(): string {
        const elem = this.elems[0]
        return (elem as any).value.trim() // 暂用 any
    }

    /**
     * focus 到当前元素
     */
    focus(): DomElement {
        return this.forEach(elem => {
            elem.focus()
        })
    }

    /**
     * 当前元素前一个兄弟节点
     */
    prev(): DomElement {
        const elem = this.elems[0]
        return $(elem.previousElementSibling)
    }

    /**
     * 当前元素后一个兄弟节点
     * 不包括文本节点、注释节点）
     */
    next(): DomElement {
        const elem = this.elems[0]
        return $(elem.nextElementSibling)
    }

    /**
     * 获取当前节点的下一个兄弟节点
     * 包括文本节点、注释节点即回车、换行、空格、文本等等）
     */
    getNextSibling(): DomElement {
        const elem = this.elems[0]
        return $(elem.nextSibling)
    }

    /**
     * 获取父元素
     */
    parent(): DomElement {
        const elem = this.elems[0]
        return $(elem.parentElement)
    }

    /**
     * 查找父元素，直到满足 selector 条件
     * @param selector css 选择器
     * @param curElem 从哪个元素开始查找，默认为当前元素
     */
    parentUntil(selector: string, curElem?: HTMLElement): DomElement | null {
        const elem = curElem || this.elems[0]
        if (elem.nodeName === 'BODY') {
            return null
        }

        const parent = elem.parentElement
        if (parent === null) {
            return null
        }

        if (parent.matches(selector)) {
            // 找到，并返回
            return $(parent)
        }

        // 继续查找，递归
        return this.parentUntil(selector, parent)
    }

    /**
     * 查找父元素，直到满足 selector 条件,或者 到达 编辑区域容器以及菜单栏容器
     * @param selector css 选择器
     * @param curElem 从哪个元素开始查找，默认为当前元素
     */
    parentUntilEditor(selector: string, editor: Editor, curElem?: HTMLElement): DomElement | null {
        const elem = curElem || this.elems[0]
        if ($(elem).equal(editor.$textContainerElem) || $(elem).equal(editor.$toolbarElem)) {
            return null
        }

        const parent = elem.parentElement
        if (parent === null) {
            return null
        }

        if (parent.matches(selector)) {
            // 找到，并返回
            return $(parent)
        }

        // 继续查找，递归
        return this.parentUntilEditor(selector, editor, parent)
    }

    /**
     * 判读是否相等
     * @param $elem 元素
     */
    equal($elem: DomElement | HTMLElement): boolean {
        if ($elem instanceof DomElement) {
            return this.elems[0] === $elem.elems[0]
        } else if ($elem instanceof HTMLElement) {
            return this.elems[0] === $elem
        } else {
            return false
        }
    }

    /**
     * 将该元素插入到某个元素前面
     * @param selector css 选择器
     */
    insertBefore(selector: string | DomElement): DomElement {
        const $referenceNode = $(selector)
        const referenceNode = $referenceNode.elems[0]
        if (!referenceNode) {
            return this
        }
        return this.forEach(elem => {
            const parent = referenceNode.parentNode as Node
            parent?.insertBefore(elem, referenceNode)
        })
    }

    /**
     * 将该元素插入到selector元素后面
     * @param selector css 选择器
     */
    insertAfter(selector: string | DomElement): DomElement {
        const $referenceNode = $(selector)
        const referenceNode = $referenceNode.elems[0]
        const anchorNode = referenceNode && referenceNode.nextSibling
        if (!referenceNode) {
            return this
        }
        return this.forEach(function (elem: HTMLElement) {
            const parent = referenceNode.parentNode as Node
            if (anchorNode) {
                parent.insertBefore(elem, anchorNode)
            } else {
                parent.appendChild(elem)
            }
        })
    }

    /**
     * 设置/获取 数据
     * @param key key
     * @param value value
     */
    data<T>(key: string, value?: T): T | undefined {
        if (value != null) {
            // 设置数据
            this.dataSource.set(key, value)
        } else {
            // 获取数据
            return this.dataSource.get(key)
        }
    }

    /**
     * 获取当前节点的顶级(段落)
     * @param editor 富文本实例
     */
    getNodeTop(editor: Editor): DomElement {
        // 异常抛出，空的 DomElement 直接返回
        if (this.length < 1) {
            return this
        }

        // 获取父级元素，并判断是否是 编辑区域
        // 如果是则返回当前节点
        const $parent = this.parent()

        // fix：添加当前元素与编辑区元素的比较，防止传入的当前元素就是编辑区元素而造成的获取顶级元素为空的情况
        if (editor.$textElem.equal(this) || editor.$textElem.equal($parent)) {
            return this
        }

        // 到了此处，即代表当前节点不是顶级段落
        // 将当前节点存放于父节点的 prior 字段下
        // 主要用于 回溯 子节点
        // 例如：ul ol 等标签
        // 实际操作的节点是 li 但是一个 ul ol 的子节点可能有多个
        // 所以需要对其进行 回溯 找到对应的子节点
        $parent.prior = this
        return $parent.getNodeTop(editor)
    }

    /**
     * 获取当前 节点 基与上一个拥有相对或者解决定位的父容器的位置
     * @param editor 富文本实例
     */
    getOffsetData(): OffsetDataType {
        const $node = this.elems[0]
        return {
            top: $node.offsetTop,
            left: $node.offsetLeft,
            width: $node.offsetWidth,
            height: $node.offsetHeight,
            parent: $node.offsetParent,
        }
    }

    /**
     * 从上至下进行滚动
     * @param top 滚动的值
     */
    scrollTop(top: number): void {
        const $node = this.elems[0]
        $node.scrollTo({ top })
    }
}

// new 一个对象
function $(...arg: ConstructorParameters<typeof DomElement>): DomElement {
    return new DomElement(...arg)
}

export default $
