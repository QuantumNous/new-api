import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { cssClasses } from '@douyinfe/semi-foundation/dropdown/constants';
import Foundation from '@douyinfe/semi-foundation/dropdown/menuFoundation';
import DropdownContext from './context';

import BaseComponent, { BaseProps } from '../_base/baseComponent';

const prefixCls = cssClasses.PREFIX;
export type DropdownMenuProps = BaseProps;

class DropdownMenu extends BaseComponent<DropdownMenuProps> {
    static propTypes = {
        children: PropTypes.node,
        className: PropTypes.string,
        style: PropTypes.object,
    };

    static contextType = DropdownContext;


    constructor(props: DropdownMenuProps) {
        super(props);

        this.foundation = new Foundation(this.adapter);
    }

    get adapter() {
        return {
            ...super.adapter,
        };
    }

    render() {
        const { children, className, style, ...rest } = this.props;
        return (
            <ul role="menu" aria-orientation="vertical" {...rest} className={classnames(`${prefixCls}-menu`, className)} style={style} onKeyDown={e => this.foundation.onMenuKeydown(e)}>
                {children}
            </ul>
        );
    }
}

export default DropdownMenu;
