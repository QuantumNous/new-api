import React, { useMemo, useState, useRef } from 'react';
import { Resizable } from 'react-resizable';
// import classnames from 'classnames';
import { addClass, removeClass } from '@douyinfe/semi-foundation/utils/classnames';
import Table from '../..';
import ResizableTable from '../../ResizableTable';
import './index.scss';

export default function ResizableDemo() {
    const { current: ResizableTitle } = useRef(props => {
        const { onResize, onResizeStart, onResizeStop, width, ...restProps } = props;

        if (typeof width !== 'number') {
            return <th {...restProps} />;
        }

        return (
            <Resizable
                width={width}
                height={0}
                onResize={onResize}
                onResizeStart={onResizeStart}
                onResizeStop={onResizeStop}
                draggableOpts={{ enableUserSelectHack: false }}
            >
                <th {...restProps} />
            </Resizable>
        );
    });

    const components = {
        header: {
            cell: ResizableTitle,
        },
    };

    const [columns, setColumns] = useState([
        {
            title: 'Date',
            dataIndex: 'date',
            width: 200,
        },
        {
            title: 'Amount',
            dataIndex: 'amount',
            width: 100,
        },
        {
            title: 'Type',
            dataIndex: 'type',
            width: 100,
        },
        {
            title: 'Note',
            dataIndex: 'note',
            width: 100,
        },
        {
            title: 'Action',
            key: 'action',
            render: () => <a>Delete</a>,
        },
    ]);

    const data = [
        {
            key: 0,
            date: '2018-02-11',
            amount: 120,
            type: 'income',
            note: 'transfer',
        },
        {
            key: 1,
            date: '2018-03-11',
            amount: 243,
            type: 'income',
            note: 'transfer',
        },
        {
            key: 2,
            date: '2018-04-11',
            amount: 98,
            type: 'income',
            note: 'transfer',
        },
    ];

    return (
        <div id="components-table-demo-resizable-column">
            {/* <Table bordered components={components} columns={finalColumns} dataSource={data} /> */}
            <ResizableTable columns={columns} dataSource={data} />
        </div>
    );
}
