import React from 'react';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import { cssClasses } from '@douyinfe/semi-foundation/dropdown/constants';
import { BaseProps } from '../_base/baseComponent';


const prefixCls = cssClasses.PREFIX;

export type DropdownDividerProps = BaseProps;


const DropdownDivider: React.FC<DropdownDividerProps> = (props = {}) => {
    const { style, className } = props;
    return <div className={classnames(`${prefixCls}-divider`, className)} style={style} />;
};


export default DropdownDivider;
