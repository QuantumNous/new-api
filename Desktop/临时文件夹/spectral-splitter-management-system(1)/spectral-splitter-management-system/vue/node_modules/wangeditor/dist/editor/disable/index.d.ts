/**
 * @description disable 内容编辑
 * @author lichunlin
 */
import Editor from '../index';
import '../../assets/style/disable.less';
export default function disableInit(editor: Editor): {
    disable: () => void;
    enable: () => void;
};
