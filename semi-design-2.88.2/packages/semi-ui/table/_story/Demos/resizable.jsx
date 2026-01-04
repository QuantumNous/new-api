import React, { useState, useMemo } from 'react';
import { Table, Avatar } from '@douyinfe/semi-ui';
import { DndProvider, DragSource, DropTarget } from 'react-dnd';
import HTML5Backend from 'react-dnd-html5-backend';

let draggingIndex = -1;
const PAGE_SIZE = 5;
const DAY = 24 * 60 * 60 * 1000;
const figmaIconUrl = 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png';

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
        title: '标题',
        dataIndex: 'name',
        width: 400,
        render: (text, record, index) => {
            return (
                <div>
                    <Avatar size="small" shape="square" src={figmaIconUrl} style={{ marginRight: 12 }}></Avatar>
                    {text}
                </div>
            );
        },
        filters: [
            {
                text: 'Semi Design 设计稿',
                value: 'Semi Design 设计稿',
            },
            {
                text: 'Semi Pro 设计稿',
                value: 'Semi Pro 设计稿',
            },
        ],
        onFilter: (value, record) => record.name.includes(value),
    },
    {
        title: '大小',
        dataIndex: 'size',
        width: 200,
        sorter: (a, b) => a.size - b.size > 0 ? 1 : -1,
        render: (text) => `${text} KB`
    },
    {
        title: '所有者',
        width: 200,
        dataIndex: 'owner',
        render: (text, record, index) => {
            return (
                <div>
                    <Avatar size="small" color={record.avatarBg} style={{ marginRight: 4 }}>{typeof text === 'string' && text.slice(0, 1)}</Avatar>
                    {text}
                </div>
            );
        }

    },
    {
        title: '更新日期',
        dataIndex: 'updateTime',
        sorter: (a, b) => a.updateTime - b.updateTime > 0 ? 1 : -1,
        render: (value) => {
            return dateFns.format(new Date(value), 'yyyy-MM-dd');
        }
    }
];

const initData = [];
for (let i = 0; i < 46; i++) {
    const isSemiDesign = i % 2 === 0;
    const randomNumber = (i * 1000) % 199;
    initData.push({
        key: '' + i,
        name: isSemiDesign ? `Semi Design 设计稿${i}.fig` : `Semi Pro 设计稿${i}.fig`,
        owner: isSemiDesign ? '姜鹏志' : '郝宣',
        size: randomNumber,
        updateTime: new Date().valueOf() + randomNumber * DAY,
        avatarBg: isSemiDesign ? 'grey' : 'red'
    });
}

function DragSortingTableDemo(props) {
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

render(DragSortingTableDemo);
