/**
 * @description 绑定编辑器事件 change blur focus
 * @author wangfupeng
 */

import Editor from '../index'
import $ from '../../utils/dom-core'

function bindEvent(editor: Editor): void {
    // 绑定 change 事件
    _bindChange(editor)

    // 绑定 focus blur 事件
    _bindFocusAndBlur(editor)

    // 绑定 input 输入
    _bindInput(editor)
}

/**
 * 绑定 change 事件
 * @param editor 编辑器实例
 */
function _bindChange(editor: Editor): void {
    editor.txt.eventHooks.changeEvents.push(function () {
        const { onchange } = editor.config
        if (onchange) {
            const html = editor.txt.html() || ''
            // onchange触发时，是focus状态，详见https://github.com/wangeditor-team/wangEditor/issues/3034
            editor.isFocus = true
            onchange(html)
        }

        editor.txt.togglePlaceholder()
    })
}

/**
 * 绑定 focus blur 事件
 * @param editor 编辑器实例
 */
function _bindFocusAndBlur(editor: Editor): void {
    // 当前编辑器是否是焦点状态
    editor.isFocus = false

    function listener(e: Event) {
        const target = e.target
        const $target = $(target)
        const $textElem = editor.$textElem
        const $toolbarElem = editor.$toolbarElem

        //判断当前点击元素是否在编辑器内
        const isChild = $textElem.isContain($target)

        //判断当前点击元素是否为工具栏
        const isToolbar = $toolbarElem.isContain($target)
        const isMenu = $toolbarElem.elems[0] == e.target ? true : false

        if (!isChild) {
            // 若为选择工具栏中的功能，则不视为成 blur 操作
            if ((isToolbar && !isMenu) || !editor.isFocus) {
                return
            }
            _blurHandler(editor)
            editor.isFocus = false
        } else {
            if (!editor.isFocus) {
                _focusHandler(editor)
            }

            editor.isFocus = true
        }
    }
    // fix: 增加判断条件，防止当用户设置isFocus=false时，初始化完成后点击其他元素依旧会触发blur事件的问题
    if (document.activeElement === editor.$textElem.elems[0] && editor.config.focus) {
        _focusHandler(editor)
        editor.isFocus = true
    }
    // 绑定监听事件
    $(document).on('click', listener)
    // 全局事件在编辑器实例销毁的时候进行解绑
    editor.beforeDestroy(function () {
        $(document).off('click', listener)
    })
}

/**
 * 绑定 input 事件
 * @param editor 编辑器实例
 */
function _bindInput(editor: Editor) {
    // 绑定中文输入
    editor.$textElem
        .on('compositionstart', () => {
            editor.isComposing = true
            editor.txt.togglePlaceholder()
        })
        .on('compositionend', () => {
            editor.isComposing = false
            editor.txt.togglePlaceholder()
        })
}

/**
 * blur 事件
 * @param editor 编辑器实例
 */
function _blurHandler(editor: Editor) {
    const config = editor.config
    const onblur = config.onblur
    const currentHtml = editor.txt.html() || ''
    editor.txt.eventHooks.onBlurEvents.forEach(fn => fn())
    onblur(currentHtml)
}

/**
 * focus 事件
 * @param editor 编辑器实例
 */
function _focusHandler(editor: Editor) {
    const config = editor.config
    const onfocus = config.onfocus
    const currentHtml = editor.txt.html() || ''
    onfocus(currentHtml)
}

export default bindEvent
