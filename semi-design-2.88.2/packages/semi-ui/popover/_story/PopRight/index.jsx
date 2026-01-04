import React from 'react';
import { Tag, Popover } from '@douyinfe/semi-ui';

import './index.scss';

export default function Demo() {
    return (
        <div style={{ display: 'flex', flexDirection: 'row-reverse' }}>
            <Popover
                trigger="click"
                position="bottomRight"
                content={(
                    <div className={'popText'}>
                        <div className={'item'}>
                            <span className={'label'}>获得奖励：</span>
                            <span className={'value'}>火力</span>
                        </div>
                    </div>
                )}
            >
                <Tag>Click Me</Tag>
            </Popover>
        </div>
    );
}
