import React, { PureComponent, useState } from 'react';
import { Tooltip, Button, Popover } from '@douyinfe/semi-ui';

import { PopupContent, Trigger } from './common';

// ❌
const Right2Left = () => {
    const [pos, setPos] = useState('right');
    return (<div>
        <Tooltip
            content={
                <PopupContent
                    w={200}
                    h={200}
                />
            }
            arrowPointAtCenter={false}
            visible
            trigger='custom'
            position={pos}
            key={pos}
        >
            <Trigger
                w={100}
                h={100}
                style={{
                    position: 'absolute',
                    right: 0,
                    bottom: 300
                }}
            >
                pos: {pos}
            </Trigger>
        </Tooltip>
    </div>);
};

// ✅
const Right2LeftTop = () => {
    const [pos, setPos] = useState('right');
    return (<div>
        <Tooltip
            content={
                <PopupContent
                    w={200}
                    h={200}
                />
            }
            arrowPointAtCenter={false}
            visible
            trigger='custom'
            position={pos}
            key={pos}
        >
            <Trigger
                w={100}
                h={100}
                style={{
                    position: 'absolute',
                    right: 0,
                    top: 0
                }}
            />
        </Tooltip>
    </div>);
};

// ❌
const Right2LeftBottom = () => {
    const [pos, setPos] = useState('right');
    return (<div
        style={{
        }}
    >
        <Tooltip
            content={
                <PopupContent
                    w={200}
                    h={200}
                />
            }
            arrowPointAtCenter={false}
            visible
            trigger='custom'
            position={pos}
            key={pos}
        >
            <Trigger
                w={100}
                h={100}
                style={{
                    position: 'absolute',
                    right: 0,
                    bottom: 0
                }}
            />
        </Tooltip>
    </div>);
};

const Right2RightTop = () => {
    const [pos, setPos] = useState('right');
    return (<div
        style={{
        }}
    >
        <Tooltip
            content={
                <PopupContent
                    w={200}
                    h={200}
                />
            }
            arrowPointAtCenter={false}
            visible
            trigger='custom'
            position={pos}
            key={pos}
        >
            <Trigger
                w={100}
                h={100}
                style={{
                    position: 'absolute',
                    top: 40,
                }}
            />
        </Tooltip>
    </div>);
};

const Right2RightBottom = () => {
    const [pos, setPos] = useState('right');
    return (<div
        style={{
        }}
    >
        <Tooltip
            content={
                <PopupContent
                    w={200}
                    h={200}
                />
            }
            arrowPointAtCenter={false}
            visible
            trigger='custom'
            position={pos}
            key={pos}
        >
            <Trigger
                w={100}
                h={100}
                style={{
                    position: 'absolute',
                    bottom: 0
                }}
            />
        </Tooltip>
    </div>);
};

export { Right2Left, Right2LeftTop, Right2LeftBottom, Right2RightTop, Right2RightBottom };