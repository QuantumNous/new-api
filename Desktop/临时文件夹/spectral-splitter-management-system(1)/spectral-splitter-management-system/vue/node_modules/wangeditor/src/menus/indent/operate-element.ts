/**
 * @description 对节点 操作 进行封装
 *                  获取当前节点的段落
 *                  根据type判断是增加还是减少缩进
 * @author tonghan
 */

import { DomElement } from '../../utils/dom-core'
import Editor from '../../editor/index'
import { IndentationOptions } from '../../config/menus'
import increaseIndentStyle from './increase-indent-style'
import decreaseIndentStyle from './decrease-indent-style'

const lengthRegex = /^(\d+)(\w+)$/
const percentRegex = /^(\d+)%$/

function parseIndentation(editor: Editor): IndentationOptions {
    const { indentation } = editor.config

    if (typeof indentation === 'string') {
        if (lengthRegex.test(indentation)) {
            const [value, unit] = indentation.trim().match(lengthRegex)!.slice(1, 3)
            return {
                value: Number(value),
                unit,
            }
        } else if (percentRegex.test(indentation)) {
            return {
                value: Number(indentation.trim().match(percentRegex)![1]),
                unit: '%',
            }
        }
    } else if (indentation.value !== void 0 && indentation.unit) {
        return indentation
    }

    return {
        value: 2,
        unit: 'em',
    }
}

function operateElement($node: DomElement, type: String, editor: Editor): void {
    const $elem = $node.getNodeTop(editor)
    const reg = /^(P|H[0-9]*)$/

    if (reg.test($elem.getNodeName())) {
        if (type === 'increase') increaseIndentStyle($elem, parseIndentation(editor))
        else if (type === 'decrease') decreaseIndentStyle($elem, parseIndentation(editor))
    }
}

export default operateElement
