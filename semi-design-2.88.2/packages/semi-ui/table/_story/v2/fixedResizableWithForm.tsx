import React from 'react';
import { Table } from '@douyinfe/semi-ui';

App.storyName = 'fixed resizable table with form';
/**
 * @see https://github.com/DouyinFE/semi-design/issues/1506
 */
export default function App() {
    return (
        <div className="App">
            <form />
            <Table
                resizable
                dataSource={[]}
                columns={[
                    {
                        dataIndex: 'dau',
                        title: <div>ccc</div>,
                        width: 300,
                    },
                ]}
            />
        </div>
    );
}
