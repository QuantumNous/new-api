import { DomElement } from '../../utils/dom-core';
export declare class todo {
    private template;
    private checked;
    private $todo;
    private $child;
    constructor($orginElem?: DomElement);
    init(): void;
    getInput(): DomElement;
    getInputContainer(): DomElement;
    getTodo(): DomElement;
}
declare function createTodo($orginElem?: DomElement): todo;
export default createTodo;
