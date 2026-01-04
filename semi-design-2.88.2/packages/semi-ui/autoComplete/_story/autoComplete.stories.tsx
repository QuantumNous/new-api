import React from 'react';
import { storiesOf } from '@storybook/react';
import AutoComplete from '../index';
import { Avatar } from '../../index';

const stories = storiesOf('AutoComplete', module);

stories.add('Paginationdefault', () => (
    <>
        <AutoComplete data={[1, 2, '2']} onSelect={v => console.log(v)}/>
    </>
));


import { IconSearch } from '@douyinfe/semi-icons';

interface Person {
    name: string;
    email: string;
    abbr: string;
    color: string;
}

type Color = 'amber' | 'indigo' | 'cyan';
interface DemoState {
    data: Person[];
    color: Color[];
    list: Person[];
}
class CustomOptionDemo extends React.Component<Record<string, any>, DemoState> {
    constructor(props) {
        super(props);
        this.state = {
            data: [],
            color: ['amber', 'indigo', 'cyan'],
            list: [
                { name: '夏可漫', email: 'xiakeman@example.com', abbr: 'XK', color: 'amber' },
                { name: '申悦', email: 'shenyue@example.com', abbr: 'SY', color: 'indigo' },
                { name: '曲晨一', email: 'quchenyi@example.com', abbr: 'CY', color: 'blue' },
                { name: '文嘉茂', email: 'wenjiamao@example.com', abbr: 'JM', color: 'cyan' },
            ],
        };
    }

    search(value) {
        let result;
        if (value) {
            result = this.state.list.map(item => {
                return { ...item, value: item.name, label: item.email };
            });
        } else {
            result = [];
        }
        this.setState({ data: result });
    }

    renderOption(item) {
        let optionStyle = {
            display: 'flex',
        };
        return (
            <>
                <Avatar color={item.color} size="small">
                    {item.abbr}
                </Avatar>
                <div style={{ marginLeft: 4 }}>
                    <div style={{ fontSize: 14, marginLeft: 4 }}>{item.name}</div>
                    <div style={{ marginLeft: 4 }}>{item.email}</div>
                </div>
            </>
        );
    }

    render() {
        return (
            <AutoComplete<Person>
                data={this.state.data}
                prefix={<IconSearch />}
                style={{ width: '250px' }}
                renderSelectedItem={option => option.email}
                renderItem={this.renderOption}
                onSearch={this.search.bind(this)}
                onSelect={v => console.log(v)}
            ></AutoComplete>
        );
    }
}
