/**
 * @description 减少缩进
 * @author tonghan
 */

import { DomElement } from '../../utils/dom-core'
import { IndentationOptions } from '../../config/menus'

function decreaseIndentStyle($node: DomElement, options: IndentationOptions): void {
    const $elem = $node.elems[0]
    if ($elem.style['paddingLeft'] !== '') {
        const oldPL = $elem.style['paddingLeft']
        const oldVal = oldPL.slice(0, oldPL.length - options.unit.length)
        const newVal = Number(oldVal) - options.value
        if (newVal > 0) {
            $node.css('padding-left', `${newVal}${options.unit}`)
        } else {
            $node.css('padding-left', '')
        }
    }
}

export default decreaseIndentStyle
