/**
 * @description 增加缩进
 * @author tonghan
 */

import { DomElement } from '../../utils/dom-core'
import { IndentationOptions } from '../../config/menus'

function increaseIndentStyle($node: DomElement, options: IndentationOptions): void {
    const $elem = $node.elems[0]
    if ($elem.style['paddingLeft'] === '') {
        $node.css('padding-left', options.value + options.unit)
    } else {
        const oldPL = $elem.style['paddingLeft']
        const oldVal = oldPL.slice(0, oldPL.length - options.unit.length)
        const newVal = Number(oldVal) + options.value
        $node.css('padding-left', `${newVal}${options.unit}`)
    }
}

export default increaseIndentStyle
