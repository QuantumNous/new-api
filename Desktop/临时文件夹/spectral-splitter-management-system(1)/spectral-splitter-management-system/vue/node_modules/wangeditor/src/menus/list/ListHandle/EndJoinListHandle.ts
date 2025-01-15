import { ContainerFragment } from '.'
import $, { DomElement } from '../../../utils/dom-core'
import { Exec, HandlerListOptions, ListHandle } from './ListHandle'
import {
    filterSelectionNodes,
    getEndPoint,
    insertBefore,
    createElement,
    createDocumentFragment,
    createElementFragment,
} from '../utils'

export default class EndJoinListHandle extends ListHandle implements Exec {
    constructor(options: HandlerListOptions) {
        super(options)
    }

    exec(): void {
        const { editor, listType, listTarget, $endElem } = this.options

        // 容器 - HTML 文档片段
        let $containerFragment: ContainerFragment

        // 获取选中的段落
        const $nodes: DomElement[] = editor.selection.getSelectionRangeTopNodes()

        // 获取结束段落标签名
        const endNodeName = $endElem?.getNodeName()

        // 弹出 结束序列
        $nodes.pop()

        // 下序列元素数组
        const lowerListElems: DomElement[] = []
        // 获取结束元素
        let $endDom: DomElement = getEndPoint($endElem)
        // 获取下半序列中选中的内容
        while ($endDom.length) {
            lowerListElems.unshift($endDom)
            $endDom = $endDom.prev()
        }

        // =====================================
        // 当前序列类型和结束序列的类型 一致
        // 代表当前是一个 融合(把其他段落加入到结束序列中) 的操作
        // =====================================
        if (endNodeName === listType) {
            // 生成 li 元属，并删除原来的 dom 元素
            $containerFragment = createElementFragment(
                filterSelectionNodes($nodes), // 过滤元素节点数据
                createDocumentFragment() // 创建 文档片段
            )

            lowerListElems.forEach($list => $containerFragment.append($list.elems[0]))

            // 插入到结束序列之前
            this.selectionRangeElem.set($containerFragment)

            if ($endElem.children()?.length) {
                const $endElemChild = $endElem.children() as DomElement
                insertBefore($endElemChild, $containerFragment, $endElemChild.elems[0])
            } else {
                $endElem.elems[0].append($containerFragment)
            }
        }

        // =====================================
        // 当前序列类型和结束序列的类型 不一致
        // 代表当前是一个 设置序列 的操作
        // =====================================
        else {
            // 过滤元素节点数据
            const $selectionNodes = filterSelectionNodes($nodes)
            // 把下序列的内容添加到过滤元素中
            $selectionNodes.push(...lowerListElems)
            // 生成 li 元素并且添加到序列节点后删除原节点
            $containerFragment = createElementFragment(
                $selectionNodes,
                createElement(listTarget) // 创建 序列节点
            )

            // 插入到结束序列之前
            this.selectionRangeElem.set($containerFragment)
            $($containerFragment).insertBefore($endElem)

            // 序列全选被掏空了后，就卸磨杀驴吧
            !$endElem.children()?.length && $endElem.remove()
        }
    }
}
