// https://stackoverflow.com/questions/33199959/how-to-detect-a-react-component-vs-a-react-element
import React from 'react';
import { isHTMLElement } from '@douyinfe/semi-foundation/utils/dom';

function isClassComponent(component: any) {
    return typeof component === 'function' && Boolean(component.prototype.isReactComponent);
}

function isFunctionalComponent(Component: any) {
    return (
        typeof Component === 'function' && // can be various things
        !(
            Component.prototype && Component.prototype.isReactComponent // native arrows don't have prototypes
        )
    );
}

function isReactComponent(component: any) {
    return isClassComponent(component) || isFunctionalComponent(component);
}

function isElement(element: any) {
    return React.isValidElement(element);
}

function isCompositeTypeElement(element: any) {
    return isElement(element) && typeof element.type === 'function';
}

function isEmptyChildren(children: any) {
    return React.Children.count(children) === 0;
}

export {
    isClassComponent,
    isFunctionalComponent,
    isReactComponent,
    isElement,
    // isDOMTypeElement,
    isHTMLElement,
    isCompositeTypeElement,
    isEmptyChildren
};
