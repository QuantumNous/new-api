import { ContainerFragment } from '.'
import $, { DomElement } from '../../../utils/dom-core'
import { Exec, HandlerListOptions, ListHandle } from './ListHandle'
import {
    insertBefore,
    createElement,
    createDocumentFragment,
    createElementFragment,
} from '../utils'

/**
 * 选区在序列内的处理
 */
export default class WrapListHandle extends ListHandle implements Exec {
    constructor(options: HandlerListOptions) {
        super(options)
    }

    exec(): void {
        const { listType, listTarget, $selectionElem, $startElem, $endElem } = this.options

        let $containerFragment: ContainerFragment // 容器 - HTML 文档片段
        const $nodes: DomElement[] = [] // 获取选中的段落

        // 获取 selectionElem 的标签名
        const containerNodeName = $selectionElem?.getNodeName()

        // 获取开始以及结束的 li 元素
        const $start = $startElem.prior
        const $end = $endElem.prior

        // =====================================
        // 当 开始节点 和 结束节点 没有 prior
        // 并且 开始节点 没有前一个兄弟节点
        // 并且 结束节点 没有后一个兄弟节点
        // 即代表 全选序列
        // =====================================
        if (
            (!$startElem.prior && !$endElem.prior) ||
            (!$start?.prev().length && !$end?.next().length)
        ) {
            // 获取当前序列下的所有 li 标签
            ;($selectionElem?.children() as DomElement).forEach(($node: HTMLElement) => {
                $nodes.push($($node))
            })

            // =====================================
            // 当 selectionElem 的标签名和按钮类型 一致 的时候
            // 代表着当前的操作是 取消 序列
            // =====================================
            if (containerNodeName === listType) {
                // 生成对应的段落(p)并添加到文档片段中，然后删除掉无用的 li
                $containerFragment = createElementFragment(
                    $nodes,
                    createDocumentFragment(), // 创建 文档片段
                    'p'
                )
            }

            // =====================================
            // 当 selectionElem 的标签名和按钮类型 不一致 的时候
            // 代表着当前的操作是 转换 序列
            // =====================================
            else {
                // 创建 序列节点
                $containerFragment = createElement(listTarget)

                // 因为是转换，所以 li 元素可以直接使用
                $nodes.forEach($node => {
                    $containerFragment.appendChild($node.elems[0])
                })
            }

            // 把 文档片段 或 序列节点 插入到 selectionElem 的前面
            this.selectionRangeElem.set($containerFragment)

            // 插入到 $selectionElem 之前
            insertBefore($selectionElem, $containerFragment, $selectionElem.elems[0])

            // 删除无用的 selectionElem 因为它被掏空了
            $selectionElem.remove()
        }

        // =====================================
        // 当不是全选序列的时候就代表是非全选序列(废话)
        // 非全选序列的情况
        // =====================================
        else {
            // 获取选中的内容
            let $startDom: DomElement = $start as DomElement
            while ($startDom.length) {
                $nodes.push($startDom)
                $end?.equal($startDom)
                    ? ($startDom = $(undefined)) // 结束
                    : ($startDom = $startDom.next()) // 继续
            }

            // 获取开始节点的上一个兄弟节点
            const $prveDom: DomElement = ($start as DomElement).prev()
            // 获取结束节点的下一个兄弟节点
            let $nextDom: DomElement = ($end as DomElement).next()

            // =====================================
            // 当 selectionElem 的标签名和按钮类型一致的时候
            // 代表着当前的操作是 取消 序列
            // =====================================
            if (containerNodeName === listType) {
                // 生成对应的段落(p)并添加到文档片段中，然后删除掉无用的 li
                $containerFragment = createElementFragment(
                    $nodes,
                    createDocumentFragment(), // 创建 文档片段
                    'p'
                )
            }

            // =====================================
            // 当 selectionElem 的标签名和按钮类型不一致的时候
            // 代表着当前的操作是 转换 序列
            // =====================================
            else {
                // 创建 文档片段
                $containerFragment = createElement(listTarget)

                // 因为是转换，所以 li 元素可以直接使用
                $nodes.forEach(($node: DomElement) => {
                    $containerFragment.append($node.elems[0])
                })
            }

            // =====================================
            // 当 prveDom 和 nextDom 都存在的时候
            // 代表着当前选区是在序列的中间
            // 所以要先把 下半部分 未选择的 li 元素独立出来生成一个 序列
            // =====================================
            if ($prveDom.length && $nextDom.length) {
                // 获取尾部的元素
                const $tailDomArr: DomElement[] = []
                while ($nextDom.length) {
                    $tailDomArr.push($nextDom)
                    $nextDom = $nextDom.next()
                }

                // 创建 尾部序列节点
                const $tailDocFragment = createElement(containerNodeName)

                // 把尾部元素节点添加到尾部序列节点中
                $tailDomArr.forEach(($node: DomElement) => {
                    $tailDocFragment.append($node.elems[0])
                })

                // 把尾部序列节点插入到 selectionElem 的后面
                $($tailDocFragment).insertAfter($selectionElem)

                // =====================================
                // 获取选区容器元素的父元素，一般就是编辑区域
                // 然后判断 selectionElem 是否还有下一个兄弟节点
                // 如果有，就把文档片段添加到 selectionElem 下一个兄弟节点前
                // 如果没有，就把文档片段添加到 编辑区域 末尾
                // =====================================
                this.selectionRangeElem.set($containerFragment)
                const $selectionNextDom: DomElement = $selectionElem.next()
                $selectionNextDom.length
                    ? insertBefore($selectionElem, $containerFragment, $selectionNextDom.elems[0])
                    : $selectionElem.parent().elems[0].append($containerFragment)
            }

            // =====================================
            // 不管是 取消 还是 转换 都需要重新插入节点
            //
            // prveDom.length 等于 0 即代表选区是 selectionElem 序列的上半部分
            // 上半部分的 li 元素
            // =====================================
            else if (!$prveDom.length) {
                // 文档片段插入到 selectionElem 之前
                this.selectionRangeElem.set($containerFragment)
                insertBefore($selectionElem, $containerFragment, $selectionElem.elems[0])
            }

            // =====================================
            // 不管是 取消 还是 转换 都需要重新插入节点
            //
            // nextDom.length 等于 0 即代表选区是 selectionElem 序列的下半部分
            // 下半部分的 li 元素  if (!$nextDom.length)
            // =====================================
            else {
                // 文档片段插入到 selectionElem 之后
                this.selectionRangeElem.set($containerFragment)
                const $selectionNextDom: DomElement = $selectionElem.next()
                $selectionNextDom.length
                    ? insertBefore($selectionElem, $containerFragment, $selectionNextDom.elems[0])
                    : $selectionElem.parent().elems[0].append($containerFragment)
            }
        }
    }
}
