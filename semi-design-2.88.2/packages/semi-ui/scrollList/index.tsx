import React from 'react';
import BaseComponent, { BaseProps } from '../_base/baseComponent';
import { cssClasses } from '@douyinfe/semi-foundation/scrollList/constants';
import classnames from 'classnames';
import propTypes from 'prop-types';
import ScrollItem from './scrollItem';
import Foundation from '@douyinfe/semi-foundation/scrollList/foundation';

import '@douyinfe/semi-foundation/scrollList/scrollList.scss';

export type { ScrollItemProps } from './scrollItem';
export interface ScrollListProps extends BaseProps {
    header?: React.ReactNode;
    footer?: React.ReactNode;
    children?: React.ReactNode;
    bodyHeight?: number | string;
    prefixCls?: string
}

// eslint-disable-next-line @typescript-eslint/ban-types
class ScrollList extends BaseComponent<ScrollListProps, {}> {
    static Item = ScrollItem;

    static propTypes = {
        className: propTypes.string,
        header: propTypes.node,
        footer: propTypes.node,
        children: propTypes.node,
        bodyHeight: propTypes.oneOfType([propTypes.number, propTypes.string]),
    };

    constructor(props: ScrollListProps) {
        super(props);
        this.foundation = new Foundation(this.adapter);
    }

    render() {
        const { children, header, footer, prefixCls, bodyHeight, className, style, ...rest } = this.props;

        const clsWrapper = classnames(className, {
            [prefixCls || cssClasses.PREFIX]: true,
        });

        const clsHeader = classnames({
            [`${prefixCls || cssClasses.PREFIX}-header`]: true,
        });

        return (
            <div className={clsWrapper} style={style} {...this.getDataAttr(rest)}>
                {header ? (
                    <div className={clsHeader}>
                        <div 
                            className={`${clsHeader}-title`} 
                            x-semi-prop={this.props['x-semi-header-alias'] || "header"}
                        >
                            {header}
                        </div>
                        <div className={`${clsWrapper}-line`} />
                    </div>
                ) : null}
                <div
                    className={`${clsWrapper}-body`}
                    style={{ height: bodyHeight ? bodyHeight : '' }}
                    x-semi-prop="children"
                >
                    {children}
                </div>
                {footer ? (
                    <div
                        className={`${clsWrapper}-footer`}
                        x-semi-prop={this.props['x-semi-footer-alias'] || "footer"}
                    >
                        {footer}
                    </div>
                ) : null}
            </div>
        );
    }
}

export default ScrollList;
