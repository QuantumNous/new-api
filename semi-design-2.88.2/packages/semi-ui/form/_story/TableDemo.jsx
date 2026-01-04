import React, { useState } from 'react';
import { Table, Avatar, Button, Form, Input } from '@douyinfe/semi-ui';
import { IconDelete } from '@douyinfe/semi-icons';

var gene = (row, column) => {
    const columns = [];
    for (let i = 0; i < column; i++) {
        let cur = {
            title: `c-${i}`,
            dataIndex: `c-${i}`,
            width: 200,
            render: (text, record, rowIndex) => {
                // return <Input></Input>
                return <Form.Input field={`data[${rowIndex}][c-${i}]`} pure style={{ width: 120 }} />;
            }
        };
        columns.push(cur);
    }

    let data = [];
    for (let i = 0; i < row; i++) {
        const row = {};
        for (let j = 0; j < column; j++) {
            row[`c-${j}`] = `r-${i}-c-${j}`;
        }
        data.push(row);
    }
    return { data, columns };
};

let { data, columns } = gene(100, 10);

const TableForm = () => {
    const [dataSource, setData] = useState(data);

    return (
        <>
            <Form initValues={{ data: dataSource }} onValueChange={values => console.log(values)}>
                <Table
                    style={{ minHeight: 350 }}
                    columns={columns}
                    dataSource={dataSource}
                    pagination={false}
                />
            </Form>
        </>
    );
};


TableForm.storyName = 'Form Editor Table Demo';

export default TableForm;
