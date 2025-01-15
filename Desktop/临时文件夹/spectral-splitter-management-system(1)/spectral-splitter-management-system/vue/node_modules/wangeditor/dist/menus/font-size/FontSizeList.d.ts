import { DropListItem } from '../menu-constructors/DropList';
import { FontSizeConfType } from '../../config/menus';
/**
 * FontSizeList 字号配置列表
 */
declare class FontSizeList {
    private itemList;
    constructor(list: FontSizeConfType);
    getItemList(): DropListItem[];
}
export default FontSizeList;
