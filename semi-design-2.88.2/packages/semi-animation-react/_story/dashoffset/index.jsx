import React from 'react';
import { Animation } from '@douyinfe/semi-animation-react';
import { GradientPinkRed as Gradient } from '@vx/gradient';
import * as easings from 'd3-ease';

export default class App extends React.Component {
    state = { offset: 0 };

    path = React.createRef();

    componentDidMount() {
        this.setState({ offset: this.path.current.getTotalLength() });
    }

    render() {
        const { offset } = this.state;
        return (
            <div
                style={{
                    background: '#272727',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                }}
                onClick={() => this.forceUpdate()}
            >
                <svg width="180" viewBox="0 0 23 23">
                    <Gradient id="gradient-dashoffset" />
                    <g fill="#373737" stroke="url(#gradient-dashoffset)" strokeWidth="0.5">
                        <Animation
                            reset
                            from={{ dash: offset }}
                            to={{ dash: 0 }}
                            config={{
                                duration: 3000,
                                easing: easings.easeCubic,
                            }}
                        >
                            {props => (
                                <path
                                    ref={this.path}
                                    strokeDasharray={offset}
                                    strokeDashoffset={props.dash}
                                    d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
                                />
                            )}
                        </Animation>
                    </g>
                </svg>
            </div>
        );
    }
}
