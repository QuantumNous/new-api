/**
 * @description 创建tabel
 * @author lichunlin
 */
import Editor from '../../editor/index';
declare class CreateTable {
    private editor;
    constructor(editor: Editor);
    /**
     * 执行创建
     * @param rowValue 行数
     * @param colValue 列数
     */
    createAction(rowValue: number, colValue: number): void;
    /**
     * 创建table、行、列
     * @param rowValue 行数
     * @param colValue 列数
     */
    createTableHtml(rowValue: number, colValue: number): string;
}
export default CreateTable;
