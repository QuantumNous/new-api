import { ContainerFragment } from '.'
import { DomElement } from '../../../utils/dom-core'
import { Exec, HandlerListOptions, ListHandle } from './ListHandle'
import { filterSelectionNodes, createElement, createElementFragment } from '../utils'

export default class OtherListHandle extends ListHandle implements Exec {
    public range: Range

    constructor(options: HandlerListOptions, range: Range) {
        super(options)
        this.range = range
    }

    exec(): void {
        const { editor, listTarget } = this.options

        // 获取选中的段落
        const $nodes: DomElement[] = editor.selection.getSelectionRangeTopNodes()

        // 生成 li 元素并且添加到序列节点后删除原节点
        const $containerFragment: ContainerFragment = createElementFragment(
            filterSelectionNodes($nodes), // 过滤选取的元素
            createElement(listTarget) // 创建 序列节点
        )

        // 插入节点到选区
        this.selectionRangeElem.set($containerFragment)
        this.range.insertNode($containerFragment)
    }
}
