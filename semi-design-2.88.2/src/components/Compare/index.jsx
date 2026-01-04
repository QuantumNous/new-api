import React, { useState, useRef } from 'react';
import { Resizable } from 're-resizable';
import { IconExpand } from '@douyinfe/semi-icons';
import './index.scss';

const Handle = () => (
    <div className="handle">
        <div className="knob">
            <IconExpand />
        </div>
    </div>
);

const Compare = ({ dark, light }) => {
    const a = dark;
    const b = light;
    const [last, setLast] = useState(0);
    const [w, setW] = useState(50);
    const selfRef = useRef();

    const resizing = (e, dir, refToElement) => {
        const totalWidth = selfRef.current.getBoundingClientRect().width;
        const curWidth = refToElement.getBoundingClientRect().width;
        const newW = (curWidth / totalWidth) * 100;
        setW(newW);
    };

    const resizeStart = e => {
        setLast(e.screenX);
    };

    return (
        <div className="compare">
            <Resizable
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    bottom: 0,
                    right: 0,
                }}
                enable={{
                    right: true,
                }}
                className="a"
                defaultSize={{
                    width: '50%',
                }}
                lockAspectRatio={false}
                onResize={resizing}
                onResizeStart={resizeStart}
                handleComponent={{
                    right: <Handle />,
                }}
                maxWidth={'100%'}
            />
            <div
                className="clip"
                style={{
                    clipPath: `polygon(0 0, 0 100%, ${w}% 100%, ${w}% 0)`,
                }}
            >
                <div className="inner-image"><img src={a} alt='dark' /></div>
            </div>
            <div ref={selfRef} className="absolute b">
                <img
                    alt='light'
                    src={b}
                />
            </div>
        </div>
    );
};

export default Compare;
