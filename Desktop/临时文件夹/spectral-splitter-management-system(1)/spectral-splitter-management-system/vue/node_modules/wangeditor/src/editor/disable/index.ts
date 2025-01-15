/**
 * @description disable 内容编辑
 * @author lichunlin
 */
import Editor from '../index'
import $, { DomElement } from '../../utils/dom-core'
import '../../assets/style/disable.less'

export default function disableInit(editor: Editor) {
    let isCurtain: Boolean = false // 避免重复生成幕布
    let $contentDom: DomElement
    let $menuDom: DomElement

    // 禁用期间，通过 js 修改内容后，刷新内容
    editor.txt.eventHooks.changeEvents.push(function () {
        if (isCurtain) {
            $contentDom.find('.w-e-content-preview').html(editor.$textElem.html())
        }
    })

    // 创建幕布
    function disable() {
        if (isCurtain) return
        // 隐藏编辑区域
        editor.$textElem.hide()
        // 生成div 渲染编辑内容
        let textContainerZindexValue = editor.zIndex.get('textContainer')
        const content = editor.txt.html()
        $contentDom = $(
            `<div class="w-e-content-mantle" style="z-index:${textContainerZindexValue}">
                <div class="w-e-content-preview w-e-text">${content}</div>
            </div>`
        )
        editor.$textContainerElem.append($contentDom)
        // 生成div 菜单膜布
        let menuZindexValue = editor.zIndex.get('menu')
        $menuDom = $(`<div class="w-e-menue-mantle" style="z-index:${menuZindexValue}"></div>`)
        editor.$toolbarElem.append($menuDom)
        isCurtain = true
        editor.isEnable = false
    }

    // 销毁幕布并显示可编辑区域
    function enable() {
        if (!isCurtain) return
        $contentDom.remove()
        $menuDom.remove()
        editor.$textElem.show()
        isCurtain = false
        editor.isEnable = true
    }

    return { disable, enable }
}
