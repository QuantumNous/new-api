import { DomElement } from '../../../../utils/dom-core';
/**
 * 处理新添加行
 * @param $node 整个table
 * @param _index 行的inde
 */
declare function ProcessingRow($node: DomElement, _index: number): DomElement;
/**
 * 处理新添加列
 * @param $node 整个table
 * @param _index 列的inde
 */
declare function ProcessingCol($node: DomElement, _index: number): DomElement;
/**
 * 处理删除行
 * @param $node  整个table
 * @param _index  行的inde
 */
declare function DeleteRow($node: DomElement, _index: number): DomElement;
/**
 * 处理删除列
 * @param $node
 * @param _index
 */
declare function DeleteCol($node: DomElement, _index: number): DomElement;
/**
 * 处理设置/取消表头
 * @param $node
 * @param _index
 * @type 替换的标签 th还是td
 */
declare function setTheHeader($node: DomElement, _index: number, type: string): DomElement;
declare const _default: {
    ProcessingRow: typeof ProcessingRow;
    ProcessingCol: typeof ProcessingCol;
    DeleteRow: typeof DeleteRow;
    DeleteCol: typeof DeleteCol;
    setTheHeader: typeof setTheHeader;
};
export default _default;
