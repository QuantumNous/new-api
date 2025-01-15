/**
 * @description 行高 菜单
 * @author lichunlin
 */
import $ from '../../utils/dom-core'
import Editor from '../../editor/index'
import { DropListItem } from '../menu-constructors/DropList'

class lineHeightList {
    private itemList: DropListItem[]

    constructor(editor: Editor, list: string[]) {
        this.itemList = [{ $elem: $(`<span>${editor.i18next.t('默认')}</span>`), value: '' }]
        list.forEach(item => {
            this.itemList.push({
                $elem: $(`<span>${item}</span>`),
                value: item,
            })
        })
    }

    public getItemList(): DropListItem[] {
        return this.itemList
    }
}

export default lineHeightList
