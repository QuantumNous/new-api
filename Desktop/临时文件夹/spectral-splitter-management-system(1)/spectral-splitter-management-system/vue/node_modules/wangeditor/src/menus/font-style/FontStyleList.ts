/**
 * @description 字体 class
 * @author dyl
 */
import $ from '../../utils/dom-core'
import { FontStyleType } from '../../config/menus'
import { DropListItem } from '../menu-constructors/DropList'

/**
 * 封装的一个字体菜单列表数据的组装对象,
 * 原因是因为在constructor函数中,直接执行此流程,会让代码量看起来较多,
 * 如果要在constructor调用外部函数,个人目前发现会有错误提示,
 * 因此,想着顺便研究实践下ts,遍创建了这样一个类
 */
class FontStyleList {
    private itemList: DropListItem[]
    constructor(list: FontStyleType) {
        this.itemList = []
        list.forEach(fontValue => {
            // fontValue 2种情况一种是string类型的直接value等同于font-family
            // Object类型value为font-family name为ui视图呈现
            const fontFamily = typeof fontValue === 'string' ? fontValue : fontValue.value
            const fontName = typeof fontValue === 'string' ? fontValue : fontValue.name
            this.itemList.push({
                $elem: $(`<p style="font-family:'${fontFamily}'">${fontName}</p>`),
                value: fontName,
            })
        })
    }

    public getItemList(): DropListItem[] {
        return this.itemList
    }
}

export default FontStyleList
