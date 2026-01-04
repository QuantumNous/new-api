import React, { useState, Component, isValidElement } from 'react';
import ReactDOM from 'react-dom';
import { storiesOf } from '@storybook/react';
import { withKnobs, text, boolean } from '@storybook/addon-knobs';
import withPropsCombinations from 'react-storybook-addon-props-combinations';

import noop from '../utils/noop';
import { Animation } from '../index';

const stories = storiesOf('semi-animation/jsAnimation-react', module);

stories.addDecorator(withKnobs);

class Anim extends Component {
    static defaultProps = {
        onStart: noop,
        onFrame: noop,
        onPause: noop,
        onResume: noop,
        onStop: noop,
        onRest: noop,
    };

    constructor(props = {}) {
        super(props);
        this.initAnimation();
        this.bindEvents();
    }

    bindEvents = () => {
        this.pause = () => {
            this.animation.pause();
        };

        this.stop = () => {
            this.animation.stop();
        };

        this.resume = () => {
            this.animation.resume();
        };

        this.reset = () => {
            this.animation.reset();
            this.animation.start();
        };

        this.reverse = () => {
            this.animation.reverse();
            this.animation.start();
        };

        this.end = () => {
            this.animation.end();
        }
    };

    initAnimation = () => {
        const props = this.props;
        this.animation = new Animation(
            {
                from: { ...props.from },
                to: { ...props.to },
            },
            {
                ...props.config,
            }
        );

        ['start', 'frame', 'pause', 'resume', 'stop', 'rest'].forEach(event => {
            const propName = `on${event[0].toUpperCase() + event.slice(1)}`;
            this.animation.on(event, props => this.props[propName](props));
        });
    };

    componentDidMount() {
        this.animation.start();
    }

    componentWillUnmount() {
        this.animation.destroy();
    }

    render() {
        let { children } = this.props;
        return (
            <div>
                <div>{children}</div>
                <div>
                    <button onClick={this.reset}>reset</button>
                    <button onClick={this.reverse}>reverse</button>
                    <button onClick={this.pause}>pause</button>
                    <button onClick={this.resume}>resume</button>
                    <button onClick={this.end}>end</button>
                    <button onClick={this.stop}>stop</button>
                </div>
            </div>
        );
    }
}

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

stories.add('motion', () => {
    class App extends Component {
        constructor(props) {
            super(props);

            this.state = {
                value: 0,
            };

            this.onFrame = props => {
                const value = props.value.toFixed(2);
                this.setState({ value });
            };

            this.onStop = props => {
                console.log('onStop', props);
                const value = props.value.toFixed(2);
                this.setState({ value });
            };
        }

        render() {
            const { value } = this.state;
            const ratio = value / 10;

            // hsl(280, 43%, 62%) => hsl(0, 83%, 67%)
            const bgColor = `hsl(${-280 * ratio + 280}, ${40 * ratio + 43}%, ${5 * ratio + 62}%)`;
            const scale = `scale(${ratio}, ${ratio})`;
            const hsl = `hsl(${value * 25 + 60}, 90%, 50%)`;
            const x = 100 + 20 * value;
            const y = 100 + 20 * Math.cos(value);

            return (
                <Anim from={{ value: 0 }} to={{ value: 10 }} config={{ duration: 20000 }} onFrame={this.onFrame} onStop={this.onStop}>
                    <div style={{ ...itemStyle, width: 300 }}>prop.value changed to: {value}</div>
                    <div style={{ ...bigSquareStyle, transform: scale }}>{value}</div>
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
                    <div style={{ ...bigSquareStyle, width: 200, backgroundColor: hsl, fontSize: 16 }}>{hsl}</div>
                </Anim>
            );
        }
    }

    return <App />;
});

stories.add('bezier-easing', () => {
    class BezierApp extends Component {
        constructor(props) {
            super(props);

            this.state = {
                value: 0,
            };

            this.onFrame = props => {
                const value = props.value.toFixed(2);
                this.setState({ value });
            };
        }

        render() {
            let { value } = this.state;

            let { config = { easing: 'linear' } } = this.props;

            const x = 100 + 20 * value;
            const y = 100 + 20 * Math.cos(value);

            return (
                <div style={{ border: '1px solid gray', backgroundColor: 'tan', borderRadius: 4, marginBottom: 10 }}>
                    <Anim from={{ value: 0 }} to={{ value: 10 }} onFrame={this.onFrame} config={config}>
                        <div style={{ padding: 5 }}>bezier: {config.easing}</div>
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
                    </Anim>
                </div>
            );
        }
    }

    const prefix = 'ease';
    const curves = ['In', 'Out', 'InOut'];
    const names = ['Quad', 'Cubic', 'Quart', 'Quint', 'Sine', 'Expo', 'Circ', 'Back', 'Elastic'];
    const apps = [<BezierApp key={0} config={{ easing: 'linear', duration: 2000 }} />];

    curves.forEach((curve, curveIdx) => {
        names.forEach((name, nameIdx) => {
            let easing = `${prefix}${curve}${name}`;

            if (name === 'Elastic') {
                easing += '(1, .5)';
            }

            apps.push(<BezierApp key={`${curveIdx}-${nameIdx}`} config={{ easing, duration: 2000 }} />);
        });
    });

    apps.push(<BezierApp key={'mybezier-1'} config={{ easing: 'cubic-bezier(.13,.85,.82,.44)', duration: 2000 }} />);

    return <>{apps}</>;
});


stories.add('simple', () => {
    class App extends Component {
        constructor(props) {
            super(props);
            this.state = { value: 0 };

            this.animation = new Animation({
                from: { value: 0 },
                to: { value: 1 },
            });

            this.animation.on('frame', props => {
                this.setState({ value: props.value.toFixed(2) });
            });
        }

        componentDidMount() {
            this.animation.start();
        }

        componentWillUnmount() {
            this.animation.destroy();
        }

        render() {
            const { value } = this.state;

            return <div style={{ display: 'inline-block', transform: `scale(${value})` }}>{value}</div>;
        }
    }

    return <div style={{ padding: 150 }}><App/></div>
})