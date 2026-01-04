import React from 'react';
import Collapsible from '../index';
import Button from '../../button/Button';

class Demo extends React.Component {
    state = {
        isOpen: false,
    };

    toggle = () => {
        this.setState({ isOpen: !this.state.isOpen });
    };

    render() {
        const { isOpen } = this.state;
        const collapsed = (
            <ul>
                <li>
                    <p>Semi Design 以内容优先进行设计。</p>
                </li>
                <li>
                    <p>更容易地自定义主题。</p>
                </li>
                <li>
                    <p>适用国际化场景。</p>
                </li>
                <li>
                    <p>效率场景加入人性化关怀。</p>
                </li>
            </ul>
        );
        return (
            <div>
                <Button onClick={() => this.toggle()}>显示更多</Button>
                <Collapsible isOpen={isOpen}>{collapsed}</Collapsible>
            </div>
        );
    }
}

export default Demo;