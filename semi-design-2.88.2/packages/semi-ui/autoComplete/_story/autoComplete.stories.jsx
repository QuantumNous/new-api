import React, { Component, useState } from 'react';

import CustomTrigger from './CustomTrigger';
import AutoComplete from '../index';
import { Form, Avatar } from '../../index';
import { IconSearch } from '@douyinfe/semi-icons';
import { debounce } from 'lodash';

export default {
    title: 'AutoComplete',
    parameters: {
        chromatic: { disableSnapshot: true },
    },
};

const props = {
    onBlur: (v, e) => {
        console.log('onBlur');
        console.log(v, e);
    },
    onFocus: (v, e) => {
        console.log('onFocus');
        console.log(v, e);
    },
};

class Demo extends React.Component {
    constructor() {
        super();
        this.state = {
            data: [],
            data2: ['mike', 'tony', 'steve'],
        };
        this.acref = React.createRef();
    }

    handleSearch(value) {
        // let data =  !value ? [] : [value, value + value, value + value + value];
        let result; // if (!value || value.indexOf('@') >= 0) {
        //     result = [];
        // } else {

        if (value) {
            result = ['gmail.com', '163.com', 'qq.com'].map(domain => `${value}@${domain}`);
        } else {
            result = [];
        } // }

        this.setState({
            data: result,
        });
    }

    handleSearch2(value) {
        // let data2 =  !value ? [] : [value, value + value, value + value + value];
        let result;

        if (!value || value.indexOf('@') >= 0) {
            result = [];
        } else {
            result = ['gmail.com', '163.com', 'qq.com'].map(domain => `${value}@${domain}`);
        }

        this.setState({
            data2: result,
        });
    }

    render() {
        const { data, data2 } = this.state;
        return (
            <div>
                <AutoComplete
                    placeholder="fe"
                    className="test-ac"
                    prefix={<IconSearch />}
                    showClear
                    data={data}
                    style={{
                        width: 300,
                    }}
                    onSearch={this.handleSearch.bind(this)}
                    onSelect={v => console.log(v)}
                    {...props}
                    ref={this.acref}
                />
            </div>
        );
    }
}

export const BasicUsage = () => <Demo />;

class CustomOptionDemo extends Component {
    constructor(props) {
        super(props);
        this.state = {
            data: [],
            data2: [],
        };
    }

    search = value => {
        let result;

        if (!value) {
            result = [];
        } else {
            result = ['gmail.com', '163.com', 'qq.com'].map(domain => `${value}@${domain}`);
        }

        this.setState({
            data: result,
        });
    };
    renderOption = item => {
        return (
            <>
                <span
                    style={{
                        color: 'pink',
                    }}
                >
                    邮箱
                </span>
                : <span>{item}</span>
            </>
        );
    };
    search2 = value => {
        let result;

        if (!value) {
            result = [];
        } else {
            result = ['gmail.com', '163.com', 'qq.com'].map(domain => {
                return {
                    email: `${value}@${domain}`,
                    time: new Date().valueOf(),
                    value: `${value}@${domain}`,
                };
            });
        }

        this.setState({
            data2: result,
        });
    };
    renderObjectOption = item => {
        return (
            <div>
                <span
                    style={{
                        color: 'pink',
                    }}
                >
                    邮箱
                </span>
                : <span>{item.email}</span>
                <span>time</span>: <span>{item.time}</span>
            </div>
        );
    };

    render() {
        return (
            <>
                <AutoComplete
                    showClear
                    data={this.state.data}
                    renderItem={this.renderOption}
                    style={{
                        width: '250px',
                    }}
                    onSearch={this.search}
                ></AutoComplete>
                <br />
                <br />
                <AutoComplete
                    onChangeWithObject
                    style={{
                        width: '250px',
                    }}
                    renderItem={this.renderObjectOption}
                    renderSelectedItem={node => node.email}
                    data={this.state.data2}
                    onSearch={this.search2}
                />
            </>
        );
    }
}

export const RenderItem = () => <CustomOptionDemo />;

class WithDefaultValue extends React.Component {
    constructor() {
        super();
        this.state = {
            data: ['semi@bytedance.com', 'semi@gmail.com', 'semi@163.com'],
        };
        this.onSearch = this.onSearch.bind(this);
    }
    onSearch(value) {
        let result;

        if (!value) {
            result = [];
        } else {
            result = ['gmail.com', '163.com', 'qq.com'].map(domain => `${value}@${domain}`);
        }

        this.setState({
            data: result,
        });
    }

    render() {
        let { data } = this.state;
        return (
            <>
                {/* <AutoComplete
           defaultValue='semi@bytedance.com'
           data={data}
           onSearch={this.onSearch}
        /> */}

                <AutoComplete defaultValue="semi" data={data} onSearch={this.onSearch} />
            </>
        );
    }
}

export const DefaultValue = () => <WithDefaultValue />;

class ControlledMode extends React.Component {
    constructor() {
        super();
        this.state = {
            data: [],
            dataObject: [],
            value: '',
        };
        this.onSearch = this.onSearch.bind(this);
        this.onChange = this.onChange.bind(this);
    }

    onSearch(value) {
        let result, resultObject;

        if (!value) {
            result = [];
            resultObject = [];
        } else {
            result = ['gmail.com', '163.com', 'qq.com'].map(domain => `${value}@${domain}`);
            resultObject = ['gmail.com', '163.com', 'qq.com'].map(domain => ({
                label: `${value}@${domain}`,
                value: `${value}@${domain}`,
            }));
        }

        this.setState({
            data: result,
            dataObject: resultObject,
        });
    }

    onChange(value) {
        this.setState({
            value: value,
        });
    }

    render() {
        let { data, value, dataObject } = this.state;
        return (
            <>
                <AutoComplete
                    showClear
                    value={value}
                    data={data}
                    onChange={this.onChange}
                    onSearch={this.onSearch}
                    style={{
                        width: 200,
                    }}
                />
                <br />
                <AutoComplete
                    showClear
                    value={value}
                    data={dataObject}
                    onChange={this.onChange}
                    onSearch={this.onSearch}
                    style={{
                        width: 200,
                    }}
                />
                <br />
                <AutoComplete
                    defaultValue={'hello semi'}
                    showClear
                    value={value}
                    data={dataObject}
                    onChange={this.onChange}
                    onSearch={this.onSearch}
                    style={{
                        width: 200,
                    }}
                />
            </>
        );
    }
}

export const EmptyContent = () => {
    let [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchData = v => {
        setLoading(true);
        setTimeout(() => {
            if (!v) {
                setData([]);
                setLoading(false);
                return;
            }

            setData(() => {
                const res = Array.from(Array(5)).map(c => Math.random());
                return res;
            });
            setLoading(false);
        }, 1000);
    };

    return <AutoComplete loading={loading} data={data} emptyContent={'空数据'} onSearch={fetchData} />;
};

export const AutoFocus = () => {
    return <AutoComplete autoFocus />;
};

export const ControlledValue = () => <ControlledMode />;

export const CustomTriggerDemo = () => <CustomTrigger />;

export const Disabled = () => <AutoComplete disabled />;

export const KeyDown = () => (
    <AutoComplete
        onKeyDown={e => {
            console.log('onKeyDown', e.keyCode);
        }}
    />
);

export const ControlledOnSelectWithObjectDemo = () => {
    const [v, setV] = useState();
    return (
        <Form>
            <AutoComplete
                onSelectWithObject
                data={[]}
                showClear
                value={v}
                placeholder='controlled autocomplete'
                onChange={val => setV(val)}
                style={{ width: 200 }}
            />
            <Form.AutoComplete field='test' placeholder='form autocomplete' onSelectWithObject data={[]} showClear style={{ width: 200 }} />
        </Form>
    );
};


export const AutoScrollToKeyboardUpDown = () => {

    const [data, setData] = useState([]);
    const getData = (v) => {
        let newData = Array.from({ length: 20 }, (v, i) => ({ label: `option-${i}`, value: i, 'data-cy': `option-${i}` }));
        setData(newData);
    };
    
    const renderOption = (item) => {
        let optionStyle = {
            display: 'flex',
        };
        return (
            <>
                <Avatar color={'cyan'} size="small">
                    Semi
                </Avatar>
                <div style={{ marginLeft: 4 }}>
                    <div style={{ fontSize: 14, marginLeft: 4 }}>{item.label}</div>
                    <div style={{ marginLeft: 4 }}>{item.value}</div>
                </div>
            </>
        );
    }

    return <>
        <AutoComplete
            data={data}
            onSearch={(v) => getData(v)}
            style={{ width: 320 }}
        >
        </AutoComplete>
        <AutoComplete
            placeholder='with render'
            data={data}
            renderItem={renderOption}
            onSearch={(v) => getData(v)}
            style={{ width: 320 }}
        >
        </AutoComplete>
    </>
}

export const Fix2951 = () => {
     let initList = [
        '1.60','1.62','1.63','1.64'
    ];

    const [loading, setLoading] = useState(false);
    const [list, setList] = useState([]);

    const handleSearch = (inputValue) => {
        setLoading(true);
        let newList = [];
        if (inputValue) {
            newList = initList.filter(item => item.includes(inputValue));
        }
        setTimeout(() => {
            setList(newList);
            setLoading(false);
        }, 1000);
    };

    const search = debounce(handleSearch, 200);

    return (
        <AutoComplete
            data={list}
            style={{ width: 250 }}
            prefix={<IconSearch />}
            onSearch={search}
            loading={loading}
            defaultActiveFirstOption={true}
        ></AutoComplete>
    );
}