import React from 'react';
import { Switch, Table, Dropdown, Icon } from '@douyinfe/semi-ui';
import { IconCaretdown } from '@douyinfe/semi-icons';
const CREATOR_MAP = {
    ALL: {
        value: 0,
        desc: '创建者',
    },
    MINE: {
        value: 1,
        desc: '只看我的',
    },
};
export default class JSXColumnsComplex extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            showName: true,
            showAge: true,
            showAddress: true,
            showCreator: true,
            currentCreator: {},
        };
        this.data = [];

        for (let i = 0; i < 46; i++) {
            this.data.push({
                key: `${i}`,
                name: `Edward King ${i}`,
                age: (i * 1000) % 149,
                address: `London, Park Lane no. ${i}`,
            });
        }

        this.columns = [
            {
                width: 150,
                onFilter: (value, record) => record.name.includes(value),
                filters: [
                    {
                        text: 'Code 45',
                        value: '45',
                    },
                    {
                        text: 'King 4',
                        value: 'King 4',
                    },
                ],
                title: 'Name',
                dataIndex: 'name',
                render: (text, record, index) => <a>{text}</a>,
            },
            {
                title: <span>Age</span>,
                dataIndex: 'age',
                sorter: (a, b) => (a.age - b.age > 0 ? 1 : -1),
            },
            {
                title: (
                    <Dropdown
                        position={'bottomLeft'}
                        render={(
                            <Dropdown.Menu>
                                <Dropdown.Item onClick={this.setCreator.bind(this, 'ALL')}>创建者</Dropdown.Item>
                                <Dropdown.Item onClick={this.setCreator.bind(this, 'MINE')}>只看我的</Dropdown.Item>
                            </Dropdown.Menu>
                        )}
                    >
                        <span>{this.state.currentCreator.desc}</span>
                        <Icon type={<IconCaretdown />} />
                    </Dropdown>
                ),
                key: 'creator',
                width: 168,
            },
            {
                title: 'Address',
                dataIndex: 'address',
            },
        ];
    }

    setCreator(type) {
        this.setState({
            currentCreator: { ...CREATOR_MAP[type] },
        });
    }

    toggleStatus = (type, status) => {
        this.setState({
            [type]: status,
        });
    };

    render() {
        const { showAddress, showAge, showName, showCreator, currentCreator } = this.state;
        return (
            <div>
                <div>
                    <div>
                        显示名称
                        <Switch checked={showName} onChange={v => this.toggleStatus('showName', v)} />
                    </div>
                    <div>
                        显示年龄
                        <Switch checked={showAge} onChange={v => this.toggleStatus('showAge', v)} />
                    </div>
                    <div>
                        显示创建者
                        <Switch checked={showCreator} onChange={v => this.toggleStatus('showCreator', v)} />
                    </div>
                    <div>
                        显示地址
                        <Switch checked={showAddress} onChange={v => this.toggleStatus('showAddress', v)} />
                    </div>
                </div>
                <Table
                    dataSource={this.data} // columns={this.columns}
                >
                    {showName ? (
                        <Table.Column
                            width={150}
                            onFilter={(value, record) => record.name.includes(value)}
                            filters={[
                                {
                                    text: 'Code 45',
                                    value: '45',
                                },
                                {
                                    text: 'King 4',
                                    value: 'King 4',
                                },
                            ]}
                            title="Name"
                            dataIndex="name"
                            render={(text, record, index) => <a>{text}</a>}
                        />
                    ) : null}
                    {showAge ? (
                        <Table.Column
                            title={<span>Age</span>}
                            dataIndex="age"
                            sorter={(a, b) => (a.age - b.age > 0 ? 1 : -1)}
                        />
                    ) : null}
                    {showCreator ? (
                        <Table.Column
                            title={(
                                <Dropdown
                                    position={'bottomLeft'}
                                    render={(
                                        <Dropdown.Menu>
                                            <Dropdown.Item onClick={this.setCreator.bind(this, 'ALL')}>
                                                创建者
                                            </Dropdown.Item>
                                            <Dropdown.Item onClick={this.setCreator.bind(this, 'MINE')}>
                                                只看我的
                                            </Dropdown.Item>
                                        </Dropdown.Menu>
                                    )}
                                >
                                    <span>{currentCreator.desc}</span>
                                    <Icon type={<IconCaretdown />} />
                                </Dropdown>
                            )}
                            key={'creator'}
                        />
                    ) : null}
                    {showAddress ? <Table.Column title="Address" dataIndex="address" /> : null}
                </Table>
            </div>
        );
    }
}
