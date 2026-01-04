import React from 'react';
import { debounce } from 'lodash';
import { AutoComplete, Icon, Button } from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';

export default class ObjectDemo extends React.Component {
    constructor() {
        super();
        this.state = {
            list: [
                {
                    value: 'douyin',
                    label: 'douyin',
                    email: '1@gmail.com',
                    type: 2,
                },
                {
                    value: 'hotsoon',
                    label: 'huoshan',
                    email: '2@gmail.com',
                    type: 3,
                },
                {
                    value: 'pipixia',
                    label: 'pip',
                    email: '3@gmail.com',
                },
            ],
            loading: false,
        };
        this.onSearch = this.onSearch.bind(this);
        this.handleSelect = this.handleSelect.bind(this);
        this.renderItem = this.renderItem.bind(this);
        this.renderSelectedItem = this.renderSelectedItem.bind(this);
        this.search = debounce(this.search.bind(this), 200);
    }

    onSearch(inputValue) {
        this.setState({
            loading: true,
        });
        this.search(inputValue);
    }

    search(inputValue) {
        let { list } = this.state;
        const newList = list.map(item => {
            let num = Math.random()
                .toString()
                .slice(2, 5);
            let option = `${inputValue }-${ num}`;
            return { ...item, label: `名称:${ option}`, value: option };
        });
        this.setState({
            list: newList,
            loading: false,
        });
    }

    handleSelect(value) {
        console.log(value);
    }

    renderItem(item) {
        return (
            <div>
                <div>{item.label}</div>
                <div>email: {item.email}</div>
                <div
                    style={{
                        color: 'pink',
                    }}
                >
                    value: {item.value}
                </div>
            </div>
        );
    }

    renderSelectedItem(item) {
        // 注意：与Select不同，此处只能返回String类型的值，不能返回ReactNode
        return item.value;
    }

    render() {
        const { loading } = this.state;
        return (
            <div>
                <AutoComplete
                    data={this.state.list}
                    style={{
                        width: 250,
                    }}
                    prefix={<IconSearch />}
                    onSearch={this.onSearch}
                    loading={loading}
                    onChangeWithObject
                    renderItem={this.renderItem}
                    renderSelectedItem={this.renderSelectedItem}
                    onSelect={this.handleSelect}
                    triggerRender={({ value, inputValue, onFocus }) => <Button onFocus={onFocus}>{inputValue}</Button>}
                />
            </div>
        );
    }
}
