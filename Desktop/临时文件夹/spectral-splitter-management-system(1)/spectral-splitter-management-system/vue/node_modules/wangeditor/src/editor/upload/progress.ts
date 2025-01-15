/**
 * @description 上传进度条
 * @author wangfupeng
 */

import $, { DomElement } from '../../utils/dom-core'
import Editor from '../../editor/index'

class Progress {
    private editor: Editor
    private $bar: DomElement
    private $textContainer: DomElement
    private isShow: boolean
    private time: number
    private timeoutId: number

    constructor(editor: Editor) {
        this.editor = editor
        this.$textContainer = editor.$textContainerElem
        this.$bar = $('<div class="w-e-progress"></div>')

        this.isShow = false
        this.time = 0
        this.timeoutId = 0
    }

    /**
     * 显示进度条
     * @param progress 进度百分比
     */
    public show(progress: number): void {
        // 不要重新显示
        if (this.isShow) {
            return
        }
        this.isShow = true

        // 渲染 $bar
        const $bar = this.$bar
        const $textContainer = this.$textContainer
        $textContainer.append($bar)

        // 改变进度条（防抖，100ms 渲染一次）
        if (Date.now() - this.time > 100) {
            if (progress <= 1) {
                $bar.css('width', progress * 100 + '%')
                this.time = Date.now()
            }
        }

        // 500ms 之后隐藏
        let timeoutId = this.timeoutId
        if (timeoutId) {
            clearTimeout(timeoutId)
        }
        this.timeoutId = window.setTimeout(() => {
            this.hide()
        }, 500)
    }

    /**
     * 隐藏
     */
    private hide() {
        const $bar = this.$bar
        $bar.remove()

        this.isShow = false
        this.time = 0
        this.timeoutId = 0
    }
}

export default Progress
