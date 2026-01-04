import React, { useState } from 'react';
import { Collapsible, Button } from '@douyinfe/semi-ui/';

class OldDemo extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            isOpen: false,
            isChildOpen: false,
            activeKey: '',
        };
        this.toggle = this.toggle.bind(this);
        this.toggleChild = this.toggleChild.bind(this);
    }

    toggle() {
        this.setState({ isOpen: !this.state.isOpen });
    }

    toggleChild() {
        this.setState({ isChildOpen: !this.state.isChildOpen });
    }

    render() {
        const { isOpen, isChildOpen } = this.state;
        const collapsed = (
            <ul key={2} >
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
                <Button onClick={this.toggle}>Toggle</Button>
                <br />
                <Collapsible
                    isOpen={isOpen}
                    keepDOM
                >
                    <div key={1} >
                        Semi Design的设计原则包括：<Button onClick={this.toggleChild}>Toggle List</Button>
                    </div>
                    <Collapsible isOpen={isChildOpen} >
                        {collapsed}
                    </Collapsible>
                </Collapsible>
            </div>
        );
    }
}

const Demo = () => {
    const [isOpen, setOpen] = useState(false);
    const [isChildOpen, setChildOpen] = useState(false);

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
    const toggle = () => {
        setOpen(!isOpen);
    };
    return (
        <div>
            <Button onClick={toggle}>Toggle</Button>
            <br />
            <Collapsible isOpen={isOpen}>
                <div>
                    <span>Semi Design的设计原则包括：</span>
                    <Button onClick={() => setChildOpen(!isChildOpen)}>Toggle List</Button>
                </div>
                <Collapsible isOpen={isChildOpen}>{collapsed}</Collapsible>
            </Collapsible>
        </div>
    );
};


export default Demo;
