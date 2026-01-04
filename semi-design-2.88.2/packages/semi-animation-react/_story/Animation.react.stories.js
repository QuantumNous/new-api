import React, { useState, Component, isValidElement } from 'react';
import ReactDOM from 'react-dom';
import { storiesOf } from '@storybook/react';
import { withKnobs, text, boolean } from '@storybook/addon-knobs';
import withPropsCombinations from 'react-storybook-addon-props-combinations';

import { Animation } from '../index';

/** demos */
import SimpleAnimation from './simple';
import Morph from './morph';
import Auto from './auto';
import DashOffset from './dashoffset';
import Scroll from './scroll';

/** semi-ui components * */
import ModalAnimation from './semi-modal-animation';

/** semi-animation-react mock animate.css */
import BounceInAnimation from './animate-react/BounceIn';

const stories = storiesOf('semi-animation-react/Animation', module);

stories.addDecorator(withKnobs);

const itemStyle = {
    backgroundColor: 'rgb(241, 101, 101)',
    color: 'white',
    borderRadius: 4,
    padding: 10,
    textAlign: 'center',
};

const bigSquareStyle = {
    backgroundColor: 'rgb(241, 101, 101)',
    width: 100,
    height: 100,
    margin: 20,
    marginLeft: 50,
    borderRadius: 4,
    fontSize: 32,
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
};

stories.add('Animaiton', () => {
    class App extends Component {
        constructor(props) {
            super(props);

            this.state = {
                value: 0,
            };
        }

        onFrame = props => {
            const value = props.value.toFixed(2);
            this.setState({ value });
        };

        onStop = props => {
            console.log('onStop', props);
            const value = props.value.toFixed(2);
            this.setState({ value });
        };

        invokehandlerFn = (funcName, ...args) => {
            if (
                funcName
                && typeof funcName === 'string'
                && this.handler
                && this.handler[funcName]
                && typeof this.handler[funcName] === 'function'
            ) {
                console.log(this.handler);
                this.handler[funcName](...args);

                if (['reset', 'reverse'].includes(funcName)) {
                    this.handler.start();
                }
            }
        };

        render() {
            return (
                <Animation
                    autoStart
                    // immediate
                    ref={handler => (this.handler = handler)}
                    config={{ duration: 20000 }}
                    from={{ value: 0 }}
                    to={{ value: 10 }}
                    // onFrame={this.onFrame}
                    onStop={this.onStop}
                >
                    {props => {
                        const value = props.value.toFixed(2);
                        const hsl = `hsl(${value * 25 + 60}, 90%, 50%)`;
                        const x = 100 + 20 * value;
                        const y = 100 + 20 * Math.cos(value);
                        return (
                            <>
                                <div style={{ ...itemStyle, width: 300 }}>prop.value changed to: {value}</div>
                                <div style={{ ...bigSquareStyle }}>{value}</div>
                                <div style={{ height: 200, position: 'relative' }}>
                                    <span
                                        style={{
                                            ...itemStyle,
                                            left: x,
                                            top: y,
                                            position: 'absolute',
                                        }}
                                    >
                                        I'am a block.
                                    </span>
                                </div>
                                <div style={{ ...bigSquareStyle, width: 200, backgroundColor: hsl, fontSize: 16 }}>
                                    {hsl}
                                </div>
                                <div>
                                    {['reset', 'reverse', 'pause', 'resume', 'stop', 'end'].map(funcName => (
                                        <button
                                            key={funcName}
                                            onClick={(...args) => this.invokehandlerFn(funcName, ...args)}
                                        >
                                            {funcName}
                                        </button>
                                    ))}
                                </div>
                            </>
                        );
                    }}
                </Animation>
            );
        }
    }

    return <App />;
});

stories.add('SimpleAnimation', () => <SimpleAnimation />);

stories.add('Morph', () => <Morph />);

stories.add('Auto', () => <Auto />);

stories.add('DashOffset', () => <DashOffset />);

stories.add('Scroll', () => <Scroll />);

stories.add('Semi-ModalAnimation', () => <ModalAnimation />);

stories.add('BounceInAnimation', () => (
    <BounceInAnimation>
        {(currentStyle = {}) => <div style={{ ...bigSquareStyle, fontSize: 16, ...currentStyle }}>BounceIn</div>}
    </BounceInAnimation>
));
