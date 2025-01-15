declare type SelectionRangeType = HTMLElement | ChildNode[];
declare type SetSelectionRangeType = SelectionRangeType | DocumentFragment;
export declare type SelectionRangeElemType = SelectionRangeType | null;
/**
 * @description 选区的 Element
 * @author tonghan
 */
declare class SelectionRangeElem {
    private _element;
    constructor();
    /**
     * 设置 SelectionRangeElem 的值
     * @param { SetSelectionRangeType } data
     */
    set(data: SetSelectionRangeType): void;
    /**
     * 获取 SelectionRangeElem 的值
     * @returns { SelectionRangeType } Elem
     */
    get(): SelectionRangeElemType;
    /**
     * 清除 SelectionRangeElem 的值
     */
    clear(): void;
}
export default SelectionRangeElem;
