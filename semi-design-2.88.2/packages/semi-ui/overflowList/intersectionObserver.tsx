import React, { ReactNode } from 'react';
import PropTypes from 'prop-types';
import { isEqual, isEmpty } from 'lodash';
import { isHTMLElement } from '../_base/reactUtils';

export interface ReactIntersectionObserverProps {
    onIntersect?: IntersectionObserverCallback;
    option?: IntersectionObserverInit;
    children?: React.ReactNode;
    root?: IntersectionObserverInit['root'];
    threshold?: IntersectionObserverInit['threshold'];
    rootMargin?: IntersectionObserverInit['rootMargin'];
    items?: Record<string, Element>
}

export default class ReactIntersectionObserver extends React.PureComponent<ReactIntersectionObserverProps> {
    static propTypes = {
        onIntersect: PropTypes.func,
        option: PropTypes.object,
        root: PropTypes.any,
        threshold: PropTypes.number,
        rootMargin: PropTypes.string,
        items: PropTypes.object,
    };

    static defaultProps = {
        onIntersect: (): void => undefined,
        threshold: 0.75,
        rootMargin: '0px',
        option: {},
        items: {},
    };

    observer: IntersectionObserver;
    cachedKeys: Array<string>;

    componentDidMount(): void {
        const { items } = this.props;
        this.cachedKeys = Object.keys(items);
        const { root, threshold, rootMargin, option, onIntersect } = this.props;
        this.observer = new IntersectionObserver(
            onIntersect,
            {
                root,
                threshold,
                rootMargin,
                ...option,
            }
        );
        this.observeElement();

    }

    componentDidUpdate(): void {
        const { items } = this.props;
        const itemKeys = Object.keys(items);
        if (!isEqual(this.cachedKeys, itemKeys)) {
            this.observeElement(true);
            this.cachedKeys = itemKeys;
        }
    }

    componentWillUnmount(): void {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    }

    observeElement(force = false): void {
        const { items } = this.props;
        if (isEmpty(items)) {
            // stop everything if not defined
            this.observer.disconnect();
            return;
        }
        if (force) {
            this.observer.disconnect();
        }

        // observer callback is invoked immediately when observing new elements
        Object.keys(items).forEach(key => {
            const node = items[key];
            if (!(node && isHTMLElement(node))) {
                return;
            }
            this.observer.observe(node);
        });
    }

    render() {
        const { children } = this.props;
        return children;
    }
}
