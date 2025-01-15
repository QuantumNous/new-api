import { ContainerFragment } from '.'
import $, { DomElement } from '../../../utils/dom-core'
import { Exec, HandlerListOptions, ListHandle } from './ListHandle'
import {
    filterSelectionNodes,
    getStartPoint,
    getEndPoint,
    insertBefore,
    createElement,
    createDocumentFragment,
    createElementFragment,
} from '../utils'

export default class JoinListHandle extends ListHandle implements Exec {
    constructor(options: HandlerListOptions) {
        super(options)
    }

    exec(): void {
        const { editor, listType, listTarget, $startElem, $endElem } = this.options

        // 容器 - HTML 文档片段
        let $containerFragment: ContainerFragment

        // 获取选中的段落
        const $nodes: DomElement[] = editor.selection.getSelectionRangeTopNodes()

        // 获取开始段落和结束段落 标签名
        const startNodeName = $startElem?.getNodeName()
        const endNodeName = $endElem?.getNodeName()

        // =====================================
        // 开头结尾都是序列的情况下
        // 开头序列 和 结尾序列的标签名一致的时候
        // =====================================
        if (startNodeName === endNodeName) {
            // =====================================
            // 开头序列 和 结尾序列 中间还有其他的段落的时候
            // =====================================
            if ($nodes.length > 2) {
                // 弹出 开头 和 结尾
                $nodes.shift()
                $nodes.pop()

                // 把中间部分的节点元素转换成 li 元素并添加到文档片段后删除
                $containerFragment = createElementFragment(
                    filterSelectionNodes($nodes), // 过滤 $nodes 获取到符合要求的选中元素节点
                    createDocumentFragment() // 创建 文档片段
                )

                // =====================================
                // 由于开头序列 和 结尾序列的标签名一样，所以只判断了开头序列的
                // 当开头序列的标签名和按钮类型 一致 的时候
                // 代表着当前是一个 设置序列 的操作
                // =====================================
                if (startNodeName === listType) {
                    // 把结束序列的 li 元素添加到 文档片段中
                    $endElem.children()?.forEach(($list: HTMLElement) => {
                        $containerFragment.append($list)
                    })

                    // 下序列全选被掏空了，就卸磨杀驴吧
                    $endElem.remove()

                    // 在开始序列中添加 文档片段
                    this.selectionRangeElem.set($containerFragment)
                    $startElem.elems[0].append($containerFragment)
                }

                // =====================================
                // 由于开头序列 和 结尾序列的标签名一样，所以只判断了开头序列的
                // 当开头序列的标签名和按钮类型 不一致 的时候
                // 代表着当前是一个 转换序列 的操作
                // =====================================
                else {
                    // 创建 开始序列和结束序列的文档片段
                    const $startFragment = document.createDocumentFragment()
                    const $endFragment = document.createDocumentFragment()

                    // 获取起点元素
                    let $startDom: DomElement = getStartPoint($startElem)
                    // 获取上半序列中的选中内容，并添加到文档片段中
                    while ($startDom.length) {
                        const _element = $startDom.elems[0]
                        $startDom = $startDom.next()
                        $startFragment.append(_element)
                    }

                    // 获取结束元素
                    let $endDom: DomElement = getEndPoint($endElem)
                    // 获取下半序列中选中的内容
                    const domArr: Element[] = []
                    while ($endDom.length) {
                        domArr.unshift($endDom.elems[0])
                        $endDom = $endDom.prev()
                    }
                    // 添加到文档片段中
                    domArr.forEach(($node: Element) => {
                        $endFragment.append($node)
                    })

                    // 合并文档片段
                    const $orderFragment = createElement(listTarget)
                    $orderFragment.append($startFragment)
                    $orderFragment.append($containerFragment)
                    $orderFragment.append($endFragment)
                    $containerFragment = $orderFragment

                    // 插入
                    this.selectionRangeElem.set($containerFragment)
                    $($orderFragment).insertAfter($startElem)

                    // 序列全选被掏空了后，就卸磨杀驴吧
                    !$startElem.children()?.length && $startElem.remove()
                    !$endElem.children()?.length && $endElem.remove()
                }
            }

            // =====================================
            // 开头序列 和 结尾序列 中间没有其他的段落
            // =====================================
            else {
                $nodes.length = 0

                // 获取起点元素
                let $startDom: DomElement = getStartPoint($startElem)
                // 获取上半序列中的选中内容
                while ($startDom.length) {
                    $nodes.push($startDom)
                    $startDom = $startDom.next()
                }

                // 获取结束元素
                let $endDom: DomElement = getEndPoint($endElem)
                // 获取下半序列中选中的内容
                const domArr: DomElement[] = []
                // 获取下半序列中的选中内容
                while ($endDom.length) {
                    domArr.unshift($endDom)
                    $endDom = $endDom.prev()
                }

                // 融合内容
                $nodes.push(...domArr)

                // =====================================
                // 由于开头序列 和 结尾序列的标签名一样，所以只判断了开头序列的
                // 当开头序列的标签名和按钮类型 一致 的时候
                // 代表着当前是一个 取消序列 的操作
                // =====================================
                if (startNodeName === listType) {
                    // 创建 文档片段
                    // 把 li 转换为 p 标签
                    $containerFragment = createElementFragment(
                        $nodes,
                        createDocumentFragment(),
                        'p'
                    )

                    // 插入到 endElem 前
                    this.selectionRangeElem.set($containerFragment)
                    insertBefore($startElem, $containerFragment, $endElem.elems[0])
                }

                // =====================================
                // 由于开头序列 和 结尾序列的标签名一样，所以只判断了开头序列的
                // 当开头序列的标签名和按钮类型 不一致 的时候
                // 代表着当前是一个 设置序列 的操作
                // =====================================
                else {
                    // 创建 序列元素
                    $containerFragment = createElement(listTarget)
                    // li 元素添加到 序列元素 中
                    $nodes.forEach(($list: DomElement) => {
                        $containerFragment.append($list.elems[0])
                    })
                    // 插入到 startElem 之后
                    this.selectionRangeElem.set($containerFragment)
                    $($containerFragment).insertAfter($startElem)
                }

                // 序列全选被掏空了后，就卸磨杀驴吧
                !$startElem.children()?.length && $endElem.remove()
                !$endElem.children()?.length && $endElem.remove()
            }
        }

        // =====================================
        // 由于开头序列 和 结尾序列的标签名不一样
        // =====================================
        else {
            // 下序列元素数组
            const lowerListElems: DomElement[] = []
            // 获取结束元素
            let $endDom: DomElement = getEndPoint($endElem)
            // 获取下半序列中选中的内容
            while ($endDom.length) {
                lowerListElems.unshift($endDom)
                $endDom = $endDom.prev()
            }

            // 上序列元素数组
            const upperListElems: DomElement[] = []
            // 获取起点元素
            let $startDom: DomElement = getStartPoint($startElem)
            // 获取上半序列中的选中内容，并添加到文档片段中
            while ($startDom.length) {
                upperListElems.push($startDom)
                $startDom = $startDom.next()
            }

            // 创建 文档片段
            $containerFragment = createDocumentFragment()

            // 弹出开头和结尾的序列
            $nodes.shift()
            $nodes.pop()

            // 把头部序列的内容添加到文档片段当中
            upperListElems.forEach($list => $containerFragment.append($list.elems[0]))

            // 生成 li 标签，并且添加到 文档片段中，删除无用节点
            $containerFragment = createElementFragment(
                filterSelectionNodes($nodes), // 序列中间的数据 - 进行数据过滤
                $containerFragment
            )

            // 把尾部序列的内容添加到文档片段当中
            lowerListElems.forEach($list => $containerFragment.append($list.elems[0]))

            // 记录
            this.selectionRangeElem.set($containerFragment)

            // =====================================
            // 开头序列 和 设置序列类型相同
            // =====================================
            if (startNodeName === listType) {
                // 插入到 开始序列的尾部(作为子元素)
                $startElem.elems[0].append($containerFragment)

                // 序列全选被掏空了后，就卸磨杀驴吧
                !$endElem.children()?.length && $endElem.remove()
            }

            // =====================================
            // 结尾序列 和 设置序列类型相同
            // =====================================
            else {
                // 插入到结束序列的顶部(作为子元素)
                if ($endElem.children()?.length) {
                    const $endElemChild = $endElem.children() as DomElement
                    insertBefore($endElemChild, $containerFragment, $endElemChild.elems[0])
                } else {
                    $endElem.elems[0].append($containerFragment)
                }
            }
        }
    }
}
