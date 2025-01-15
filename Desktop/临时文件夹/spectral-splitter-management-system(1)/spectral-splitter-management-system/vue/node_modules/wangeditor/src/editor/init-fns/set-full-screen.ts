/**
 * @description 全屏功能
 * @author xiaokyo
 */

import Editor from '../index'
import $ from '../../utils/dom-core'

import '../../assets/style/full-screen.less'

const iconFullScreenText = 'w-e-icon-fullscreen' // 全屏icon class
const iconExitFullScreenText = 'w-e-icon-fullscreen_exit' // 退出全屏icon class
const classfullScreenEditor = 'w-e-full-screen-editor' // 全屏添加至编辑器的class

/**
 * 设置全屏
 * @param editor 编辑器实例
 */
export const setFullScreen = (editor: Editor) => {
    const $editorParent = $(editor.toolbarSelector)
    const $textContainerElem = editor.$textContainerElem
    const $toolbarElem = editor.$toolbarElem
    const $iconElem = $toolbarElem.find(`i.${iconFullScreenText}`)
    const config = editor.config

    $iconElem.removeClass(iconFullScreenText)
    $iconElem.addClass(iconExitFullScreenText)
    $editorParent.addClass(classfullScreenEditor)
    $editorParent.css('z-index', config.zIndexFullScreen)
    const bar = $toolbarElem.getBoundingClientRect()
    $textContainerElem.css('height', `calc(100% - ${bar.height}px)`)
}

/**
 * 取消全屏
 * @param editor 编辑器实例
 */
export const setUnFullScreen = (editor: Editor) => {
    const $editorParent = $(editor.toolbarSelector)
    const $textContainerElem = editor.$textContainerElem
    const $toolbarElem = editor.$toolbarElem
    const $iconElem = $toolbarElem.find(`i.${iconExitFullScreenText}`)
    const config = editor.config

    $iconElem.removeClass(iconExitFullScreenText)
    $iconElem.addClass(iconFullScreenText)
    $editorParent.removeClass(classfullScreenEditor)
    $editorParent.css('z-index', 'auto')
    $textContainerElem.css('height', config.height + 'px')
}

/**
 * 初始化全屏功能
 * @param editor 编辑器实例
 */
const initFullScreen = (editor: Editor) => {
    // 当textSelector有值的时候，也就是编辑器是工具栏和编辑区域分离的情况， 则不生成全屏功能按钮
    if (editor.textSelector) return
    if (!editor.config.showFullScreen) return
    const $toolbarElem = editor.$toolbarElem
    const $elem = $(
        `<div class="w-e-menu" data-title="全屏">
            <i class="${iconFullScreenText}"></i>
        </div>`
    )
    $elem.on('click', function (e: MouseEvent) {
        const $elemIcon = $(e.currentTarget).find('i')
        if ($elemIcon.hasClass(iconFullScreenText)) {
            $elem.attr('data-title', '取消全屏')
            setFullScreen(editor)
        } else {
            $elem.attr('data-title', '全屏')
            setUnFullScreen(editor)
        }
    })

    $toolbarElem.append($elem)
}

export default initFullScreen
