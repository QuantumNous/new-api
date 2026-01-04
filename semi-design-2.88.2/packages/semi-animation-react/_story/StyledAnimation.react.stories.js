import React, { useState, Component, isValidElement } from 'react';
import ReactDOM from 'react-dom';
import { storiesOf } from '@storybook/react';
import { withKnobs, text, boolean } from '@storybook/addon-knobs';
import withPropsCombinations from 'react-storybook-addon-props-combinations';

import {
    types
} from '@douyinfe/semi-animation-styled';
import StyledAnimation from '../lib/StyledAnimation';

/** semi-ui demos */
import SemiCollapseAnimation from './semi-collapse-animation-styled';

const stories = storiesOf('semi-animation-react/StyledAnimation', module);

stories.addDecorator(withKnobs);

const {
    bouncingEntrances,
    bouncingExits,
    fadingEntrances,
    fadingExits,
    rotatingEntrances,
    rotatingExits,
    slidingEntrances,
    slidingExits,
    zoomingEntrances,
    zoomingExits,
} = types;

const rectStyle = {
    backgroundColor: 'rgb(241, 101, 101)',
    padding: '20px',
    // width: '200px',
    // height: '100px',
    margin: '20px',
    marginLeft: '50px',
    borderRadius: '4px',
    fontSize: '20px',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
};

const bgContainerStyle = { border: '1px solid gray', backgroundColor: 'tan', borderRadius: 4, marginBottom: 10 };

const itemStyle = {
    backgroundColor: 'rgb(241, 101, 101)',
    color: 'white',
    borderRadius: '4px',
    padding: '10px',
    textAlign: 'center',
};

const durations = ['200ms', '500ms', '750ms', '1s', '1.5s'];

const containerStyle = { display: 'flex', width: '960px', flexWrap: 'wrap' };

const printArgs = (...args) => console.log(...args);

class AnimItem extends Component {
    state = {
        type: undefined,
        duration: '500ms',
        speed: 'faster',
    };

    constructor(props = {}) {
        super(props);
    }

    componentDidMount() {
        this.setState({
            type: this.props.enterType,
        });
    }

    _reset = () => {
        let currentType = this.state.type;
        this.setState(
            {
                type: undefined,
            },
            () => {
                this.setState({
                    type: currentType,
                });
            }
        );
    };

    setSpeed = e => {
        this.setState({
            speed: e.target.value,
        });
        this._reset();
    };

    setDuration = e => {
        this.setState({
            duration: e.target.value,
        });

        this._reset();
    };

    enter = () => {
        this.setState(
            {
                type: undefined,
            },
            () =>
                this.setState({
                    type: this.props.enterType,
                })
        );
    };

    leave = () => {
        this.setState(
            {
                type: undefined,
            },
            () =>
                this.setState({
                    type: this.props.leaveType,
                })
        );
    };

    render() {
        let { type, speed, duration } = this.state;

        let { children } = this.props;

        if (type) {
            return (
                <div style={bgContainerStyle}>
                    <div style={containerStyle}>
                        <StyledAnimation
                            key={type}
                            type={type}
                            speed={speed}
                            duration={duration}
                            // loop="infinite"
                            // className={`semi-${type} semi-animated semi-duration-slow semi-count-infinite`}
                            onStart={printArgs}
                            onRest={printArgs}
                        >
                            {({ animateCls, animateStyle, animateEvents }) =>
                                typeof children === 'function' ? (
                                    children(animateCls)
                                ) : (
                                    <div
                                        className={animateCls}
                                        style={{ ...rectStyle, ...animateStyle }}
                                        {...animateEvents}
                                        // onAnimationStart={(...args) => console.log(...args)}
                                    >
                                        {type}
                                    </div>
                                )
                            }
                        </StyledAnimation>
                    </div>
                    <div>
                        <button onClick={this.enter}>入场</button>
                        <button onClick={this.leave}>离场</button>
                        {/* <div style={{ display: 'inline-flex', marginLeft: 10, alignItems: 'center' }}>
                            <label>速度：</label>
                            <select onChange={this.setSpeed}>
                                {speeds.map(speedVal => (
                                    <option
                                        selected={speedVal === speed}
                                        key={speedVal}
                                        label={speedVal}
                                        value={speedVal}
                                    />
                                ))}
                            </select>
                        </div> */}
                        <div style={{ display: 'inline-flex', marginLeft: 10, alignItems: 'center' }}>
                            <label>持续时长：</label>
                            <select onChange={this.setDuration}>
                                {durations.map(itDur => (
                                    <option selected={duration === itDur} key={itDur} label={itDur} value={itDur} />
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            );
        }

        return null;
    }
}

stories.add('bounce', () =>
    bouncingEntrances.map((type, idx) => <AnimItem key={type} enterType={type} leaveType={bouncingExits[idx]} />)
);
stories.add('fading', () =>
    fadingEntrances.map((type, idx) => <AnimItem key={type} enterType={type} leaveType={fadingExits[idx]} />)
);
stories.add('rotating', () =>
    rotatingEntrances.map((type, idx) => <AnimItem key={type} enterType={type} leaveType={rotatingExits[idx]} />)
);
stories.add('sliding', () =>
    slidingEntrances.map((type, idx) => <AnimItem key={type} enterType={type} leaveType={slidingExits[idx]} />)
);
stories.add('zooming', () =>
    zoomingEntrances.map((type, idx) => <AnimItem key={type} enterType={type} leaveType={zoomingExits[idx]} />)
);

stories.add('SemiCollapseAnimation', () => <SemiCollapseAnimation />);
