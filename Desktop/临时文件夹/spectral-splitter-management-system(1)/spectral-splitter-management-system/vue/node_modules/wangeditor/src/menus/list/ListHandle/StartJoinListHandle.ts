import { ContainerFragment } from '.'
import $, { DomElement } from '../../../utils/dom-core'
import { Exec, HandlerListOptions, ListHandle } from './ListHandle'
import {
    filterSelectionNodes,
    getStartPoint,
    createElement,
    createDocumentFragment,
    createElementFragment,
} from '../utils'

export default class StartJoinListHandle extends ListHandle implements Exec {
    constructor(options: HandlerListOptions) {
        super(options)
    }

    exec(): void {
        const { editor, listType, listTarget, $startElem } = this.options

        // 容器 - HTML 文档片段
        let $containerFragment: ContainerFragment

        // 获取选中的段落
        const $nodes: DomElement[] = editor.selection.getSelectionRangeTopNodes()

        // 获取开始段落标签名
        const startNodeName = $startElem?.getNodeName()

        // 弹出 开头序列
        $nodes.shift()

        // 上序列元素数组
        const upperListElems: DomElement[] = []
        // 获取起点元素
        let $startDom: DomElement = getStartPoint($startElem)
        // 获取上半序列中的选中内容，并添加到文档片段中
        while ($startDom.length) {
            upperListElems.push($startDom)
            $startDom = $startDom.next()
        }

        // =====================================
        // 当前序列类型和开头序列的类型 一致
        // 代表当前是一个 融合(把其他段落加入到开头序列中) 的操作
        // =====================================
        if (startNodeName === listType) {
            $containerFragment = createDocumentFragment()

            upperListElems.forEach($list => $containerFragment.append($list.elems[0]))

            // 生成 li 元属，并删除
            $containerFragment = createElementFragment(
                filterSelectionNodes($nodes), // 过滤元素节点数据
                $containerFragment
            )

            // 插入到开始序列末尾
            this.selectionRangeElem.set($containerFragment)
            // this.selectionRangeElem.set($startElem.elems[0])
            $startElem.elems[0].append($containerFragment)
        }

        // =====================================
        // 当前序列类型和开头序列的类型 不一致
        // 代表当前是一个 设置序列 的操作
        // =====================================
        else {
            // 创建 序列节点
            $containerFragment = createElement(listTarget)

            upperListElems.forEach($list => $containerFragment.append($list.elems[0]))

            // 生成 li 元素，并添加到 序列节点 当中，删除无用节点
            $containerFragment = createElementFragment(
                filterSelectionNodes($nodes), // 过滤普通节点
                $containerFragment
            )

            // 插入到开始元素
            this.selectionRangeElem.set($containerFragment)
            $($containerFragment).insertAfter($startElem)

            // 序列全选被掏空了后，就卸磨杀驴吧
            !$startElem.children()?.length && $startElem.remove()
        }
    }
}
