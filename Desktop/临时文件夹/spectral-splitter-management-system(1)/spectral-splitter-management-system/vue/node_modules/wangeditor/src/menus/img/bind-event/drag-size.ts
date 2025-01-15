/**
 * @description 图片拖拽事件绑定
 * @author xiaokyo
 */

import Editor from '../../../editor'
import $, { DomElement } from '../../../utils/dom-core'
import '../../../assets/style/drag-size.less'
import { UA } from '../../../utils/util'

/**
 * 设置拖拽框的rect
 * @param $drag drag Dom
 * @param width 要设置的宽度
 * @param height 要设置的高度
 * @param left 要设置的左边
 * @param top 要设置的顶部距离
 */
function setDragStyle($drag: DomElement, width: number, height: number, left: number, top: number) {
    $drag.attr('style', `width:${width}px; height:${height}px; left:${left}px; top:${top}px;`)
}

/**
 * 生成一个图片指定大小的拖拽框
 * @param editor 编辑器实例
 * @param $textContainerElem 编辑框对象
 */
function createDragBox(editor: Editor, $textContainerElem: DomElement): DomElement {
    const $drag = $(
        `<div class="w-e-img-drag-mask">
            <div class="w-e-img-drag-show-size"></div>
            <div class="w-e-img-drag-rb"></div>
         </div>`
    )

    $drag.hide()
    $textContainerElem.append($drag)
    return $drag
}

/**
 * 显示拖拽框并设置宽度
 * @param $textContainerElem 编辑框实例
 * @param $drag 拖拽框对象
 */
function showDargBox($textContainerElem: DomElement, $drag: DomElement, $img: DomElement) {
    const boxRect = $textContainerElem.getBoundingClientRect()
    const rect = $img.getBoundingClientRect()
    const rectW = rect.width.toFixed(2)
    const rectH = rect.height.toFixed(2)
    $drag.find('.w-e-img-drag-show-size').text(`${rectW}px * ${rectH}px`)
    setDragStyle(
        $drag,
        parseFloat(rectW),
        parseFloat(rectH),
        rect.left - boxRect.left,
        rect.top - boxRect.top
    )
    $drag.show()
}

/**
 * 生成图片拖拽框的 显示/隐藏 函数
 */
export function createShowHideFn(editor: Editor) {
    const $textContainerElem = editor.$textContainerElem
    let $imgTarget: DomElement

    // 生成拖拽框
    const $drag = createDragBox(editor, $textContainerElem)

    /**
     * 设置拖拽事件
     * @param $drag 拖拽框的domElement
     * @param $textContainerElem 编辑器实例
     */
    function bindDragEvents($drag: DomElement, $container: DomElement) {
        $drag.on('click', function (e: Event) {
            e.stopPropagation()
        })
        $drag.on('mousedown', '.w-e-img-drag-rb', (e: MouseEvent) => {
            // e.stopPropagation()
            e.preventDefault()

            if (!$imgTarget) return

            const firstX = e.clientX
            const firstY = e.clientY
            const boxRect = $container.getBoundingClientRect()
            const imgRect = $imgTarget.getBoundingClientRect()
            const width = imgRect.width
            const height = imgRect.height
            const left = imgRect.left - boxRect.left
            const top = imgRect.top - boxRect.top
            const ratio = width / height

            let setW = width
            let setH = height
            const $document = $(document)

            function offEvents() {
                $document.off('mousemove', mouseMoveHandler)
                $document.off('mouseup', mouseUpHandler)
            }

            function mouseMoveHandler(ev: MouseEvent) {
                ev.stopPropagation()
                ev.preventDefault()

                setW = width + (ev.clientX - firstX)
                setH = height + (ev.clientY - firstY)

                // 等比计算
                if (setW / setH != ratio) {
                    setH = setW / ratio
                }

                setW = parseFloat(setW.toFixed(2))
                setH = parseFloat(setH.toFixed(2))

                $drag
                    .find('.w-e-img-drag-show-size')
                    .text(
                        `${setW.toFixed(2).replace('.00', '')}px * ${setH
                            .toFixed(2)
                            .replace('.00', '')}px`
                    )
                setDragStyle($drag, setW, setH, left, top)
            }
            $document.on('mousemove', mouseMoveHandler)

            function mouseUpHandler() {
                $imgTarget.attr('width', setW + '')
                $imgTarget.attr('height', setH + '')
                const newImgRect = $imgTarget.getBoundingClientRect()
                setDragStyle(
                    $drag,
                    setW,
                    setH,
                    newImgRect.left - boxRect.left,
                    newImgRect.top - boxRect.top
                )

                // 解绑事件
                offEvents()
            }
            $document.on('mouseup', mouseUpHandler)

            // 解绑事件
            $document.on('mouseleave', offEvents)
        })
    }

    // 显示拖拽框
    function showDrag($target: DomElement) {
        if (UA.isIE()) return false
        if ($target) {
            $imgTarget = $target
            showDargBox($textContainerElem, $drag, $imgTarget)
        }
    }

    // 隐藏拖拽框
    function hideDrag() {
        $textContainerElem.find('.w-e-img-drag-mask').hide()
    }

    // 事件绑定
    bindDragEvents($drag, $textContainerElem)

    // 后期改成 blur 触发
    $(document).on('click', hideDrag)
    editor.beforeDestroy(function () {
        $(document).off('click', hideDrag)
    })

    return {
        showDrag,
        hideDrag,
    }
}
/**
 * 点击事件委托
 * @param editor 编辑器实例
 */
export default function bindDragImgSize(editor: Editor) {
    const { showDrag, hideDrag } = createShowHideFn(editor)

    // 显示拖拽框
    editor.txt.eventHooks.imgClickEvents.push(showDrag)

    // 隐藏拖拽框
    editor.txt.eventHooks.textScrollEvents.push(hideDrag)
    editor.txt.eventHooks.keyupEvents.push(hideDrag)
    editor.txt.eventHooks.toolbarClickEvents.push(hideDrag)
    editor.txt.eventHooks.menuClickEvents.push(hideDrag)
    editor.txt.eventHooks.changeEvents.push(hideDrag)
}
