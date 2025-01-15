/**
 * @description range变化
 * @author liuwei
 */
import Editor from '../index'
export default class SelectionChange {
    constructor(public editor: Editor) {
        // 绑定的事件
        const init = () => {
            const activeElement = document.activeElement
            if (activeElement === editor.$textElem.elems[0]) {
                this.emit()
            }
        }

        //  选取变化事件监听
        window.document.addEventListener('selectionchange', init)

        // 摧毁时移除监听
        this.editor.beforeDestroy(() => {
            window.document.removeEventListener('selectionchange', init)
        })
    }

    public emit(): void {
        // 执行rangeChange函数
        const { onSelectionChange } = this.editor.config
        if (onSelectionChange) {
            const selection = this.editor.selection
            selection.saveRange()
            if (!selection.isSelectionEmpty())
                onSelectionChange({
                    // 当前文本
                    text: selection.getSelectionText(),
                    // 当前的html
                    html: selection.getSelectionContainerElem()?.elems[0].innerHTML,
                    // select对象
                    selection: selection,
                })
        }
    }
}
