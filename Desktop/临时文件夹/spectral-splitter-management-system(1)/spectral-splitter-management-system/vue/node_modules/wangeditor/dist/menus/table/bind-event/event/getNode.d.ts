/**
 * @description 获取dom节点
 * @author lichunlin
 */
import Editor from '../../../../editor/index';
declare class getNode {
    editor: Editor;
    constructor(editor: Editor);
    /**
     * 获取焦点所在行
     * @param $node 当前table
     */
    getRowNode($node: HTMLElement): HTMLElement | null | undefined;
    /**
     * 获取当前行的下标
     * @param $node 当前table
     * @param $dmo 当前行节点
     */
    getCurrentRowIndex($node: HTMLElement, $dom: HTMLElement): Number;
    /**
     * 获取当前列的下标
     * @param $node 当前点击元素
     */
    getCurrentColIndex($node: HTMLElement): number;
    /**
     * 返回元素html字符串
     * @param $node
     */
    getTableHtml($node: HTMLElement): string;
}
export default getNode;
