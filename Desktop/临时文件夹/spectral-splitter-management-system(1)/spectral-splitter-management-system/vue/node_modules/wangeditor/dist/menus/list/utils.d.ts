import Editor from '../../editor/index';
import { DomElement } from '../../utils/dom-core';
import { ContainerFragment } from './ListHandle';
/**
 * 过滤 选择的 node 节点
 * @returns { DomElement[] } DomElement[]
 */
export declare function filterSelectionNodes($nodes: DomElement[]): DomElement[];
/**
 * 更新选区
 * @param $node
 */
export declare function updateRange(editor: Editor, $node: DomElement, collapsed: boolean): void;
/**
 * 获取起点元素
 * @param $startElem 开始序列节点
 */
export declare function getStartPoint($startElem: DomElement): DomElement;
/**
 * 获取结束元素
 * @param $endElem 结束序列节点
 */
export declare function getEndPoint($endElem: DomElement): DomElement;
/**
 * 在您指定节点的已有子节点之前插入新的子节点。
 * @param { DomElement } $node 指定节点
 * @param { ContainerFragment } newNode 插入的新子节点
 * @param { Node | null } existingNode 指定子节点
 */
export declare function insertBefore($node: DomElement, newNode: ContainerFragment, existingNode?: Node | null): void;
/**
 * 创建指定的 element 对象
 */
export declare function createElement(target: string): HTMLElement;
/**
 * 创建文档片段
 */
export declare function createDocumentFragment(): DocumentFragment;
/**
 * 生成 li 标签的元素，并返回 $fragment 文档片段
 * @param { DomElement[] } $nodes 需要转换成 li 的 dom 元素数组
 * @param { ContainerFragment } $fragment 用于存储生成后 li 元素的文档片段
 */
export declare function createElementFragment($nodes: DomElement[], $fragment: ContainerFragment, tag?: string): ContainerFragment;
