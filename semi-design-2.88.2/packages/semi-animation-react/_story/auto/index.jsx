import React from 'react';
import { Animation } from '@douyinfe/semi-animation-react';
import './style.scss';

const LOREM = 'Hello world';

export default class App extends React.Component {
    state = { toggle: true, text: [LOREM] };

    onToggle = () => this.setState(state => ({ toggle: !state.toggle }));

    onAddText = () => this.setState(state => ({ toggle: true, text: [...state.text, LOREM] }));

    onRemoveText = () => this.setState(state => ({ toggle: true, text: state.text.slice(1) }));

    render() {
        const { toggle, text } = this.state;
        return (
            <div className="semi-animation-react-demo-auto">
                <div className="auto-main">
                    <button onClick={this.onToggle}>Toggle</button>
                    <button onClick={this.onAddText}>Add text</button>
                    <button onClick={this.onRemoveText}>Remove text</button>
                    <div className="content">
                        <Animation
                            force
                            config={{ duration: 200, easing: toggle ? 'easeInCubic' : 'easeOutCubic' }}
                            from={{ height: toggle ? 0 : 38 * text.length }}
                            to={{ height: toggle ? 38 * text.length : 0 }}
                        >
                            {props => (
                                <div className="item" style={props}>
                                    {text.map((t, i) => (
                                        <p key={i}>{t}</p>
                                    ))}
                                </div>
                            )}
                        </Animation>
                    </div>
                </div>
            </div>
        );
    }
}
