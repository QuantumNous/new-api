import { get } from "lodash";

export function handlePrevent(event: any) {
    event.stopPropagation();
    event.preventDefault();
}

export function isPrintableCharacter(string: string): RegExpMatchArray {
    return string.length === 1 && string.match(/\S/);
}

// set focus to the target item in item list
export function setFocusToItem(itemNodes: HTMLElement[], targetItem: HTMLElement): void {
    for (let i = 0; i < itemNodes.length; i++) { 
        if (itemNodes[i] === targetItem) {
            itemNodes[i].tabIndex = 0;
            itemNodes[i].focus();
        } else { 
            itemNodes[i].tabIndex = -1;
        }
    }
}

// set focus to the first item in item list
export function setFocusToFirstItem(itemNodes: HTMLElement[]): void {
    itemNodes.length > 0 && setFocusToItem(itemNodes, itemNodes[0]);
}

// set focus to the last item in item list
export function setFocusToLastItem(itemNodes: HTMLElement[]): void {
    itemNodes.length > 0 && setFocusToItem(itemNodes, itemNodes[itemNodes.length-1]);
}

// set focus to the previous item in item list
export function setFocusToPreviousMenuItem (itemNodes: HTMLElement[], currentItem: HTMLElement): void {
    let newMenuItem: HTMLElement, index: number;

    if (itemNodes.length > 0) {
        if (currentItem === itemNodes[0]) {
            newMenuItem = itemNodes[itemNodes.length-1];
        } else {
            index = itemNodes.indexOf(currentItem);
            newMenuItem = itemNodes[index - 1];
        }
        setFocusToItem(itemNodes, newMenuItem);
    }
}

// set focus to the next item in item list
export function setFocusToNextMenuitem (itemNodes: HTMLElement[], currentItem: HTMLElement): void {
    let newMenuItem: HTMLElement, index: number;

    if (itemNodes.length > 0) {
        if (currentItem === itemNodes[itemNodes.length-1]) {
            newMenuItem = itemNodes[0];
        } else {
            index = itemNodes.indexOf(currentItem);
            newMenuItem = itemNodes[index + 1];
        }
        setFocusToItem(itemNodes, newMenuItem);
    }
}

export function findIndexByCharacter(itemList: HTMLElement[], curItem: HTMLElement, firstCharList: string[], char: string): number {
    let start: number, index: number;

    if (!itemList || !firstCharList || !char || char.length > 1) {
        return -1;
    }

    char = char.toLowerCase();

    // Get start index for search based on position of currentItem
    start = itemList.indexOf(curItem) + 1;
    if (start >= itemList.length) {
        start = 0;
    }

    // Check remaining menu items in the menu
    index = firstCharList.indexOf(char, start);

    // If not found in remaining menu items, check from beginning
    if (index === -1) {
        index = firstCharList.indexOf(char, 0);
    }

    return index >= 0 ? index : -1;
}

export function getAncestorNodeByRole(curElement: Element, role: string): Element { 
    if (!curElement) {
        return null;
    }
    while (curElement.parentElement && get(curElement.parentElement, 'attributes.role.value', '') !== role) {
        curElement = curElement.parentElement;
    }
    return curElement.parentElement;
}

// According to the Id, find the corresponding data-popupid element
export function getMenuButton(focusableEle: NodeListOf<HTMLElement>, Id: string): HTMLElement {
    for (let i = 0; i < focusableEle.length; i++) {
        const curAriDescribedby = focusableEle[i].attributes['data-popupid'];
        if (curAriDescribedby && curAriDescribedby.value === Id) {
            return focusableEle[i];
        }
    }
    return null;
}