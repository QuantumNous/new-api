import Editor from '../../../editor';
import { DomElement } from '../../../utils/dom-core';
import SelectionRangeElem from '../SelectionRangeElem';
export declare type HandlerListOptions = {
    editor: Editor;
    listType: string;
    listTarget: string;
    $selectionElem: DomElement;
    $startElem: DomElement;
    $endElem: DomElement;
};
export interface Exec {
    exec: Function;
}
export declare class ListHandle {
    options: HandlerListOptions;
    selectionRangeElem: SelectionRangeElem;
    constructor(options: HandlerListOptions);
}
