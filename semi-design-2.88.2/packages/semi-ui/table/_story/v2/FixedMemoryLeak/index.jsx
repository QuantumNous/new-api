import React, { useState } from 'react';
import { Popconfirm, Table } from "@douyinfe/semi-ui";

export default function App() {
    const [data, setData] = useState([{ a: 1 }]);
    return (
        <Table
            dataSource={data}
            columns={[
                {
                    dataIndex: "a",
                    title: "a",
                },
                {
                    dataIndex: "b",
                    render: () => {
                        return (
                            <Popconfirm
                                onConfirm={() => {
                                    setTimeout(() => {
                                        setData([]);
                                    });
                                }}
                            >
                                删除
                            </Popconfirm>
                        );
                    },
                },
            ]}
        />
    );
}