import React from 'react';
import { Transition } from '@douyinfe/semi-animation-react';

function QueueTransition({ children, state, position = 'right', ...rest }) {
    const propMap = {
        left: {
            type: 'translateX',
            ratio: -1,
        },
        right: {
            type: 'translateX',
            ratio: 1,
        },
        top: {
            type: 'translateY',
            ratio: -1,
        },
        bottom: {
            type: 'translateY',
            ratio: 1,
        },
    };

    let translateObj = propMap[position];

    if (!translateObj) {
        translateObj = propMap.right;
    }

    const translateType = translateObj.type;
    const translateRatio = translateObj.ratio;

    return React.Children.map(children, (child, idx) => (
        <Transition
            from={{ opacity: 0, [translateType]: translateRatio * 200 }}
            enter={{
                opacity: { val: 1, duration: 300, easing: 'linear' },
                [translateType]: { val: 0, easing: 'cubic-bezier(0, .68, .3, 1)', duration: 300 },
            }}
            leave={{
                opacity: { val: 0, duration: 200, easing: 'linear' },
                [translateType]: {
                    val: translateRatio * 200,
                    easing: 'cubic-bezier(0.5, 0, 1, 0.4)',
                    duration: 200,
                },
            }}
            config={{ delay: idx * 100 }}
            state={state}
        >
            {(props = {}) => React.cloneElement(child, {
                ...child.props,
                style: {
                    ...child.props.style,
                    opacity: props.opacity,
                    transform: `${[translateType]}(${props[translateType]}%)`,
                },
            })}
        </Transition>
    ));
}

export default QueueTransition;
