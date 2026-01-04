import React, { ReactNode, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { CSS as cssDndKit } from '@dnd-kit/utilities';
import cls from 'classnames';

import {
    closestCenter,
    DragOverlay,
    DndContext,
    MouseSensor,
    TouchSensor,
    useSensor,
    useSensors,
    KeyboardSensor,
    TraversalOrder,
} from '@dnd-kit/core';
import type {
    UniqueIdentifier,
    PointerActivationConstraint,
    CollisionDetection,
} from '@dnd-kit/core';
import {
    useSortable,
    SortableContext,
    rectSortingStrategy,
    sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import type {
    SortingStrategy,
    AnimateLayoutChanges,
    NewIndexGetter,
} from '@dnd-kit/sortable';
import type { SortableTransition } from '@dnd-kit/sortable/dist/hooks/types';
import { isNull } from 'lodash';

const defaultPrefix = 'semi-sortable';

interface OnSortEndProps {
    oldIndex: number;
    newIndex: number
}
export type OnSortEnd = (props: OnSortEndProps) => void;

export interface RenderItemProps {
    id?: string | number;
    sortableHandle?: any;
    [x: string]: any
}
export interface SortableProps {
    onSortEnd?: OnSortEnd;
    // Set drag and drop trigger conditions
    activationConstraint?: PointerActivationConstraint;
    // Collision detection algorithm, for drag and drop sorting, use closestCenter to meet most scenarios
    collisionDetection?: CollisionDetection;
    // the dragged items，The content in items cannot be the number 0
    items?: any[];
    // Function that renders the item that is allowed to be dragged
    renderItem?: (props: RenderItemProps) => React.ReactNode;
    // Drag and drop strategy
    strategy?: SortingStrategy;
    // Whether to use a separate drag layer for items that move with the mouse
    useDragOverlay?: boolean;
    // A container for all elements that are allowed to be dragged
    container?: any;
    // Whether to change the size of the item being dragged
    adjustScale?: boolean;
    // Whether to use animation during dragging
    transition?: SortableTransition | null;
    // prefix
    prefix?: string;
    // The className of the item that moves with the mouse during the drag
    dragOverlayCls?: string
}

interface SortableItemProps {
    animateLayoutChanges?: AnimateLayoutChanges;
    getNewIndex?: NewIndexGetter;
    id: UniqueIdentifier;
    index: number;
    useDragOverlay?: boolean;
    renderItem?: (props: RenderItemProps) => ReactNode;
    prefix?: string;
    transition?: SortableTransition | null
}

function DefaultContainer(props) {
    return <div style={{ overflow: 'auto' }} {...props}></div>;
}

const defaultKeyBoardOptions = {
    coordinateGetter: sortableKeyboardCoordinates,
};

export function Sortable({
    items,
    onSortEnd,
    adjustScale,
    renderItem,
    transition,
    collisionDetection = closestCenter,
    strategy = rectSortingStrategy,
    useDragOverlay = true,
    dragOverlayCls,
    container: Container = DefaultContainer,
    prefix = defaultPrefix,
}: SortableProps) {

    const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
    const sensors = useSensors(
        useSensor(MouseSensor),
        useSensor(TouchSensor),
        useSensor(KeyboardSensor, defaultKeyBoardOptions)
    );
    const getIndex = useCallback((id: UniqueIdentifier) => items.indexOf(id), [items]);
    const activeIndex = useMemo(() => activeId ? getIndex(activeId) : -1, [getIndex, activeId]);

    const onDragStart = useCallback(({ active }) => {
        if (!active) { return; }
        setActiveId(active.id);
    }, []);
    
    const onDragEnd = useCallback(({ over }) => {
        setActiveId(null);
        if (over) {
            const overIndex = getIndex(over.id);
            if (activeIndex !== overIndex) {
                onSortEnd({ oldIndex: activeIndex, newIndex: overIndex });
            }
        }
    }, [activeIndex, getIndex, onSortEnd]);
    
    const onDragCancel = useCallback(() => {
        setActiveId(null);
    }, []);

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragCancel={onDragCancel}
            autoScroll={{ order: TraversalOrder.ReversedTreeOrder }}
        >
            <SortableContext items={items} strategy={strategy}>
                <Container>
                    {items.map((value, index) => (
                        <SortableItem
                            key={value}
                            id={value}
                            index={index}
                            renderItem={renderItem}
                            useDragOverlay={useDragOverlay}
                            prefix={prefix}
                            transition={transition}
                        />
                    ))}
                </Container>
            </SortableContext>
            {useDragOverlay
                ? createPortal(
                    <DragOverlay
                        adjustScale={adjustScale}
                        // Set zIndex in style to undefined to override the default zIndex in DragOverlay, 
                        // So that the zIndex of DragOverlay can be set by className
                        style={{ zIndex: undefined }}
                        className={dragOverlayCls}
                    >
                        {activeId ? (
                            renderItem({
                                id: activeId,
                                sortableHandle: (WrapperComponent) => WrapperComponent
                            })
                        ) : null}
                    </DragOverlay>,
                    document.body
                )
                : null}
        </DndContext>
    );
}

export function SortableItem({
    animateLayoutChanges,
    id,
    renderItem,
    prefix,
    transition: animation,
}: SortableItemProps) {
    const {
        listeners,
        setNodeRef,
        transform,
        transition,
        active,
        isOver,
        attributes,
    } = useSortable({
        id,
        animateLayoutChanges,
        transition: animation,
    });

    const sortableHandle = useCallback((WrapperComponent) => {
        // console.log('listeners', listeners);
        // 保证给出的接口的一致性，使用 span 包一层，保证用户能够通过同样的方式使用 handler
        // To ensure the consistency of the given interface
        // use a span package layer to ensure that users can use the handler in the same way
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions
        return () => <span {...listeners} style={{ lineHeight: 0 }} onMouseDown={(e) => {
            listeners.onMouseDown(e);
            // 阻止onMousedown的事件传递，
            // 防止元素在点击后被卸载导致tooltip/popover的弹出层意外关闭
            // Prevent the onMousedown event from being delivered, 
            // preventing the element from being unloaded after being clicked, 
            // causing the tooltip/popover pop-up layer to close unexpectedly
            e.preventDefault();
            e.stopPropagation();
        }}
        ><WrapperComponent /></span>;
    }, [listeners]);

    const itemCls = cls(
        `${prefix}-sortable-item`,
        {
            [`${prefix}-sortable-item-over`]: isOver,
            [`${prefix}-sortable-item-active`]: active?.id === id,
        }
    );

    const wrapperStyle = useMemo(() => {
        return (!isNull(animation)) ? {
            transform: cssDndKit.Transform.toString({
                ...transform,
                scaleX: 1,
                scaleY: 1,
            }),
            transition: transition,
        } : undefined;
    }, [animation, transform, transition]);

    return <div 
        ref={setNodeRef}
        style={wrapperStyle}
        className={itemCls} 
        {...attributes}
    >
        {renderItem({ id, sortableHandle }) as JSX.Element}
    </div>;
}
