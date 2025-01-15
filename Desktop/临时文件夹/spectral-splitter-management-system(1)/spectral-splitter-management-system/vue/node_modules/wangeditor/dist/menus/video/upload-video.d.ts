/**
 * @description 上传视频
 * @author lichunlin
 */
import Editor from '../../editor/index';
declare type ResData = {
    url: string;
};
export declare type ResType = {
    errno: number | string;
    data: ResData;
};
declare class UploadVideo {
    private editor;
    constructor(editor: Editor);
    /**
     * 上传视频
     * @param files 文件列表
     */
    uploadVideo(files: FileList | File[]): void;
    /**
     * 往编辑器区域插入视频
     * @param url 视频访问地址
     */
    insertVideo(url: string): void;
}
export default UploadVideo;
