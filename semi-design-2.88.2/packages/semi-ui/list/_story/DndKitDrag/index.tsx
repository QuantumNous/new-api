import React, { useState } from 'react';
import { List, Avatar } from '@douyinfe/semi-ui';
import { DndContext, MouseSensor, useSensors, useSensor } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import cls from 'classnames';

export default function App() {
    const data = [
        {
            id: 1,  // 添加唯一id
            title: 'Semi Design Title 1',
            color: 'red',
        },
        {
            id: 2,
            title: 'Semi Design Title 2',
            color: 'grey',
        },
        {
            id: 3,
            title: 'Semi Design Title 3',
            color: 'light-green',
        },
        {
            id: 4,
            title: 'Semi Design Title 4',
            color: 'light-blue',
        },
        {
            id: 5,
            title: 'Semi Design Title 5',
            color: 'pink',
        },
    ];
    const [listItems, setListItems] = useState(data);

    const sensors = useSensors(
        useSensor(MouseSensor, {
            activationConstraint: { distance: 1 },
        })
    );

    const handleDragEnd = event => {
        const { active, over } = event;
        if (active.id !== over.id) {
            setListItems((items) => {
                const oldIndex = items.findIndex(item => item.id === active.id);
                const newIndex = items.findIndex(item => item.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const ListItem = (props) => {
        const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({
            id: props['id'],
        });

        const styles = {
            ...props.style,
            transform: CSS.Transform.toString(transform),
            transition,
            border: '1px solid var(--semi-color-border)',
            marginBottom: 12,
            cursor: 'grabbing',
            ...(isDragging ? { zIndex: 999, position: 'relative', backgroundColor: 'var(--semi-color-bg-0)' } : {}),
        };

        
        const itemCls = cls(
            {
                ['isDragging']: isDragging,
                ['isOver']: isOver,
            }
        );

        return (
            <div
                ref={setNodeRef} 
                style={styles} 
                className={itemCls}
                {...listeners} 
                {...attributes}
            >
                <List.Item {...props} ></List.Item>
            </div>
        );
    };

    const RenderDraggable = (item, id) => {
        return (
            <ListItem
                id={id}
                {...item}
                header={<Avatar color={item.color}>SE</Avatar>}
                main={
                    <div>
                        <span style={{ color: 'var(--semi-color-text-0)', fontWeight: 500 }}>{item.title}</span>
                        <p style={{ color: 'var(--semi-color-text-2)', margin: '4px 0' }}>
                            Semi Design
                            设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
                            Web 应用。
                        </p>
                    </div>
                }
            />
        );
    };

    return (
        <div style={{ padding: 12, border: '1px solid var(--semi-color-border)', margin: 12 }}>
            <DndContext
                autoScroll={true}
                sensors={sensors}
                modifiers={[restrictToVerticalAxis]}
                onDragEnd={handleDragEnd}
            >
                <SortableContext items={listItems.map(data => data.id)} strategy={verticalListSortingStrategy}>
                    <List dataSource={listItems} renderItem={RenderDraggable} />
                </SortableContext>
            </DndContext>
        </div>
    );
}