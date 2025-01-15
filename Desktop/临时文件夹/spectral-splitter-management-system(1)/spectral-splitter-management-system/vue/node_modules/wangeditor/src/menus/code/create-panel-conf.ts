/**
 * @description code 菜单 panel tab 配置
 * @author lkw
 */

import Editor from '../../editor/index'
import { PanelConf } from '../menu-constructors/Panel'
import { getRandom } from '../../utils/util'
import $, { DomElement } from '../../utils/dom-core'
import isActive from './is-active'
import { EMPTY_P } from '../../utils/const'

export default function (editor: Editor, text: string, languageType: string): PanelConf {
    // panel 中需要用到的id
    const inputIFrameId = getRandom('input-iframe')
    const languageId = getRandom('select')
    const btnOkId = getRandom('btn-ok')

    /**
     * 插入代码块
     * @param text 文字
     */
    function insertCode(languateType: string, code: string): void {
        // 选区处于链接中，则选中整个菜单，再执行 insertHTML
        let active = isActive(editor)

        if (active) {
            selectCodeElem()
        }

        const content = editor.selection.getSelectionStartElem()?.elems[0].innerHTML

        if (content) {
            editor.cmd.do('insertHTML', EMPTY_P)
        }

        // 过滤标签，防止xss
        let formatCode = code.replace(/</g, '&lt;').replace(/>/g, '&gt;')

        // 高亮渲染
        if (editor.highlight) {
            formatCode = editor.highlight.highlightAuto(formatCode).value
        }

        //增加pre标签
        editor.cmd.do('insertHTML', `<pre><code class="${languateType}">${formatCode}</code></pre>`)

        const $code = editor.selection.getSelectionStartElem()
        const $codeElem = $code?.getNodeTop(editor)

        // 通过dom操作添加换行标签
        if ($codeElem?.getNextSibling().elems.length === 0) {
            // @ts-ignore
            $(EMPTY_P).insertAfter($codeElem)
        }
    }

    /**
     * 选中整个链接元素
     */
    function selectCodeElem(): void {
        if (!isActive(editor)) return

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        let $selectedCode: DomElement

        const $code = editor.selection.getSelectionStartElem()
        const $codeElem = $code?.getNodeTop(editor)
        if (!$codeElem) return

        editor.selection.createRangeByElem($codeElem)
        editor.selection.restoreSelection()

        $selectedCode = $codeElem // 赋值给函数内全局变量
    }

    const t = (text: string): string => {
        return editor.i18next.t(text)
    }

    // @ts-ignore
    const conf = {
        width: 500,
        height: 0,

        // panel 中可包含多个 tab
        tabs: [
            {
                // tab 的标题
                title: t('menus.panelMenus.code.插入代码'),
                // 模板
                tpl: `<div>
                        <select name="" id="${languageId}">
                            ${editor.config.languageType.map(language => {
                                return (
                                    '<option ' +
                                    (languageType == language ? 'selected' : '') +
                                    ' value ="' +
                                    language +
                                    '">' +
                                    language +
                                    '</option>'
                                )
                            })}
                        </select>
                        <textarea id="${inputIFrameId}" type="text" class="wang-code-textarea" placeholder="" style="height: 160px">${text.replace(
                    /&quot;/g,
                    '"'
                )}</textarea>
                        <div class="w-e-button-container">
                            <button type="button" id="${btnOkId}" class="right">${
                    isActive(editor) ? t('修改') : t('插入')
                }</button>
                        </div>
                    </div>`,
                // 事件绑定
                events: [
                    // 插入链接
                    {
                        selector: '#' + btnOkId,
                        type: 'click',
                        fn: () => {
                            const $code = document.getElementById(inputIFrameId)
                            const $select = $('#' + languageId)

                            let languageType = $select.val()
                            // @ts-ignore
                            let code = $code.value

                            // 代码为空，则不插入
                            if (!code) return

                            //增加标签
                            if (isActive(editor)) {
                                return false
                            } else {
                                // @ts-ignore
                                insertCode(languageType, code)
                            }

                            // 返回 true，表示该事件执行完之后，panel 要关闭。否则 panel 不会关闭
                            return true
                        },
                    },
                ],
            }, // tab end
        ], // tabs end
    }

    return conf
}
