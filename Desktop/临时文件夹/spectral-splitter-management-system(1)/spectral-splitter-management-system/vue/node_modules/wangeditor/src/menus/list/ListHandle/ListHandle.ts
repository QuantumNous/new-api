import Editor from '../../../editor'
import { DomElement } from '../../../utils/dom-core'
import SelectionRangeElem from '../SelectionRangeElem'

export type HandlerListOptions = {
    editor: Editor
    listType: string
    listTarget: string
    $selectionElem: DomElement
    $startElem: DomElement
    $endElem: DomElement
}

export interface Exec {
    exec: Function
}

export class ListHandle {
    public options: HandlerListOptions
    public selectionRangeElem: SelectionRangeElem

    constructor(options: HandlerListOptions) {
        this.options = options
        this.selectionRangeElem = new SelectionRangeElem()
    }
}
