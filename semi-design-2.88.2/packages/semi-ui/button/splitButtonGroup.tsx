import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { cssClasses } from '@douyinfe/semi-foundation/button/constants';
import '@douyinfe/semi-foundation/button/button.scss';
import BaseComponent, { BaseProps } from '../_base/baseComponent';

const prefixCls = cssClasses.PREFIX;

export interface SplitButtonGroupProps extends BaseProps {
    'aria-label'?: React.AriaAttributes['aria-label']
}

export default class SplitButtonGroup extends BaseComponent<SplitButtonGroupProps> {

    containerRef: React.RefObject<HTMLDivElement> = React.createRef();
    mutationObserver: MutationObserver | null = null;
    static propTypes = {
        style: PropTypes.object,
        className: PropTypes.string,
        'aria-label': PropTypes.string,
    };

    componentDidMount() {
        const addClassName = () => {
            const buttons = this.containerRef.current.querySelectorAll('button');
            const firstButton = buttons[0];
            const lastButton = buttons[buttons.length - 1];
            if (!firstButton?.classList.contains(`${prefixCls}-first`)) {
                firstButton?.classList.add(`${prefixCls}-first`);
            }
            if (!lastButton?.classList.contains(`${prefixCls}-last`)) {
                lastButton?.classList.add(`${prefixCls}-last`);
            }

        };
        if (this.containerRef.current) {
            addClassName();
            const mutationObserver = new MutationObserver((mutations, observer) => {
                for (const mutation of mutations) {
                    if ((mutation.type === 'attributes' && mutation.attributeName === 'class') || (mutation.type === 'childList' && Array.from(mutation.addedNodes).some(node => node.nodeName === 'BUTTON'))) {
                        addClassName();
                    }
                }
            });
            mutationObserver.observe(this.containerRef.current, { attributes: true, childList: true, subtree: true });
            this.mutationObserver = mutationObserver;
        }
    }

    componentWillUnmount() {
        super.componentWillUnmount();
        this.mutationObserver?.disconnect();
    }

    render() {
        const { children, style, className } = this.props;
        const cls = classNames(`${prefixCls}-split`, className);
        return (
            <div ref={this.containerRef} className={cls} style={style} role="group"
                aria-label={this.props['aria-label']}>
                {children}
            </div>
        );
    }
}
