/**
 * @description 无序列表/有序列表
 * @author tonghan
 */
import { DomElement } from '../../utils/dom-core';
import Editor from '../../editor/index';
import DropListMenu from '../menu-constructors/DropListMenu';
import { MenuActive } from '../menu-constructors/Menu';
/**
 * 列表的种类
 */
export declare enum ListType {
    OrderedList = "OL",
    UnorderedList = "UL"
}
declare type ListTypeValue = ListType;
declare class List extends DropListMenu implements MenuActive {
    constructor(editor: Editor);
    command(type: ListTypeValue): void;
    validator($startElem: DomElement, $endElem: DomElement, $textElem: DomElement): boolean;
    private handleSelectionRangeNodes;
    /**
     * 是否是序列元素节点 UL and OL
     * @param $node
     */
    private isOrderElem;
    tryChangeActive(): void;
}
export default List;
