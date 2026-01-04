import React, { Component } from 'react';
import { Modal, Collapsible, Button, Table } from '@douyinfe/semi-ui';

class Demo extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            isOpen: false,
            visible: false,
            content: null,
            contentIndex: 0
        };
        this.showDialog = this.showDialog.bind(this);
        this.handleOk = this.handleOk.bind(this);
        this.handleCancel = this.handleCancel.bind(this);
        this.toggle = this.toggle.bind(this);
        this.changeContent = this.changeContent.bind(this);
        this.contents = [
            <ul key="ul">
                <li>
                    <p>Semi Design 以内容优先进行设计。</p>
                </li>
                <li>
                    <p>更容易地自定义主题。</p>
                </li>
            </ul>,
            <Table key="table" columns={[
                {
                    title: 'Name',
                    dataIndex: 'name',
                    width: 150,
                    render: (text, record) => text,
                },
                {
                    title: 'Age',
                    dataIndex: 'age',
                    width: 150,
                    render: (text, record) => text,
                },
                {
                    title: 'Address',
                    dataIndex: 'address',
                    render: (text, record) => text,
                },
                {
                    render: (text, record) => (
                        <p>Show Info</p>
                    ),
                    width: 150,
                },
            ]} /> 
        ];
    }
    showDialog() {
        this.setState({
            visible: true,
        });
    }
    handleOk(e) {
        this.setState({
            visible: false,
        });
    }
    handleCancel(e) {
        this.setState({
            visible: false,
        });
    }
    toggle() {
        this.setState({ isOpen: !this.state.isOpen });
    }
    changeContent() {
        this.setState({
            contentIndex: (this.state.contentIndex + 1) % this.contents.length,
        });
    }
    componentDidMount() {
        this.changeContent();
    }

    render() {
        const { isOpen, content, contentIndex } = this.state;
        return (
            <div>
                <Button onClick={this.showDialog}>打开弹窗</Button>
                <Modal
                    title="基本对话框"
                    visible={this.state.visible}
                    onOk={this.handleOk}
                    onCancel={this.handleCancel}
                >
                    <Button onClick={this.toggle}>Toggle</Button>
                    <Button onClick={() => this.changeContent()}>Change Content</Button>
                    <Collapsible isOpen={isOpen}>{this.contents[contentIndex]}</Collapsible>
                </Modal>
            </div>
        );
    }
}
export default () => <Demo />;
