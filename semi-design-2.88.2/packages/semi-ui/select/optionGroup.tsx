import React from 'react';
import PropTypes from 'prop-types';
import cls from 'classnames';

import { cssClasses } from '@douyinfe/semi-foundation/select/constants';
import BaseComponent from '../_base/baseComponent';

export interface OptionGroupProps {
    children?: React.ReactNode;
    label?: React.ReactNode;
    className?: string;
    style?: React.CSSProperties
}
const prefixCls = cssClasses.PREFIX_GROUP;

class OptionGroup extends BaseComponent<OptionGroupProps> {
    static isSelectOptionGroup = true;

    static propTypes = {
        children: PropTypes.oneOfType([PropTypes.array, PropTypes.node]),
        label: PropTypes.node,
        className: PropTypes.string,
        style: PropTypes.object,
    };

    render() {
        const { label, className, style, ...rest } = this.props;
        const groupCls = cls(className, {
            [prefixCls]: true,
        });
        if (!label && typeof label !== 'number') {
            return null;
        }
        return (
            <div className={groupCls} style={style} {...this.getDataAttr(rest)}>
                {label}
            </div>
        );
    }
}

export default OptionGroup;
