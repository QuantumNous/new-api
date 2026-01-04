import React, { useState, useMemo, useCallback } from 'react';
import { DndProvider, DragSource, DropTarget } from 'react-dnd';
import HTML5Backend from 'react-dnd-html5-backend';
import { Table, Tooltip, Tag } from '@douyinfe/semi-ui';
import './index.scss';

let draggingIndex = -1;
const PAGE_SIZE = 5;

function BodyRow(props) {
    const { isOver, connectDragSource, connectDropTarget, moveRow, currentPage, ...restProps } = props;
    const style = { ...restProps.style, cursor: 'move' };

    let { className } = restProps;
    if (isOver) {
        console.log('true');
        if (restProps.index > draggingIndex) {
            className += ' drop-over-downward';
        }
        if (restProps.index < draggingIndex) {
            className += ' drop-over-upward';
        }
    }

    return connectDragSource(connectDropTarget(<tr {...restProps} className={className} style={style} />));
}

const rowSource = {
    beginDrag(props) {
        draggingIndex = props.index;
        return {
            index: props.index,
        };
    },
};

const rowTarget = {
    drop(props, monitor) {
        const dragIndex = monitor.getItem().index;
        const hoverIndex = props.index;

        if (dragIndex === hoverIndex) {
            return;
        }

        props.moveRow(dragIndex, hoverIndex);

        monitor.getItem().index = hoverIndex;
    },
};

const DraggableBodyRow = DropTarget('row', rowTarget, (connect, monitor) => ({
    connectDropTarget: connect.dropTarget(),
    isOver: monitor.isOver(),
}))(
    DragSource('row', rowSource, connect => ({
        connectDragSource: connect.dragSource(),
    }))(BodyRow)
);

const columns = [
    {
        title: 'Name',
        dataIndex: 'name',
        width: 150,
        filters: [
            {
                text: 'King 3',
                value: 'King 3',
            },
            {
                text: 'King 4',
                value: 'King 4',
            },
        ],
        onFilter: (value, record) => record.name.includes(value),
    },
    {
        title: 'Age',
        dataIndex: 'age',
        width: 150,
        sorter: (a, b) => a.age - b.age > 0 ? 1 : -1,
    },
    {
        title: 'Address',
        width: 200,
        dataIndex: 'address',
    },
    {
        render: (text, record) => <Tooltip content={record.description}><Tag color='green'>Show Info</Tag></Tooltip>
    }
];

const initData = [];
for (let i = 0; i < 46; i++) {
    let age = 40 + (Math.random() > 0.5 ? 1 : -1) * Math.ceil(i/3);
    let name = `Edward King ${i}`;
    initData.push({
        key: '' + i,
        name,
        age,
        address: `London, Park Lane no. ${i}`,
        description: `My name is ${name}, I am ${age} years old, living in New York No. ${i+1} Lake Park.`,
    });
}

export default function DragSortingTableDemo(props) {
    const [data, setData] = useState([...initData]);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageData, setPageData] = useState(data.slice(0, PAGE_SIZE));

    const components = useMemo(() => ({
        body: {
            row: DraggableBodyRow,
        },
    }), []);

    const moveRow = (dragIndex, hoverIndex) => {
        const totalDragIndex = (currentPage - 1) * PAGE_SIZE + dragIndex;
        const totalHoverIndex = (currentPage - 1) * PAGE_SIZE + hoverIndex;
        const dragRow = data[totalDragIndex];
        const newData = [...data];
        newData.splice(totalDragIndex, 1);
        newData.splice(totalHoverIndex, 0, dragRow);
        setData(newData);
        setPageData(newData.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE));
    };

    const handlePageChange = (pageNum) => {
        console.log(pageNum);
        setCurrentPage(pageNum);
        setPageData(data.slice((pageNum - 1) * PAGE_SIZE, pageNum * PAGE_SIZE));
    };

    return (
        <div id="components-table-demo-drag-sorting">
            <DndProvider backend={HTML5Backend}>
                <Table
                    columns={columns}
                    dataSource={pageData}
                    pagination={{
                        pageSize: PAGE_SIZE,
                        total: data.length,
                        currentPage,
                        onPageChange: handlePageChange
                    }}
                    components={components}
                    onRow={(record, index) => ({
                        index,
                        moveRow,
                    })}
                />
            </DndProvider>
        </div>
    );
}
