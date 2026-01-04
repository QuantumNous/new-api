import React from 'react';
// import { Spring, animated, config } from 'react-spring/renderprops';
import { Animation, presets } from '@douyinfe/semi-animation-react';
import './style.scss';

const COLORS = ['crimson', 'teal', 'coral', 'hotpink', 'skyblue', 'salmon', 'seagreen', 'peachpuff'];

export default class App extends React.Component {
    state = { y: 0 };

    el = React.createRef();

    spring = React.createRef();

    setY = () => {
        console.log('setY');
        this.setState({ y: Math.round(Math.random() * 750) + 50 });
    };

    doScroll = (node, y) => {
        // eslint-disable-next-line eqeqeq
        if (node && y != null) {
            node.scrollTop = y;
        }
    };

    // User interaction should stop animation in order to prevent scroll-hijacking
    // Doing this on onWheel isn't enough, but just to illustrate ...
    stop = () => this.spring.current.stop();

    render() {
        const y = this.el.current ? this.el.current.scrollTop : 0;
        return (
            <div className="semi-animation-react-demo-scroll">
                <div className="scrolltop-main">
                    <Animation
                        ref={this.spring}
                        reset
                        from={{ y }}
                        to={{ y: this.state.y }}
                        config={presets.slow}
                        onFrame={({ y }) => {
                            this.doScroll(this.el.current, y);
                        }}
                    />
                    <div className="scrolltop-c" ref={this.el} onWheel={this.stop}>
                        {COLORS.map(c => (
                            <div key={c} style={{ height: 200, background: c }} />
                        ))}
                    </div>
                </div>
                <div className="scrolltop-b" onClick={this.setY} />
            </div>
        );
    }
}
