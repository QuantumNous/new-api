import { DomElement } from '../../utils/dom-core';
import Editor from '../../editor';
/**
 * 判断传入的单行顶级选区选取是不是todo
 * @param editor 编辑器对象
 */
declare function isTodo($topSelectElem: DomElement): boolean;
/**
 * 判断选中的内容是不是都是todo
 * @param editor 编辑器对象
 */
declare function isAllTodo(editor: Editor): boolean | undefined;
/**
 * 根据所在的文本节点和光标在文本节点的位置获取截断的后节点内容
 * @param node 顶级节点
 * @param textNode 光标所在的文本节点
 * @param pos 光标在文本节点的位置
 */
declare function getCursorNextNode(node: Node, textNode: Node, pos: number): Node | undefined;
/**
 * 获取新的文本节点
 * @param node 要处理的文本节点
 * @param pos  光标在文本节点所在的位置
 * @param start 设置为true时保留开始位置到光标的内容，设置为false时删去开始的内容
 */
declare function dealTextNode(node: Node, pos: number, start?: boolean): string;
export { getCursorNextNode, isTodo, isAllTodo, dealTextNode };
