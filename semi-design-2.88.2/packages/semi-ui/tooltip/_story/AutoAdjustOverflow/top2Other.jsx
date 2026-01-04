import React, { PureComponent, useState } from 'react';
import { Tooltip, Button, Popover } from '@douyinfe/semi-ui';
import { PopupContent, Trigger } from './common';


const Top2Bottom = () => {
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
                    left: 300,
                }}
            >
                pos: {pos}
            </Trigger>
        </Tooltip>
    </div>);
};

const Top2BottomLeft = () => {
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
                    left: 40,
                }}
            />
        </Tooltip>
    </div>);
};

const Top2BottomRight = () => {
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
                }}
            />
        </Tooltip>
    </div>);
};

const Top2TopLeft = () => {
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
                    bottom: 0,
                }}
            />
        </Tooltip>
    </div>);
};

const Top2TopRight = () => {
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
                    top: 224,
                    right: 0
                }}
            />
        </Tooltip>
    </div>);
};

export { Top2Bottom, Top2BottomLeft, Top2BottomRight, Top2TopLeft, Top2TopRight };