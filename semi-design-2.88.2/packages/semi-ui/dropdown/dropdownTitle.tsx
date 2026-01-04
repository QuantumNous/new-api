import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { cssClasses } from '@douyinfe/semi-foundation/dropdown/constants';
import cls from 'classnames';
import DropdownContext, { DropdownContextType } from './context';
import { BaseProps } from '../_base/baseComponent';

const prefixCls = cssClasses.PREFIX;
export type DropdownTitleProps = BaseProps;

class DropdownTitle extends PureComponent<DropdownTitleProps> {

    static propTypes = {
        children: PropTypes.node,
        className: PropTypes.string,
        style: PropTypes.object,
    };

    static contextType = DropdownContext;
    context: DropdownContextType;

    render() {
        const { className, style, children } = this.props;
        const { showTick } = this.context;
        const titleCls = cls({
            [`${prefixCls}-title`]: true,
            [`${prefixCls}-title-withTick`]: showTick,
        }, className);
        return (
            <div className={titleCls} style={style}>
                {children}
            </div>
        );
    }
}

export default DropdownTitle;
