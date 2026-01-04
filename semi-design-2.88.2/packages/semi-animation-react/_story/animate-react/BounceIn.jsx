import { Animation, presets } from '@douyinfe/semi-animation-react';
import React from 'react';

/**
@keyframes semi-bounceIn {
    from,
    20%,
    40%,
    60%,
    80%,
    to {
        animation-timing-function: cubic-bezier(.215, .61, .355, 1);
    }

    0% {
        opacity: 0;
        transform: scale3d(.3, .3, .3);
    }

    20% {
        transform: scale3d(1.1, 1.1, 1.1);
    }

    40% {
        transform: scale3d(.9, .9, .9);
    }

    60% {
        opacity: 1;
        transform: scale3d(1.03, 1.03, 1.03);
    }

    80% {
        transform: scale3d(.97, .97, .97);
    }

    to {
        opacity: 1;
        transform: scale3d(1, 1, 1);
    }
}
 */

export default class BounceIn extends React.PureComponent {
    constructor(props = {}) {
        super(props);
        this.state = {
            currentStyle: {},
            frameIndex: 0,
            config: {
                ...presets.wobbly,
                // easing: 'cubic-bezier(.215, .61, .355, 1)',
                // easing: 'easeInCubic',
                // duration: 750,
            },
        };

        this.frames = [
            {
                scale3d: 3,
                opacity: 0,
            },
            // { opacity: 0.333, scale3d: 1.1 },
            // { opacity: 0.666, scale3d: 0.9 },
            // { opacity: 1, scale3d: 1.03 },
            // { opacity: 1, scale3d: 0.97 },
            {
                scale3d: 10,
                opacity: { val: 10, easing: 'linear' },
            },
        ];
    }

    next = () => {
        let { frameIndex } = this.state;

        frameIndex++;

        if (frameIndex + 1 < this.frames.length) {
            this.setState({ frameIndex });
        }
    };

    onFrame = ({ opacity, scale3d }) => {
        scale3d = scale3d / 10;
        this.setState({
            currentStyle: {
                opacity: opacity / 10,
                transform: `scale3d(${scale3d}, ${scale3d}, ${scale3d})`,
            },
        });
    };

    componentWillUnmount() {
        this.instance && this.instance.destroy();
    }

    render() {
        let { children } = this.props;

        let { config, frameIndex, currentStyle } = this.state;

        const from = this.frames[frameIndex];
        const to = this.frames[frameIndex + 1];

        // console.log(currentStyle);

        return (
            <Animation
                forwardInstance={instance => (this.instance = instance)}
                // force
                from={{ ...from }}
                to={{ ...to }}
                config={{ ...config }}
                onFrame={this.onFrame}
                onRest={this.next}
            >
                {() => (typeof children === 'function' ? children(currentStyle) : children)}
            </Animation>
        );
    }
}
