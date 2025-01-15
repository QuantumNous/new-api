/**
 * @description 定义数据类型
 * @author fangzhicong
 */

/**
 * 差异备份：节点相对位置信息
 */
export interface TargetPosition {
    type: 'before' | 'after' | 'parent' // 分别对应 MutationRecord.previousSibling、MutationRecord.nextSibling
    target: Node
}

/**
 * 差异备份：Node 节点
 */
export interface DiffNodes {
    add?: Node[] // MutationRecord.addedNodes
    remove?: Node[] // MutationRecord.removedNodes
}

/**
 * 差异备份：处理后的 MutationRecord 对象
 */
export interface Compile {
    type: 'node' | 'text' | 'attr' // MutationRecord.type
    target: Element | Node // MutationRecord.target
    attr: string // MutationRecord.attributeName
    value: string
    oldValue: string
    nodes: DiffNodes
    position: TargetPosition
}

/**
 * Range 缓存
 */
export interface RangeItem {
    start: [Node, number] // [range.startContainer, range.startOffset]
    end: [Node, number] // [range.endContainer, range.endOffset]
    root: Node // range.commonAncestorContainer
    collapsed: boolean // range.collapsed
}

/**
 * scroll 数据。[last-scrollTop, current-scrollTop]
 */
export type ScrollItem = [number, number]
