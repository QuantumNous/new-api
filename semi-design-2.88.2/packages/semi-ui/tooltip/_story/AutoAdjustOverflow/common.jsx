import React, { PureComponent, useState } from 'react';
import { Tooltip, Button, Popover } from '@douyinfe/semi-ui';


const commonTriggerStyle = {
    border: '1px solid var(--semi-color-primary)',
    justifyContent: 'center',
    alignItems: 'center',
    display: 'inline-flex',
    color: 'var(--semi-color-primary)',
};

const commonContentStyle = {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(var(--semi-light-blue-5), 1)',
};


class Trigger extends PureComponent {
    render() {
        const { w = 100, h = 100, style, children, ...rest } = this.props;
        return (
            <div
                {...rest}
                style={{
                    width: w,
                    height: h,
                    ...commonTriggerStyle,
                    ...style,
                }}>
                Trigger w:{w}
                <br/>
                {children}
            </div>
        );
    }
}

const PopupContent = ({ w = 100, h = 40, style, ...rest }) => (
    <div style={{
        width: w,
        height: h,
        ...commonContentStyle,
        ...style,
    }}
    >
        Popup Content width {w}
    </div>
);

export { PopupContent, Trigger };