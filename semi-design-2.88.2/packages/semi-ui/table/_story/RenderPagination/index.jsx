import React from 'react';
import { Table, Pagination, ButtonGroup, Button, Switch } from '../../../index';

export default class RenderPagination extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            customPagination: true,
            pagination: { ...props.pagination, pageSize: 8 },
        };

        this.renderPagination = pagination => {
            return <Pagination {...pagination} />;
        };

        this.switchPagination = position => {
            let { pagination } = this.state;

            const positions = ['bottom', 'top', 'both'];

            if (position === true || position === false) {
                pagination = position ? { ...pagination } : false;
            } else if (positions.includes(position)) {
                pagination = { ...pagination, position };
            }

            this.setState({ pagination });
        };

        this.toggleRenderPagination = checked => {
            this.setState({ customPagination: checked });
        };

        this.TableSwitch = function TableSwitch({
            text,
            children,
            checked,
            onChange,
            style = { display: 'inline-flex', alignItems: 'center', margin: 5 },
        }) {
            const switchProps = { onChange };

            if (checked != null) {
                switchProps.checked = !!checked;
            }
            return (
                <span style={style}>
                    <span>{text}</span>
                    {children != null ? children : <Switch size="small" {...switchProps} />}
                </span>
            );
        };

        this.data = [
            {
                key: '1',
                name: 'John Brown',
                age: 32,
                address: 'New York No. 1 Lake Park, New York No. 1 Lake Park',
            },
            {
                key: '2',
                name: 'Jim Green',
                age: 42,
                address: 'London No. 1 Lake Park',
            },
            {
                key: '3',
                name: 'Joe Black',
                age: 32,
                address: 'Sidney No. 1 Lake Park',
            },
            {
                key: '4',
                name: 'Disabled User',
                age: 99,
                address: 'Sidney No. 1 Lake Park',
            },
            {
                key: '5',
                name: 'John Brown',
                age: 32,
                address: 'New York No. 1 Lake Park, New York No. 1 Lake Park',
            },
            {
                key: '6',
                name: 'Jim Green',
                age: 42,
                address: 'London No. 1 Lake Park',
            },
            {
                key: '7',
                name: 'Joe Black',
                age: 32,
                address: 'Sidney No. 1 Lake Park',
            },
            {
                key: '8',
                name: 'Disabled User',
                age: 99,
                address: 'Sidney No. 1 Lake Park',
            },
            {
                key: '9',
                name: 'John Brown',
                age: 32,
                address: 'New York No. 1 Lake Park, New York No. 1 Lake Park',
            },
            {
                key: '10',
                name: 'Jim Green',
                age: 42,
                address: 'London No. 1 Lake Park',
            },
            {
                key: '11',
                name: 'Joe Black',
                age: 32,
                address: 'Sidney No. 1 Lake Park',
            },
            {
                key: '12',
                name: 'Disabled User',
                age: 99,
                address: 'Sidney No. 1 Lake Park',
            },
        ];
    }

    render() {
        const TableSwitch = this.TableSwitch;
        const { customPagination, pagination } = this.state;

        return (
            <div>
                <div>
                    <TableSwitch text="自定义渲染分页" checked={customPagination} onChange={this.toggleRenderPagination} />
                    <TableSwitch text="分页器位置">
                        <ButtonGroup>
                            <Button onClick={() => this.switchPagination('bottom')}>Bottom</Button>
                            <Button onClick={() => this.switchPagination('top')}>Top</Button>
                            <Button onClick={() => this.switchPagination('both')}>Both</Button>
                            <Button onClick={() => this.switchPagination(false)}>None</Button>
                        </ButtonGroup>
                    </TableSwitch>
                </div>
                <Table dataSource={this.data} pagination={pagination} renderPagination={customPagination ? this.renderPagination : null}>
                    <Table.Column
                        title="Name"
                        dataIndex="name"
                        key="name"
                        render={(text, record, index) => <a>{text}</a>}
                    />
                    <Table.Column title="Age" dataIndex="age" key="age" />
                    <Table.Column title="Address" dataIndex="address" key="address" />
                </Table>
            </div>
        );
    }
}
