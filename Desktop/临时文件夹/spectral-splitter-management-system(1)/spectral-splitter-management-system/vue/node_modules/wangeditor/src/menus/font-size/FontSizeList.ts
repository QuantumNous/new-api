/**
 * @description 字号 class
 * @author lkw
 */
import $ from '../../utils/dom-core'
import { DropListItem } from '../menu-constructors/DropList'
import { FontSizeConfType } from '../../config/menus'

/**
 * FontSizeList 字号配置列表
 */
class FontSizeList {
    private itemList: DropListItem[]

    constructor(list: FontSizeConfType) {
        this.itemList = []
        for (let key in list) {
            const item = list[key]
            this.itemList.push({
                $elem: $(`<p style="font-size:${key}">${item.name}</p>`),
                value: item.value,
            })
        }
    }

    public getItemList(): DropListItem[] {
        return this.itemList
    }
}

export default FontSizeList
