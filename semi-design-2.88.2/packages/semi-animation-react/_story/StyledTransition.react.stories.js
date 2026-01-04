import React, { useState, Component, isValidElement, PureComponent } from 'react';
import ReactDOM from 'react-dom';
import { storiesOf } from '@storybook/react';
import { withKnobs, text, boolean } from '@storybook/addon-knobs';
import withPropsCombinations from 'react-storybook-addon-props-combinations';

import StyledTransition from '../lib/StyledTransition';

const stories = storiesOf('semi-animation-react/StyledTransition', module);

stories.addDecorator(withKnobs);

const bigSquareStyle = {
    backgroundColor: 'rgb(241, 101, 101)',
    width: 100,
    height: 100,
    margin: 20,
    marginLeft: 50,
    borderRadius: 4,
    fontSize: 16,
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
};

const printArgs = (...args) => console.log(...args);

const durations = ['200ms', '500ms', '750ms', '1s', '1.5s'];

stories.add('bounceInOut', () => {
    class App extends PureComponent {
        constructor(props = {}) {
            super(props);
        }

        state = { visible: true, duration: '500ms' };

        setVisible = visible => this.setState({ visible });

        setDuration = e => {
            this.setState({
                duration: e.target.value,
            });
        };
        render() {
            const { visible, duration } = this.state;

            return (
                <div>
                    <div>
                        <StyledTransition
                            duration={duration}
                            enter={'bounceIn'}
                            leave={'bounceOut'}
                            onFrame={() => console.log('frame')}
                            didEnter={() => console.log('enter')}
                            didLeave={() => console.log('leave')}
                        >
                            {visible
                                ? ({ animateCls, animateStyle, animateEvents }) => (
                                      <div
                                          style={{ ...animateStyle, ...bigSquareStyle }}
                                          className={animateCls}
                                          {...animateEvents}
                                          onAnimationIteration={() => console.log('onFrame')}
                                      >
                                          bounceInOut
                                      </div>
                                  )
                                : null}
                        </StyledTransition>
                    </div>
                    <div>
                        <button onClick={() => this.setVisible(true)}>入场</button>
                        <button onClick={() => this.setVisible(false)}>出场</button>
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
    }

    return <App />;
});
