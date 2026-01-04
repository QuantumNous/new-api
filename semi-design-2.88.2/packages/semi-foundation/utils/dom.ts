import isHTMLElement from './isElement';

/**
 *
 * @param {HTMLElement} parentNode
 * @param  {...HTMLElement} nodes
 *
 * @param {HTMLElement}
 */
export function append(parentNode: HTMLElement, ...nodes: HTMLElement[]) {
    for (const node of nodes) {
        parentNode.appendChild(node);
    }

    return parentNode;
}

/**
 *
 * @param {HTMLElement} parentNode
 * @param  {...HTMLElement} nodes
 *
 * @param {HTMLElement}
 */
export function prepend(parentNode: HTMLElement, ...nodes: HTMLElement[]) {
    if (parentNode.children && parentNode.children.length) {
        const firstNode = parentNode.children[0];

        for (const node of nodes) {
            parentNode.insertBefore(node, firstNode);
        }
    } else {
        append(parentNode, ...nodes);
    }

    return parentNode;
}

/**
 *
 * @param {DOMRect} domRect
 * @returns {object|undefined}
 */
export function convertDOMRectToObject(domRect: DOMRect): DOMRectLikeType {
    if (domRect && typeof domRect === 'object') {
        if (typeof domRect.toJSON === 'function') {
            return domRect.toJSON();
        } else {
            const keys = ['left', 'top', 'right', 'bottom', 'width', 'height'] as const;

            return keys.reduce((obj, key) => {
                obj[key] = domRect[key];
                return obj;
            }, {} as DOMRectLikeType);
        }
    }
    return undefined;
}

export type DOMRectLikeType = {
    [key in 'left' | 'top' | 'right' | 'bottom' | 'width' | 'height']?: number;
};

export { isHTMLElement };
