/**
 * @description 初始化编辑器 DOM 结构
 * @author wangfupeng
 */

import Editor from '../index'
import $, { DomElement } from '../../utils/dom-core'
import { getRandom } from '../../utils/util'
import { EMPTY_P } from '../../utils/const'
import CONFIG from '../../config/text'
const styleSettings = {
    border: '1px solid #c9d8db',
    toolbarBgColor: '#FFF',
    toolbarBottomBorder: '1px solid #EEE',
}

export default function (editor: Editor): void {
    const toolbarSelector = editor.toolbarSelector
    const $toolbarSelector = $(toolbarSelector)
    const textSelector = editor.textSelector

    const config = editor.config
    const height = config.height
    const i18next = editor.i18next

    const $toolbarElem: DomElement = $('<div></div>')
    const $textContainerElem: DomElement = $('<div></div>')
    let $textElem: DomElement
    let $children: DomElement | null
    let $subChildren: DomElement | null = null

    if (textSelector == null) {
        // 将编辑器区域原有的内容，暂存起来
        $children = $toolbarSelector.children()

        // 添加到 DOM 结构中
        $toolbarSelector.append($toolbarElem).append($textContainerElem)

        // 自行创建的，需要配置默认的样式
        $toolbarElem
            .css('background-color', styleSettings.toolbarBgColor)
            .css('border', styleSettings.border)
            .css('border-bottom', styleSettings.toolbarBottomBorder)
        $textContainerElem
            .css('border', styleSettings.border)
            .css('border-top', 'none')
            .css('height', `${height}px`)
    } else {
        // toolbarSelector 和 textSelector 都有
        $toolbarSelector.append($toolbarElem)
        // 菜单分离后，文本区域内容暂存
        $subChildren = $(textSelector).children()
        $(textSelector).append($textContainerElem)
        // 将编辑器区域原有的内容，暂存起来
        $children = $textContainerElem.children()
    }

    // 编辑区域
    $textElem = $('<div></div>')
    $textElem.attr('contenteditable', 'true').css('width', '100%').css('height', '100%')

    // 添加 placeholder
    let $placeholder: DomElement
    const placeholder = editor.config.placeholder
    if (placeholder !== CONFIG.placeholder) {
        $placeholder = $(`<div>${placeholder}</div>`)
    } else {
        $placeholder = $(`<div>${i18next.t(placeholder)}</div>`)
    }
    $placeholder.addClass('placeholder')

    // 初始化编辑区域内容
    if ($children && $children.length) {
        $textElem.append($children)
        // 编辑器有默认值的时候隐藏placeholder
        $placeholder.hide()
    } else {
        $textElem.append($(EMPTY_P)) // 新增一行，方便继续编辑
    }

    // 菜单分离后，文本区域有标签的带入编辑器内
    if ($subChildren && $subChildren.length) {
        $textElem.append($subChildren)
        // 编辑器有默认值的时候隐藏placeholder
        $placeholder.hide()
    }

    // 编辑区域加入DOM
    $textContainerElem.append($textElem)

    // 添加placeholder
    $textContainerElem.append($placeholder)

    // 设置通用的 class
    $toolbarElem.addClass('w-e-toolbar').css('z-index', editor.zIndex.get('toolbar'))
    $textContainerElem.addClass('w-e-text-container')
    $textContainerElem.css('z-index', editor.zIndex.get())
    $textElem.addClass('w-e-text')

    // 添加 ID
    const toolbarElemId = getRandom('toolbar-elem')
    $toolbarElem.attr('id', toolbarElemId)
    const textElemId = getRandom('text-elem')
    $textElem.attr('id', textElemId)

    // 判断编辑区与容器高度是否一致
    const textContainerCliheight = $textContainerElem.getBoundingClientRect().height
    const textElemClientHeight = $textElem.getBoundingClientRect().height
    if (textContainerCliheight !== textElemClientHeight) {
        $textElem.css('min-height', textContainerCliheight + 'px')
    }

    // 记录属性
    editor.$toolbarElem = $toolbarElem
    editor.$textContainerElem = $textContainerElem
    editor.$textElem = $textElem
    editor.toolbarElemId = toolbarElemId
    editor.textElemId = textElemId
}

/**
 * 工具栏/文本区域 DOM selector 有效性验证
 * @param editor 编辑器实例
 */
export function selectorValidator(editor: Editor) {
    const name = 'data-we-id'
    const regexp = /^wangEditor-\d+$/
    const { textSelector, toolbarSelector } = editor

    const $el = {
        bar: $('<div></div>'),
        text: $('<div></div>'),
    }

    if (toolbarSelector == null) {
        throw new Error('错误：初始化编辑器时候未传入任何参数，请查阅文档')
    } else {
        $el.bar = $(toolbarSelector)
        if (!$el.bar.elems.length) {
            throw new Error(`无效的节点选择器：${toolbarSelector}`)
        }
        if (regexp.test($el.bar.attr(name))) {
            throw new Error('初始化节点已存在编辑器实例，无法重复创建编辑器')
        }
    }
    if (textSelector) {
        $el.text = $(textSelector)
        if (!$el.text.elems.length) {
            throw new Error(`无效的节点选择器：${textSelector}`)
        }
        if (regexp.test($el.text.attr(name))) {
            throw new Error('初始化节点已存在编辑器实例，无法重复创建编辑器')
        }
    }

    // 给节点做上标记
    $el.bar.attr(name, editor.id)
    $el.text.attr(name, editor.id)

    // 在编辑器销毁前取消标记
    editor.beforeDestroy(function () {
        $el.bar.removeAttr(name)
        $el.text.removeAttr(name)
    })
}
