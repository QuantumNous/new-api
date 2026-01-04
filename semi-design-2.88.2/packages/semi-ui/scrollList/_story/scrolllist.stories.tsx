import React from 'react';
import { storiesOf } from '@storybook/react';
import ScrollList from '../index';
import ScrollItem, {Item} from '../scrollItem';
import Button from '../../button';

const stories = storiesOf('scrollList', module);

interface SelectValue {
    type?: string;
    index?:number;
    value: any
}

class ScrollListDemo extends React.Component<{}, {
    selectIndex1: number,
    selectIndex2:number,
    selectIndex3:number,
    [x:string]:any,
}> {
    ampms : Item[];
    hours: Item[];
    minutes: Item[];

    constructor(props:any) {
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
                disabled: Math.random() > 0.5 ? true : false,
            };
        });

        this.onSelectAP = this.onSelectAP.bind(this);
        this.onSelectHour = this.onSelectHour.bind(this);
        this.onSelectMinute = this.onSelectMinute.bind(this);
        this.handleClose = this.handleClose.bind(this);
        this.renderFooter = this.renderFooter.bind(this);
    }

    onSelectAP(data: SelectValue) {
        this.setState({
            ['selectIndex' + data.type]: data.index,
        });
    }

    onSelectHour(data:SelectValue) {
        console.log('You have choose the hour for: ', data.value);
        this.setState({
            ['selectIndex' + data.type]: data.index,
        });
    }

    onSelectMinute(data:SelectValue) {
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
        const scrollStyle = {
            border: 'unset',
            boxShadow: 'unset',
        };
        return (
            <ScrollList style={scrollStyle} header={'无限滚动列表'} footer={this.renderFooter()}>
                <ScrollItem
                    mode="wheel"
                    cycled={false}
                    list={this.ampms}
                    type={1}
                    selectedIndex={this.state.selectIndex1}
                    onSelect={this.onSelectAP}
                />
                <ScrollItem
                    mode="wheel"
                    cycled={true}
                    list={this.hours}
                    type={2}
                    selectedIndex={this.state.selectIndex2}
                    onSelect={this.onSelectHour}
                />
                <ScrollItem
                    mode="wheel"
                    cycled={true}
                    list={this.minutes}
                    type={3}
                    selectedIndex={this.state.selectIndex3}
                    onSelect={this.onSelectMinute}
                />
            </ScrollList>
        );
    }
}


stories.add('wheel list demo', () => <ScrollListDemo />);