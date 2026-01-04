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

        this.ampms = [
            {
                value: '上午',
            },
            {
                value: '下午',
            },
        ];

        this.hours = new Array(12).fill(0).map((itm, index) => {
            return {
                value: index + 1,
            };
        });

        this.minutes = new Array(60).fill(0).map((itm, index) => {
            return {
                value: index,
                disabled: index % 2 === 1 ? true : false,
            };
        });

        this.onSelectAP = this.onSelectAP.bind(this);
        this.onSelectHour = this.onSelectHour.bind(this);
        this.onSelectMinute = this.onSelectMinute.bind(this);
        this.handleClose = this.handleClose.bind(this);
        this.renderFooter = this.renderFooter.bind(this);
    }

    onSelectAP(data) {
        this.setState({
            ['selectIndex' + data.type]: data.index,
        });
    }

    onSelectHour(data) {
        console.log('You have choose the hour for: ', data.value);
        this.setState({
            ['selectIndex' + data.type]: data.index,
        });
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
            motion: true,
        };
        return (
            <div>
                <ScrollList style={scrollStyle} header={'无限滚动列表'} footer={this.renderFooter()}>
                    <ScrollItem
                        {...commonProps}
                        list={this.ampms}
                        type={1}
                        selectedIndex={this.state.selectIndex1}
                        onSelect={this.onSelectAP}
                        aria-label="时段"
                    />
                    <ScrollItem
                        {...commonProps}
                        list={this.hours}
                        type={2}
                        selectedIndex={this.state.selectIndex2}
                        onSelect={this.onSelectHour}
                        aria-label="小时"
                    />
                    <ScrollItem
                        {...commonProps}
                        list={this.minutes}
                        type={3}
                        selectedIndex={this.state.selectIndex3}
                        onSelect={this.onSelectMinute}
                        aria-label="分钟"
                    />
                </ScrollList>
            </div>
        );
    }
}

export default ScrollListDemo;
