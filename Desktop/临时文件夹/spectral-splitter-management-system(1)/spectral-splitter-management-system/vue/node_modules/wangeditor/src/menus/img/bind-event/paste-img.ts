/**
 * @description 粘贴图片
 * @author wangfupeng
 */

import Editor from '../../../editor/index'
import { getPasteText, getPasteHtml, getPasteImgs } from '../../../text/paste/paste-event'
import UploadImg from '../upload-img'

/**
 * 剪切板是否有 text 或者 html ？
 * @param editor 编辑器对象
 * @param e 粘贴事件参数
 */
function _haveTextOrHtml(editor: Editor, e: ClipboardEvent): boolean {
    const config = editor.config
    const pasteFilterStyle = config.pasteFilterStyle
    const pasteIgnoreImg = config.pasteIgnoreImg
    let pasteHtml = getPasteHtml(e, pasteFilterStyle, pasteIgnoreImg)
    if (pasteHtml) return true
    let pasteText = getPasteText(e)
    if (pasteText) return true

    return false // text html 都没有，则返回 false
}

/**
 * 剪切板是否有 Files
 * @param editor 编辑器对象
 * @param e 粘贴事件参数
 */
function _haveFiles(editor: Editor, e: ClipboardEvent): boolean {
    const types = e.clipboardData?.types || []

    for (let i = 0; i < types.length; i++) {
        const type = types[i]
        if (type === 'Files') {
            return true
        }
    }

    return false
}
/**
 * 粘贴图片事件方法
 * @param e 事件参数
 */
function pasteImgHandler(e: ClipboardEvent, editor: Editor): void {
    // 粘贴过来的没有 file 时，判断 text 或者 html
    if (!_haveFiles(editor, e)) {
        if (_haveTextOrHtml(editor, e)) {
            // 粘贴过来的有 text 或者 html ，则不执行粘贴图片逻辑
            return
        }
    }

    // 获取粘贴的图片列表
    const pastedFiles = getPasteImgs(e)
    if (!pastedFiles.length) {
        return
    }

    // code 中忽略（暂不管它）

    // 执行上传
    const uploadImg = new UploadImg(editor)
    uploadImg.uploadImg(pastedFiles)
}

/**
 * 粘贴图片
 * @param editor 编辑器对象
 * @param pasteEvents 粘贴事件列表
 */
function bindPasteImg(editor: Editor): void {
    /**
     * 绑定 paste 事件
     * 这里使用了unshift，以前是push
     * 在以前的流程中，pasteImgHandler触发之前，会调用到window.getSelection().removeAllRanges()
     * 会导致性能变差。在编辑器中粘贴，粘贴耗时多了100+ms，根本原因未知
     * 最小复现demo，在div内粘贴图片就可以看到getData耗时异常得长
     * <html>
     *     <div id="a" contenteditable="true"></div>
     *     <script>
     *         const div = document.getElementById('a')
     *         div.addEventListener('paste', (e) => {
     *             window.getSelection().removeAllRanges()
     *             e.clipboardData.getData('text/html')
     *         })
     *     </script>
     * </html>
     * 因此改成unshift，先触发pasteImgHandler就不会有性能问题
     */
    editor.txt.eventHooks.pasteEvents.unshift((e: ClipboardEvent) => {
        pasteImgHandler(e, editor)
    })
}

export default bindPasteImg
