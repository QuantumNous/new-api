import React from 'react';
import { Tooltip } from '@douyinfe/semi-ui/';

export default function Demo(props = {}) {
    return (
        <div>
            <Tooltip
                position={'bottomLeft'}
                trigger={'click'}
                content={'你好呀你好呀你好呀你好呀你好呀你好呀你好呀你好呀你好呀你好呀你好呀你好呀'}
            >
                <span style={{ float: 'right' }}>Clicked Me</span>
            </Tooltip>
        </div>
    );
}
