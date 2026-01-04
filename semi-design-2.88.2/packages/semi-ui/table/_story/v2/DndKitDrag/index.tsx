import React, { useEffect, useMemo, useState } from 'react';
import { Table, Avatar } from '@douyinfe/semi-ui';
import * as dateFns from 'date-fns';
import { DndContext, PointerSensor, useSensors, useSensor } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import cls from 'classnames';

export default function App() {
    const pageSize = 10;
    const [dataSource, setData] = useState([]);
    const [pageData, setPageData] = useState([]);
    const columns = useMemo(
        () => [
            {
                title: '标题',
                dataIndex: 'name',
                width: 400,
                render: (text, record, index) => {
                    return (
                        <div>
                            <Avatar
                                size="small"
                                shape="square"
                                src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/figma-icon.png"
                                style={{ marginRight: 12 }}
                            ></Avatar>
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
                        text: 'Semi D2C 设计稿',
                        value: 'Semi D2C 设计稿',
                    },
                ],
                onFilter: (value, record) => record.name.includes(value),
            },
            {
                title: '大小',
                dataIndex: 'size',
                sorter: (a, b) => (a.size - b.size > 0 ? 1 : -1),
                render: text => `${text} KB`,
            },
            {
                title: '所有者',
                dataIndex: 'owner',
                render: (text, record, index) => {
                    return (
                        <div>
                            <Avatar size="small" color={record.avatarBg} style={{ marginRight: 4 }}>
                                {typeof text === 'string' && text.slice(0, 1)}
                            </Avatar>
                            {text}
                        </div>
                    );
                },
            },
            {
                title: '更新日期',
                dataIndex: 'updateTime',
                sorter: (a, b) => (a.updateTime - b.updateTime > 0 ? 1 : -1),
                render: value => {
                    return dateFns.format(new Date(value), 'yyyy-MM-dd');
                },
            },
        ],
        []
    );

    useEffect(() => {
        const getData = () => {
            const data = [];
            for (let i = 0; i < 46; i++) {
                const isSemiDesign = i % 2 === 0;
                const randomNumber = (i * 1000) % 199;
                data.push({
                    key: '' + i,
                    name: isSemiDesign ? `Semi Design 设计稿${i}.fig` : `Semi D2C 设计稿${i}.fig`,
                    owner: isSemiDesign ? '姜鹏志' : '郝宣',
                    size: randomNumber,
                    updateTime: new Date().valueOf() + randomNumber,
                    avatarBg: isSemiDesign ? 'grey' : 'red',
                });
            }
            return data;
        };
        const data = getData();
        setData(data);
    }, []);
    const [pageNum, setPageNum] = useState(1);

    useEffect(() => {
        const currentPageData = dataSource.slice((pageNum - 1) * pageSize, pageNum * pageSize);
        setPageData(currentPageData);
    }, [dataSource, pageNum]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 1 },
        })
    );

    const handleDragEnd = event => {
        const { active, over } = event;
        if (active?.id !== over?.id) {
            setPageData(prev => {
                const activeIndex = prev.findIndex(data => data.key === active?.id);
                const overIndex = prev.findIndex(data => data.key === over?.id);
                return arrayMove(prev, activeIndex, overIndex);
            });
        }
    };

    const handleChange = ({ pagination }) => {
        const { currentPage } = pagination;
        setPageNum(currentPage);
    };

    const SortableRow = (props) => {
        const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({
            id: props['data-row-key'],
        });
        const style = {
            ...props.style,
            transform: CSS.Transform.toString(transform),
            transition,
            cursor: 'grabbing',
            ...(isDragging ? { zIndex: 999, position: 'relative' } : {}),
        };
        const rowCls = cls(props.className,
            {
                ['isDragging']: isDragging,
                ['isOver']: isOver,
            }
        );
        const onPointerDown = (event) => {
            event.persist();
            console.log('props', event);
            listeners.onPointerDown(event);
        };

        return <tr {...props} className={rowCls} ref={setNodeRef} style={style} {...attributes} {...listeners} onPointerDown={onPointerDown}></tr>;
    };

    return (
        <DndContext
            // https://docs.dndkit.com/api-documentation/context-provider#autoscroll
            autoScroll={true}
            sensors={sensors}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
        >
            <SortableContext items={pageData.map(data => data.key)} strategy={verticalListSortingStrategy}>
                <Table
                    components={{
                        body: {
                            row: SortableRow as any,
                        },
                    }}
                    rowKey="key"
                    columns={columns}
                    dataSource={pageData}
                    pagination={{ currentPage: pageNum, pageSize: pageSize, total: dataSource.length }}
                    onChange={handleChange}
                />
            </SortableContext>
        </DndContext>
    );
}