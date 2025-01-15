/**
 * @description 回车时，保证生成的是 <p> 标签
 * @author wangfupeng
 */

import Editor from '../../editor/index'
import { EMPTY_P } from '../../utils/const'
import $, { DomElement } from '../../utils/dom-core'

/**
 * 回车时，保证生成的是 <p> 标签
 * @param editor 编辑器实例
 * @param enterUpEvents enter 键 up 时的 hooks
 * @param enterDownEvents enter 键 down 时的 hooks
 */
function enterToCreateP(editor: Editor, enterUpEvents: Function[], enterDownEvents: Function[]) {
    function insertEmptyP($selectionElem: DomElement) {
        const $p = $(EMPTY_P)
        $p.insertBefore($selectionElem)
        if ($selectionElem.html().indexOf('<img') >= 0) {
            // 有图片的回车键弹起时
            $p.remove()
            return
        }

        editor.selection.createRangeByElem($p, true, true)
        editor.selection.restoreSelection()
        $selectionElem.remove()
    }

    // enter up 时
    function fn() {
        const $textElem = editor.$textElem
        const $selectionElem = editor.selection.getSelectionContainerElem() as DomElement
        const $parentElem = $selectionElem.parent()

        if ($parentElem.html() === '<code><br></code>') {
            // 回车之前光标所在一个 <p><code>.....</code></p> ，忽然回车生成一个空的 <p><code><br></code></p>
            // 而且继续回车跳不出去，因此只能特殊处理
            insertEmptyP($parentElem)
            return
        }

        if (
            $selectionElem.getNodeName() === 'FONT' &&
            $selectionElem.text() === '' &&
            $selectionElem.attr('face') === 'monospace'
        ) {
            // 行内code回车时会产生一个<font face="monospace"><br></font>，导致样式问题
            insertEmptyP($parentElem)
            return
        }

        if (!$parentElem.equal($textElem)) {
            // 不是顶级标签
            return
        }

        const nodeName = $selectionElem.getNodeName()
        if (nodeName === 'P' && $selectionElem.attr('data-we-empty-p') === null) {
            // 当前的标签是 P 且不为 editor 生成的空白占位 p 标签，不用做处理
            return
        }

        if ($selectionElem.text()) {
            // 有内容，不做处理
            return
        }

        // 插入 <p> ，并将选取定位到 <p>，删除当前标签
        insertEmptyP($selectionElem)
    }
    enterUpEvents.push(fn)

    // enter down 时
    function createPWhenEnterText(e: Event) {
        // selection中的range缓存还有问题,更新不及时,此处手动更新range,处理enter的bug
        editor.selection.saveRange(getSelection()?.getRangeAt(0))
        const $selectElem = editor.selection.getSelectionContainerElem() as DomElement
        if ($selectElem.id === editor.textElemId) {
            // 回车时，默认创建了 text 标签（没有 p 标签包裹），父元素直接就是 $textElem
            // 例如，光标放在 table 最后侧，回车时，默认就是这个情况
            e.preventDefault()
            editor.cmd.do('insertHTML', '<p><br></p>')
        }
    }
    enterDownEvents.push(createPWhenEnterText)
}

export default enterToCreateP
