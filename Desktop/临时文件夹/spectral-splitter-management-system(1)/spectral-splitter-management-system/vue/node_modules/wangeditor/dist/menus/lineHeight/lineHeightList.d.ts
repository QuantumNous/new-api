import Editor from '../../editor/index';
import { DropListItem } from '../menu-constructors/DropList';
declare class lineHeightList {
    private itemList;
    constructor(editor: Editor, list: string[]);
    getItemList(): DropListItem[];
}
export default lineHeightList;
