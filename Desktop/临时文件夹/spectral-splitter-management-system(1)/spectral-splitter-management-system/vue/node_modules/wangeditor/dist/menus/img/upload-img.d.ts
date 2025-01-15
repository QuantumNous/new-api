/**
 * @description 上传图片
 * @author wangfupeng
 */
import Editor from '../../editor/index';
declare type ResImgItemType = string | {
    url: string;
    alt?: string;
    href?: string;
};
export declare type ResType = {
    errno: number | string;
    data: ResImgItemType[];
};
declare class UploadImg {
    private editor;
    constructor(editor: Editor);
    /**
     * 往编辑区域插入图片
     * @param src 图片地址
     */
    insertImg(src: string, alt?: string, href?: string): void;
    /**
     * 上传图片
     * @param files 文件列表
     */
    uploadImg(files: FileList | File[]): void;
}
export default UploadImg;
