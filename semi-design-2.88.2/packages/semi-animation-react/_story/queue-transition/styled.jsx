import React from 'react';
import { StyledTransition } from '../../index';

function QueueStyledTransition({ children, position = 'Left', state = 'enter', ...rest }) {
    const enterCls = `semi-fadeIn, semi-slideIn${position}`;
    const leaveCls = `semi-fadeOut, semi-slideOut${position}`;

    return React.Children.map(children, (child, idx) => (
        <StyledTransition
            enter={enterCls}
            leave={leaveCls}
            state={state}
            delay={idx * 50 + 'ms'}
            duration={state === 'enter' ? '.3s,.3s' : '.2s,.2s'}
        >
            {({ animateCls, animateStyle }) => React.cloneElement(child, {
                ...child.props,
                className: animateCls,
                style: {
                    ...child.props.style,
                    ...animateStyle,
                },
            })}
        </StyledTransition>
    ));
}

export default QueueStyledTransition;
