type SelectionRangeType = HTMLElement | ChildNode[]
type SetSelectionRangeType = SelectionRangeType | DocumentFragment
export type SelectionRangeElemType = SelectionRangeType | null

/**
 * @description 选区的 Element
 * @author tonghan
 */
class SelectionRangeElem {
    private _element: SelectionRangeElemType

    constructor() {
        this._element = null
    }

    /**
     * 设置 SelectionRangeElem 的值
     * @param { SetSelectionRangeType } data
     */
    public set(data: SetSelectionRangeType) {
        //
        if (data instanceof DocumentFragment) {
            const childNode: ChildNode[] = []
            data.childNodes.forEach(($node: ChildNode) => {
                childNode.push($node)
            })
            data = childNode
        }
        this._element = data
    }

    /**
     * 获取 SelectionRangeElem 的值
     * @returns { SelectionRangeType } Elem
     */
    public get(): SelectionRangeElemType {
        return this._element
    }

    /**
     * 清除 SelectionRangeElem 的值
     */
    public clear() {
        this._element = null
    }
}

export default SelectionRangeElem
