import { ScrollList, ScrollItem, Button } from '@douyinfe/semi-ui';
import React from 'react';

class ScrollListDemo extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            selectIndex1: 1,
            selectIndex2: 1,
            selectIndex3: 1,
        };

        this.list = new Array(20).fill(0).map((itm, index) => {
            return { value: index };
        });
    }

    onSelect = event => {
        this.setState({
            ['selectIndex' + event.type]: event.value,
        });
    };

    handleClose = () => {
        console.log('close');
    };

    renderFooter = () => {
        return (
            <Button size="small" type="primary" onClick={this.handleClose}>
                Ok
            </Button>
        );
    };

    render() {
        let list = this.list;
        return (
            <ScrollList header={'hello world'} footer={this.renderFooter()}>
                <ScrollItem
                    mode="normal"
                    list={list}
                    type={1}
                    selectedIndex={this.state.selectIndex1}
                    onSelect={this.onSelect}
                    aria-label="1"
                />
                <ScrollItem
                    mode="normal"
                    list={list}
                    type={2}
                    selectedIndex={this.state.selectIndex2}
                    onSelect={this.onSelect}
                    aria-label="2"
                />
                <ScrollItem
                    mode="normal"
                    list={list}
                    type={3}
                    selectedIndex={this.state.selectIndex3}
                    onSelect={this.onSelect}
                    aria-label="3"
                />
            </ScrollList>
        );
    }
}

export default ScrollListDemo;
