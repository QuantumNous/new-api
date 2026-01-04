import React, { useState } from 'react';
import { storiesOf } from '@storybook/react';

import Popover from '../index';
import Button from '../../button';

const stories = storiesOf('popover', module);

const POSITION_SET:string[] = [
    'top',
    'topLeft',
    'topRight',
    'left',
    'leftTop',
    'leftBottom',
    'right',
    'rightTop',
    'rightBottom',
    'bottom',
    'bottomLeft',
    'bottomRight',
    'leftTopOver',
    'rightTopOver',
]

stories.add('positions', () => (
    <div
        style={{
            width: 480,
            height: 360,
            boxSizing: 'content-box',
            padding: '150px 250px',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-evenly',
        }}
    >
        {POSITION_SET.map((pos:any) => (
            <Popover
                key={pos}
                content={
                    <div style={{ padding: 20 }}>
                        <p>Hi Bytedancer!</p>
                    </div>
                }
                trigger="click"
                position={pos}
            >
                <Button key={pos}>{pos}</Button>
            </Popover>
        ))}
    </div>
));