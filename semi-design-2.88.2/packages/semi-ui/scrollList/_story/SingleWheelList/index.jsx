import { ScrollList, ScrollItem, Button } from '@douyinfe/semi-ui';
import React from 'react';

class SingleScrollListDemo extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            selectIndex3: -2,
        };

        this.minutes = new Array(60).fill(0).map((itm, index) => {
            return {
                value: index,
                disabled: index % 2 === 1 ? true : false,
            };
        });
        this.onSelectMinute = this.onSelectMinute.bind(this);
        this.handleClose = this.handleClose.bind(this);
        this.renderFooter = this.renderFooter.bind(this);
    }


    onSelectMinute(data) {
        console.log('You have choose the minute for: ', data.value);
        this.setState({
            ['selectIndex' + data.type]: data.index,
        });
    }

    handleClose() {
        console.log('close');
    }

    renderFooter() {
        return (
            <Button size="small" type="primary" onClick={this.handleClose}>
                Ok
            </Button>
        );
    }

    render() {
        let list = this.list;
        const scrollStyle = {
            border: 'unset',
            boxShadow: 'unset',
        };
        const commonProps = {
            // mode: 'normal',
            mode: 'wheel',
            cycled: false,
            motion: false,
        };
        return (
            <div>
                <ScrollList style={scrollStyle} header={'单个无限滚动列表'} footer={this.renderFooter()}>
                    <ScrollItem
                        {...commonProps}
                        list={this.minutes}
                        type={3}
                        selectedIndex={this.state.selectIndex3}
                        onSelect={this.onSelectMinute}
                        aria-label="分钟"
                        cycled
                    />
                </ScrollList>
            </div>
        );
    }
}

export default SingleScrollListDemo;
