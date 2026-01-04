import React, { PureComponent, useState } from 'react';
import { Tooltip, Button, Popover } from '@douyinfe/semi-ui';
import { PopupContent, Trigger } from './common';


const Bottom2Top = () => {
    const [pos, setPos] = useState('top');
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
                    bottom: 0,
                    left: 100
                }}
            >
                pos: {pos}
            </Trigger>
        </Tooltip>
    </div>);
};

const Bottom2TopLeft = () => {
    const [pos, setPos] = useState('top');
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
                    bottom: 0
                }}
            />
        </Tooltip>
    </div>);
};

const Bottom2TopRight = () => {
    const [pos, setPos] = useState('top');
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
                    right: 40,
                    bottom: 0
                }}
            />
        </Tooltip>
    </div>);
};

const Bottom2BottomLeft = () => {
    const [pos, setPos] = useState('top');
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
                    left: 40
                }}
            />
        </Tooltip>
    </div>);
};

const Bottom2BottomRight = () => {
    const [pos, setPos] = useState('top');
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
                    right: 40
                }}
            />
        </Tooltip>
    </div>);
};

export { Bottom2Top, Bottom2TopLeft, Bottom2TopRight, Bottom2BottomLeft, Bottom2BottomRight };