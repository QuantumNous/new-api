import React, { useState, useEffect } from 'react';
import { Table, Tooltip, Tag } from '@douyinfe/semi-ui';
import './index.scss';

const Title = ({ title }) => <span style={{ fontSize: '12px', color: '#333', wordBreak: 'keep-all' }}>{title}</span>;

const dataTotalSize = 46;
const defaultData = (() => {
    const _data = [];
    for (let i = 0; i < dataTotalSize; i++) {
        const seed = Math.random() > 0.5 ? 1 : -1;
        let age = 40 + seed * Math.ceil(i / 3);
        let name = `Edward King ${i}`;
        _data.push({
            key: '' + i,
            name: seed > 0 ? name : 'XX',
            age,
            address: seed > 0 ? `London, Park Lane no. ${i} Lake Park` : `Zhonguancun ${i}`,
            description: `My name is ${name}, I am ${age} years old, living in New York No. ${i + 1} Lake Park.`,
        });
    }
    return _data;
})();

const Demo = () => {
    const [columns, setColumns] = useState([]);
    const [dataSource, setDataSource] = useState([]);

    useEffect(() => {
        const columns = [
            {
                title: <Title title="Name" />,
                dataIndex: 'name',
                // width: 150,
                render: (text, record) => text,
                fixed: 'left',
            },
            {
                title: <Title title="Age" />,
                dataIndex: 'age',
                // width: 150,
                render: (text, record) => text,
                fixed: 'left',
            },
            {
                title: <Title title="Address" />,
                dataIndex: 'address',
                render: (text, record) => text,
            },
        ];
        for (let i = 1; i <= 25; i++) {
            const seed = Math.random() > 0.5 ? 1 : -1;
            const dataIndex = seed > 0 ? 'name' : 'description';
            columns.push({
                title: <Title title={dataIndex} />,
                dataIndex,
                render: (text, record) => text,
            });
        }

        columns.push({
            title: <Title title="Address" />,
            dataIndex: 'address',
            render: (text, record) => text,
            fixed: 'right',
        });

        const dataSource = [...defaultData];
        setDataSource(dataSource);
        setColumns(columns);
    }, []);

    const scroll = {
        // x: '160%',
        // y: 400,
    };

    const wrapStyle = {
        // maxWidth: 3600,
    };

    return (
        <div style={wrapStyle}>
            <Table
                className={'massive-columns-table-auto-width'}
                bordered
                columns={columns}
                dataSource={dataSource}
                // dataSource={[]}
                scroll={scroll}
                expandedRowRender={(record, index, expanded) => (
                    <article style={{ margin: 0 }}>
                        <p>{record.description}</p>
                    </article>
                )}
                hideExpandedColumn={false}
                expandCellFixed={true}
                rowSelection={{ fixed: 'left' }}
                size={'middle'}
            />
        </div>
    );
};

Demo.parameters = {
    chromatic: { disableSnapshot: true },
};

export default Demo;
