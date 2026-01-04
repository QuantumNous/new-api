import { Modal, Button } from '@douyinfe/semi-ui';
import { Animation } from '@douyinfe/semi-animation-react';
import React from 'react';

export default class modalDemo extends React.Component {
    constructor() {
        super();
        this.state = { visible: false, reverse: false };
        this.showDialog = this.showDialog.bind(this);
        this.handleOk = this.handleOk.bind(this);
        this.handleCancel = this.handleCancel.bind(this);
    }

    showDialog() {
        this.setState({
            reverse: false,
            visible: true,
        });
    }

    handleOk(e) {
        this.setState({
            reverse: true,
        });
    }

    handleCancel(e) {
        this.setState({
            reverse: true,
        });
    }

    render() {
        let { reverse, visible } = this.state;

        return (
            <>
                <Button onClick={this.showDialog}>Open Modal</Button>
                <Animation
                    from={{ x: 0 }}
                    to={{ x: 1 }}
                    reverse={reverse}
                    reset={visible}
                    config={{ duration: 200, easing: reverse ? 'easeOutCubic' : 'easeInCubic' }}
                    onRest={() => {
                        if (reverse) {
                            this.setState({ visible: false });
                        }
                    }}
                >
                    {({ x }) => (
                        <Modal
                            title="自定义样式"
                            visible={this.state.visible}
                            onOk={this.handleOk}
                            onCancel={this.handleCancel}
                            style={{ top: '30vh', transform: `scale(${x}, ${x})` }}
                            maskStyle={{ backgroundColor: 'pink', opacity: '.3' }}
                            bodyStyle={{ backgroundColor: 'lightgrey' }}
                        >
                            <p>This is a modal with customized styles.</p>
                            <p>More content...</p>
                        </Modal>
                    )}
                </Animation>
            </>
        );
    }
}
