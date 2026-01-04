import React, { PureComponent } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import { cssClasses } from '@douyinfe/semi-foundation/form/constants';

const prefix = cssClasses.PREFIX;

export interface SectionProps {
    className?: string;
    style?: React.CSSProperties;
    text?: React.ReactNode;
    children?: React.ReactNode
}

export default class Section extends PureComponent<SectionProps> {
    static propTypes = {
        text: PropTypes.node,
        className: PropTypes.string,
        style: PropTypes.object,
        children: PropTypes.node,
    };

    render() {
        const { text, className, style, children } = this.props;
        const cls = classNames({
            [prefix + '-section']: true,
        }, className);
        const textCls = prefix + '-section-text';

        return (
            <section className={cls} style={style}>
                <h5 className={textCls}>{text}</h5>
                {children}
            </section>
        );
    }
}
