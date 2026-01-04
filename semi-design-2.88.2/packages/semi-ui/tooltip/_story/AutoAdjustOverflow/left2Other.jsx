import React, { PureComponent, useState } from 'react';
import { Tooltip, Button, Popover } from '@douyinfe/semi-ui';
import { PopupContent, Trigger } from './common';

const Left2Right = () => {
    const [pos, setPos] = useState('left');
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
                    top: 70
                }}
            >
                pos: {pos}
            </Trigger>
        </Tooltip>
    </div>);
};

const Left2RightTop = () => {
    const [pos, setPos] = useState('left');
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
                // style={{
                //     position: 'absolute',
                //     right: 0,
                //     top: 0
                // }}
            />
        </Tooltip>
    </div>);
};

const Left2RightBottom = () => {
    const [pos, setPos] = useState('left');
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
                    // right: 0,
                    bottom: 0
                }}
            />
        </Tooltip>
    </div>);
};

const Left2LeftTop = () => {
    const [pos, setPos] = useState('left');
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
                    top: 50
                }}
            />
        </Tooltip>
    </div>);
};

const Left2LeftBottom = () => {
    const [pos, setPos] = useState('left');
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

export { Left2Right, Left2RightTop, Left2RightBottom, Left2LeftTop, Left2LeftBottom };