/**
 * @description 定义数据类型
 * @author fangzhicong
 */
/**
 * 差异备份：节点相对位置信息
 */
export interface TargetPosition {
    type: 'before' | 'after' | 'parent';
    target: Node;
}
/**
 * 差异备份：Node 节点
 */
export interface DiffNodes {
    add?: Node[];
    remove?: Node[];
}
/**
 * 差异备份：处理后的 MutationRecord 对象
 */
export interface Compile {
    type: 'node' | 'text' | 'attr';
    target: Element | Node;
    attr: string;
    value: string;
    oldValue: string;
    nodes: DiffNodes;
    position: TargetPosition;
}
/**
 * Range 缓存
 */
export interface RangeItem {
    start: [Node, number];
    end: [Node, number];
    root: Node;
    collapsed: boolean;
}
/**
 * scroll 数据。[last-scrollTop, current-scrollTop]
 */
export declare type ScrollItem = [number, number];
