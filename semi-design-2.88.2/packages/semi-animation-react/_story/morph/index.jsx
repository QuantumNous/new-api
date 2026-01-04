import React from 'react';
import { Animation } from '@douyinfe/semi-animation-react';

import { interpolate as flubberInterpolate } from 'flubber';
import { GradientPinkRed as Gradient } from '@vx/gradient';

const paths = [
    'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
    'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
    'M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z',
    'M7 2v11h3v9l7-12h-4l4-8z',
    'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z',
    'M17.4112 7.30848C18.0693 7.81171 18.1948 8.75312 17.6915 9.41119L11.1915 17.9112C10.9091 18.2806 10.4712 18.4981 10.0062 18.5C9.54111 18.5019 9.10149 18.288 8.81598 17.9209L5.31598 13.4209C4.80737 12.767 4.92518 11.8246 5.5791 11.316C6.23302 10.8074 7.17543 10.9252 7.68404 11.5791L9.98994 14.5438L15.3085 7.58884C15.8117 6.93077 16.7531 6.80525 17.4112 7.30848Z',
    'M5 12.5C5 11.6716 5.67157 11 6.5 11H17.5C18.3284 11 19 11.6716 19 12.5C19 13.3284 18.3284 14 17.5 14H6.5C5.67157 14 5 13.3284 5 12.5Z',
];

const interpolators = [];
for (let i = 0; i < paths.length; i++) {
    interpolators.push(flubberInterpolate(paths[i], paths[i + 1] || paths[0], { maxSegmentLength: 0.1 }));
}

export default class App extends React.Component {
    state = { interpolators, index: 0 };

    goNext = () => this.setState(({ index, interpolators }) => ({
        index: index + 1 >= interpolators.length ? 0 : index + 1,
    }));

    render() {
        const { interpolators, index } = this.state;
        const interpolator = interpolators[index];
        return (
            <div
                style={{
                    background: '#F3FFBD',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                }}
            >
                <svg width="180" viewBox="0 0 22 22">
                    <Gradient id="gradient-morph" />
                    <g fill="url(#gradient-morph)">
                        <Animation
                            forwardInstance={handler => (this.handler = handler)}
                            reset
                            from={{ t: 0 }}
                            to={{ t: 1 }}
                            onRest={this.goNext}
                        >
                            {({ t }) => <path d={interpolator(t)} />}
                        </Animation>
                    </g>
                </svg>
            </div>
        );
    }
}
