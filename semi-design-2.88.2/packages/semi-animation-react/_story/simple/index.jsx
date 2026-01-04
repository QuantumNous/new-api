import React from 'react';
import { Animation, interpolate } from '@douyinfe/semi-animation-react';

const styles = {
    container: {
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        willChange: 'background',
    },
    shape: { width: 300, height: 300, willChange: 'transform' },
};

export default class SimpleAnimation extends React.Component {
    state = { toggle: true };

    toggle = () => {
        this.setState(state => ({ toggle: !state.toggle }));
        if (this.handler && this.handler.reverse) {
            this.handler.reverse();
            this.handler.start();
        }
    };

    render() {
        const shapeFrom = [20, 380, 380, 380, 380, 380, 200, 20, 20, 380];
        const shapeTo = [20, 20, 20, 380, 380, 380, 380, 20, 20, 20];
        const prefixes = ['M', ',', ' L', ',', ' L', ',', ' L', ',', ' L', ','];

        return (
            <Animation
                from={{ value: 0 }}
                to={{ value: 50 }}
                forwardInstance={handler => (this.handler = handler)}
                onRest={() => {
                    if (this.handler) {
                        this.handler.reverse();
                        this.handler.start();
                    }
                }}
                // to={{
                //     coords: toggle ? [0, 0] : [50, 50],
                //     color: toggle ? '#247BA0' : '#70C1B3',
                //     start: toggle ? '#B2DBBF' : '#B2DBBF',
                //     end: toggle ? '#247BA0' : '#F3FFBD',
                //     scale: toggle ? 0.3 : 0.4,
                //     shape: toggle ? TRIANGLE : RECTANGLE,
                //     stop: toggle ? '0%' : '50%',
                //     rotation: toggle ? '0deg' : '45deg',
                // }}
            >
                {({ value }) => {
                    const ratio = value / 50;
                    // hsl(48, 16%, 57%) => hsl(71, 100%, 87%)
                    const start = `hsl(${(71 - 48) * ratio + 48}, ${(100 - 16) * ratio + 16}%, ${(87 - 57) * ratio +
                        57}%)`;
                    const stop = `${value}%`;
                    const end = `hsl(${value * 5 + 50}, 90%, 60%)`;
                    // hsl(170, 40%, 60%) => hsl(198, 63%, 38%)
                    // const color = `hsl(${value * 6 + 40}, 90%, 60%)`;
                    const color = `hsl(${(198 - 170) * ratio + 170}, ${(63 - 40) * ratio + 40}%, ${(38 - 60) * ratio +
                        60}%)`;
                    const scale = 0.1 * ratio + 0.3;
                    const rotation = 45 * ratio + 'deg';
                    const coords = [value, value];
                    const shape = interpolate(shapeFrom, shapeTo, ratio)
                        .map((v, idx) => '' + (prefixes[idx] || '') + v)
                        .join('') + ' Z';

                    return (
                        <div
                            style={{
                                ...styles.container,
                                // background: `linear-gradient(to bottom, ${start} ${stop}, ${end} 100%)`,
                                background: `${start}`,
                            }}
                        >
                            <svg
                                style={{
                                    ...styles.shape,
                                    transform: `scale3d(${scale}, ${scale}, ${scale}) rotate(${rotation}) translate3d(${
                                        coords[0]
                                    }px,${coords[1]}px,0)`,
                                }}
                                version="1.1"
                                viewBox="0 0 400 400"
                            >
                                <g style={{ cursor: 'pointer' }} fill={color} fillRule="evenodd" onClick={this.toggle}>
                                    <path id="path-1" d={shape} />
                                </g>
                            </svg>
                        </div>
                    );
                }}
            </Animation>
        );
    }
}
