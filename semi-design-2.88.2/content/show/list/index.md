---
localeCode: zh-CN
order: 74
category: 展示类
title: List 列表
icon: doc-list
dir: column
noInline: true
brief: 基础列表组件
---

## 代码演示

### 如何引入

```jsx import
import { List } from '@douyinfe/semi-ui';
```

### 基本用法

列表的基本用法。可以通过 size 设置尺寸，支持`large`, `default`, `small`。可设置 header 和 footer，来自定义列表头部和尾部。

```jsx live=true dir="column" noInline=true
import React from 'react';
import { List } from '@douyinfe/semi-ui';

class SimpleList extends React.Component {
    render() {
        const data = [
            '从明天起，做一个幸福的人',
            '喂马，劈柴，周游世界',
            '从明天起，关心粮食和蔬菜',
            '我有一所房子，面朝大海，春暖花开',
        ];

        return (
            <div>
                <div style={{ marginRight: 16 }}>
                    <h3 style={{ marginBottom: 16 }}>Default Size</h3>
                    <List
                        header={<div>Header</div>}
                        footer={<div>Footer</div>}
                        bordered
                        dataSource={data}
                        renderItem={item => <List.Item>{item}</List.Item>}
                    />
                </div>
                <div style={{ marginRight: 16 }}>
                    <h3 style={{ margin: '16px 0' }}>Small Size</h3>
                    <List
                        size="small"
                        header={<div>Header</div>}
                        footer={<div>Footer</div>}
                        bordered
                        dataSource={data}
                        renderItem={item => <List.Item>{item}</List.Item>}
                    />
                </div>
                <div style={{ marginRight: 16 }}>
                    <h3 style={{ margin: '16px 0' }}>Large Size</h3>
                    <List
                        size="large"
                        header={<div>Header</div>}
                        footer={<div>Footer</div>}
                        bordered
                        dataSource={data}
                        renderItem={item => <List.Item>{item}</List.Item>}
                    />
                </div>
            </div>
        );
    }
}

render(SimpleList);
```

### 模板用法

列表的 List.Item 内置了简单的结构包含：header，main 和 extra 。其中 header 和 main 的对齐方式可以通过 align 属性设置，支持 `flex-start`（默认）, `flex-end`, `center`, `baseline`, 和 `stretch` 。

```jsx live=true dir="column" noInline=true
import React from 'react';
import { List, Avatar, ButtonGroup, Button } from '@douyinfe/semi-ui';

class ContentList extends React.Component {
    render() {
        const data = [
            // eslint-disable-next-line react/jsx-key
            <p
                style={{
                    color: 'var(--semi-color-text-2)',
                    margin: '4px 0',
                    width: 420,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                }}
            >
                Semi Design 是由抖音前端团队与 UED
                团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
                Web 应用。
            </p>,
            // eslint-disable-next-line react/jsx-key
            <p style={{ color: 'var(--semi-color-text-2)', margin: '4px 0', width: 500 }}>
                Semi Design 是由抖音前端团队与 UED
                团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
                Web 应用。
            </p>,
            // eslint-disable-next-line react/jsx-key
            <p style={{ color: 'var(--semi-color-text-2)', margin: '4px 0', width: 500 }}>
                Semi Design 以用户中心、内容优先、设计人性化的设计系统，打造一致、好看、好用、高效的用户体验。
            </p>,
        ];

        return (
            <div style={{ padding: 12, border: '1px solid var(--semi-color-border)', margin: 12 }}>
                <List
                    dataSource={data}
                    renderItem={item => (
                        <List.Item
                            header={<Avatar color="blue">SE</Avatar>}
                            main={
                                <div>
                                    <span style={{ color: 'var(--semi-color-text-0)', fontWeight: 500 }}>示例标题</span>
                                    {item}
                                </div>
                            }
                            extra={
                                <ButtonGroup theme="borderless">
                                    <Button>编辑</Button>
                                    <Button>更多</Button>
                                </ButtonGroup>
                            }
                        />
                    )}
                />
            </div>
        );
    }
}

render(ContentList);
```

### 布局

通过 layout 属性可以设置列表的布局，支持`vertical`（默认）和`horizontal`。

```jsx live=true dir="column" noInline=true
import React from 'react';
import { List, Avatar } from '@douyinfe/semi-ui';

class LayoutList extends React.Component {
    render() {
        const data = [
            {
                title: 'Semi Design Title 1',
                color: 'light-blue',
            },
            {
                title: 'Semi Design Title 2',
                color: 'grey',
            },
            {
                title: 'Semi Design Title 3',
                color: 'light-green',
            },
        ];

        return (
            <div style={{ padding: 12, border: '1px solid var(--semi-color-border)', margin: 12 }}>
                <List
                    dataSource={data}
                    layout="horizontal"
                    renderItem={item => (
                        <List.Item
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
                    )}
                />
            </div>
        );
    }
}

render(LayoutList);
```

### 栅格列表

通过 grid 属性可以实现栅格列表，`span` 可设置每项的占格数，`gutter`可设置栅格间隔。

```jsx live=true dir="column" noInline=true
import React from 'react';
import { List, Descriptions, ButtonGroup, Rating, Button } from '@douyinfe/semi-ui';

class LayoutList extends React.Component {
    render() {
        const data = [
            {
                title: '审核管理平台',
                rating: 4.5,
                feedbacks: 124,
            },
            {
                title: '扁鹊',
                rating: 4,
                feedbacks: 108,
            },
            {
                title: '直播审核平台',
                rating: 4.5,
                feedbacks: 244,
            },
            {
                title: '抖音安全测试',
                feedbacks: 189,
            },
        ];

        const style = {
            border: '1px solid var(--semi-color-border)',
            backgroundColor: 'var(--semi-color-bg-2)',
            borderRadius: '3px',
            paddingLeft: '20px',
        };

        return (
            <div>
                <List
                    grid={{
                        gutter: 12,
                        span: 6,
                    }}
                    dataSource={data}
                    renderItem={item => (
                        <List.Item style={style}>
                            <div>
                                <h3 style={{ color: 'var(--semi-color-text-0)', fontWeight: 500 }}>{item.title}</h3>
                                <Descriptions
                                    align="center"
                                    size="small"
                                    row
                                    data={[
                                        { key: '满意度', value: <Rating allowHalf size="small" value={item.rating} /> },
                                        { key: '反馈数', value: item.feedbacks },
                                    ]}
                                />
                                <div style={{ margin: '12px 0', display: 'flex', justifyContent: 'flex-end' }}>
                                    <ButtonGroup theme="borderless" style={{ marginTop: 8 }}>
                                        <Button>编辑</Button>
                                        <Button>更多</Button>
                                    </ButtonGroup>
                                </div>
                            </div>
                        </List.Item>
                    )}
                />
            </div>
        );
    }
}

render(LayoutList);
```

### 响应式的栅格列表

响应式的栅格列表。响应尺寸与 [Grid](/zh-CN/basic/grid) 保持一致。

```jsx live=true dir="column" noInline=true hideInDSM
import React from 'react';
import { List, Descriptions, Rating, Button, ButtonGroup } from '@douyinfe/semi-ui';

class Responsive extends React.Component {
    render() {
        const data = [
            {
                title: '审核管理平台',
                rating: 4.5,
                feedbacks: 124,
            },
            {
                title: '扁鹊',
                rating: 4,
                feedbacks: 108,
            },
            {
                title: '直播审核平台',
                rating: 3.5,
                feedbacks: 244,
            },
            {
                title: '抖音安全测试',
                feedbacks: 189,
            },
            {
                title: '内容平台',
                rating: 3,
                feedbacks: 128,
            },
            {
                title: '策略平台',
                rating: 4,
                feedbacks: 156,
            },
        ];

        const style = {
            border: '1px solid var(--semi-color-border)',
            backgroundColor: 'var(--semi-color-bg-2)',
            borderRadius: '3px',
            paddingLeft: '20px',
            margin: '8px 2px',
        };

        return (
            <div>
                <List
                    grid={{
                        gutter: 12,
                        xs: 0,
                        sm: 0,
                        md: 12,
                        lg: 8,
                        xl: 8,
                        xxl: 6,
                    }}
                    dataSource={data}
                    renderItem={item => (
                        <List.Item style={style}>
                            <div>
                                <h3 style={{ color: 'var(--semi-color-text-0)', fontWeight: 500 }}>{item.title}</h3>
                                <Descriptions
                                    align="center"
                                    size="small"
                                    row
                                    data={[
                                        { key: '满意度', value: <Rating allowHalf size="small" value={item.rating} /> },
                                        { key: '反馈数', value: item.feedbacks },
                                    ]}
                                />
                                <div style={{ margin: '12px 0', display: 'flex', justifyContent: 'flex-end' }}>
                                    <ButtonGroup theme="borderless" style={{ marginTop: 8 }}>
                                        <Button>编辑</Button>
                                        <Button>更多</Button>
                                    </ButtonGroup>
                                </div>
                            </div>
                        </List.Item>
                    )}
                />
            </div>
        );
    }
}

render(Responsive);
```

### 加载更多

可通过 loadMore 属性实现加载更多的功能。

```jsx live=true dir="column" noInline=true hideInDSM
import React from 'react';
import { List, Skeleton, Button, Avatar } from '@douyinfe/semi-ui';

class LoadMoreList extends React.Component {
    constructor() {
        super();

        const count = 3;
        const data = [];
        for (let i = 0; i < 40; i++) {
            data.push({
                color: 'grey',
                title: `Semi Design Title ${i}`,
                loading: false,
            });
        }
        this.data = data;
        this.count = 0;

        this.fetchData = () => {
            let placeholders = [0, 1, 2].map(key => ({ loading: true }));
            this.setState({
                loading: true,
                list: [...this.state.dataSource, ...placeholders],
            });
            return new Promise((res, rej) => {
                setTimeout(() => {
                    let dataSource = this.data.slice(this.count * count, this.count * count + count);
                    res(dataSource);
                }, 1000);
            }).then(dataSource => {
                let newData = [...this.state.dataSource, ...dataSource];
                this.setState({
                    loading: false,
                    dataSource: newData,
                    list: newData,
                    noMore: !dataSource.length,
                });
            });
        };

        this.state = {
            loading: false,
            dataSource: [],
            list: [],
            noMore: false,
        };
    }

    componentDidMount() {
        this.fetchData();
    }

    onLoadMore() {
        this.count++;
        this.fetchData();
    }

    render() {
        const { loading, list, noMore } = this.state;
        const loadMore =
            !loading && !noMore ? (
                <div
                    style={{
                        textAlign: 'center',
                        marginTop: 12,
                        height: 32,
                        lineHeight: '32px',
                    }}
                >
                    <Button onClick={() => this.onLoadMore()}>显示更多</Button>
                </div>
            ) : null;

        const placeholder = (
            <div
                style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    padding: 12,
                    borderBottom: '1px solid var(--semi-color-border)',
                }}
            >
                <Skeleton.Avatar style={{ marginRight: 12 }} />
                <div>
                    <Skeleton.Title style={{ width: 120, marginBottom: 12, marginTop: 12 }} />
                    <Skeleton.Paragraph style={{ width: 600 }} rows={2} />
                </div>
            </div>
        );
        return (
            <List
                loading={loading}
                loadMore={loadMore}
                dataSource={list}
                renderItem={item => (
                    <Skeleton placeholder={placeholder} loading={item.loading}>
                        <List.Item
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
                    </Skeleton>
                )}
            />
        );
    }
}

render(LoadMoreList);
```

### 滚动加载

可以通过集成 [react-infinite-scroller](https://github.com/CassetteRocks/react-infinite-scroller) 来实现滚动加载的列表。交互建议符合 semi 交互设计规范，这里采用三次滚加载后出现 load more 按钮的形式。

```jsx live=true dir="column" noInline=true hideInDSM
import React from 'react';
import { List, Button, Avatar, Spin } from '@douyinfe/semi-ui';
import InfiniteScroll from 'react-infinite-scroller';

class ScrollLoad extends React.Component {
    constructor() {
        super();

        const count = 5;
        const dataList = [];
        for (let i = 0; i < 100; i++) {
            dataList.push({
                color: 'grey',
                title: `Semi Design Title ${i}`,
                loading: false,
            });
        }
        this.data = dataList;
        this.count = 0;

        this.fetchData = () => {
            this.setState({
                loading: true,
            });
            return new Promise((res, rej) => {
                setTimeout(() => {
                    let dataSource = this.data.slice(this.count * count, this.count * count + count);
                    res(dataSource);
                }, 1000);
            }).then(dataSource => {
                let newData = [...this.state.dataSource, ...dataSource];
                this.count++;
                this.setState({
                    loading: false,
                    dataSource: newData,
                    noMore: !dataSource.length,
                });
            });
        };

        this.state = {
            loading: false,
            dataSource: [],
            hasMore: true,
        };
    }

    componentDidMount() {
        this.fetchData();
    }

    render() {
        const { loading, dataSource, hasMore } = this.state;
        const showLoadMore = this.count % 4 === 0;
        const loadMore =
            !loading && hasMore && showLoadMore ? (
                <div
                    style={{
                        textAlign: 'center',
                        marginTop: 12,
                        height: 32,
                        lineHeight: '32px',
                    }}
                >
                    <Button onClick={this.fetchData}>显示更多</Button>
                </div>
            ) : null;

        return (
            <div
                className="light-scrollbar"
                style={{ height: 420, overflow: 'auto', border: '1px solid var(--semi-color-border)', padding: 10 }}
            >
                <InfiniteScroll
                    initialLoad={false}
                    pageStart={0}
                    threshold={20}
                    loadMore={this.fetchData}
                    hasMore={!this.state.loading && this.state.hasMore && !showLoadMore}
                    useWindow={false}
                >
                    <List
                        loadMore={loadMore}
                        dataSource={dataSource}
                        renderItem={item => (
                            <List.Item
                                header={<Avatar color={item.color}>SE</Avatar>}
                                main={
                                    <div>
                                        <span style={{ color: 'var(--semi-color-text-0)', fontWeight: 500 }}>
                                            {item.title}
                                        </span>
                                        <p style={{ color: 'var(--semi-color-text-2)', margin: '4px 0' }}>
                                            Semi Design
                                            设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
                                            Web 应用。
                                        </p>
                                    </div>
                                }
                            />
                        )}
                    />
                    {this.state.loading && this.state.hasMore && (
                        <div style={{ textAlign: 'center' }}>
                            <Spin />
                        </div>
                    )}
                </InfiniteScroll>
            </div>
        );
    }
}

render(ScrollLoad);
```

### 滚动加载无限长列表

可以通过集成 [react-virtualized](https://github.com/bvaughn/react-virtualized) 实现滚动加载无限长列表，带有虚拟化（virtualization）功能，能够提高数据量大时候长列表的性能。

```jsx live=true dir="column" noInline=true hideInDSM
import React from 'react';
import { List, Avatar } from '@douyinfe/semi-ui';
import { InfiniteLoader, AutoSizer } from 'react-virtualized';
import VList from 'react-virtualized/dist/commonjs/List';

class VirtualizedScroll extends React.Component {
    constructor() {
        super();

        const dataList = [];
        for (let i = 0; i < 50; i++) {
            dataList.push({
                color: 'grey',
                title: `Semi Design Title ${i}`,
            });
        }
        this.data = dataList;

        this.fetchData = (startIndex, stopIndex) => {
            return new Promise((res, rej) => {
                setTimeout(() => {
                    let dataSource = this.data.slice(startIndex, stopIndex + 1);
                    res(dataSource);
                }, 1000);
            }).then(dataSource => {
                let newData = [...this.state.dataSource, ...dataSource];
                const { loadedRowsMap, loadingRowCount } = this.state;
                const increment = stopIndex - startIndex + 1;
                for (let i = startIndex; i <= stopIndex; i++) {
                    loadedRowsMap[i] = this.statusLoaded;
                }
                this.setState({
                    dataSource: newData,
                    loadedRowsMap,
                    loadingRowCount: loadingRowCount - increment,
                });
            });
        };

        this.state = {
            dataSource: [],
            loadedRowsMap: {},
            loadingRowCount: 0,
        };

        this.statusLoading = 0;
        this.statusLoaded = 1;
        this.loadLimit = this.data.length;
        this.renderItem = this.renderItem.bind(this);
        this.fetchData = this.fetchData.bind(this);
        this.handleInfiniteOnLoad = this.handleInfiniteOnLoad.bind(this);
        this.isRowLoaded = this.isRowLoaded.bind(this);
    }

    handleInfiniteOnLoad({ startIndex, stopIndex }) {
        let { dataSource, loadedRowsMap, loadingRowCount } = this.state;
        const increment = stopIndex - startIndex + 1;
        if (stopIndex >= this.loadLimit || loadingRowCount > 0) {
            return;
        }
        for (let i = startIndex; i <= stopIndex; i++) {
            loadedRowsMap[i] = this.statusLoading;
        }
        this.setState({
            loadingRowCount: loadingRowCount + increment,
        });
        return this.fetchData(startIndex, stopIndex);
    }

    isRowLoaded({ index }) {
        const { loadedRowsMap } = this.state;
        return !!loadedRowsMap[index];
    }

    renderItem({ index, key, style }) {
        const { dataSource, loadedRowsMap } = this.state;
        const item = dataSource[index];

        if (!item) {
            return;
        }
        const content = (
            <List.Item
                key={key}
                style={style}
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
        return content;
    }

    render() {
        const { dataSource } = this.state;
        const height = 500;
        return (
            <List style={{ border: '1px solid var(--semi-color-border)', padding: 10 }}>
                <InfiniteLoader
                    isRowLoaded={this.isRowLoaded}
                    loadMoreRows={this.handleInfiniteOnLoad}
                    rowCount={this.loadLimit}
                >
                    {({ onRowsRendered, registerChild }) => (
                        <AutoSizer disableHeight>
                            {({ width }) => (
                                <VList
                                    ref={registerChild}
                                    height={height}
                                    onRowsRendered={onRowsRendered}
                                    rowCount={this.loadLimit}
                                    rowHeight={118}
                                    rowRenderer={this.renderItem}
                                    width={width}
                                />
                            )}
                        </AutoSizer>
                    )}
                </InfiniteLoader>
            </List>
        );
    }
}

render(VirtualizedScroll);
```

### 拖拽排序
使用 [dnd-kit](https://github.com/clauderic/dnd-kit/tree/master) 可轻松实现拖拽排序。

```jsx live=true dir="column" hideInDSM
import React, { useState } from 'react';
import { List, Avatar } from '@douyinfe/semi-ui';
import { DndContext, PointerSensor, MouseSensor, useSensors, useSensor } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { CSS as cssDndKit } from '@dnd-kit/utilities';
import classNames from 'classnames';

() => {
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
            transform: cssDndKit.Transform.toString(transform),
            transition,
            border: '1px solid var(--semi-color-border)',
            marginBottom: 12,
            cursor: 'grabbing',
            ...(isDragging ? { zIndex: 999, position: 'relative', backgroundColor: 'var(--semi-color-bg-0)' } : {}),

        };

        
        const itemCls = classNames(
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
};
```


### 带分页器 

你可以组合使用 Pagination， 实现一个分页的 List

```jsx live=true dir="column" hideInDSM

import React, { useState } from 'react';
import { List, Pagination } from '@douyinfe/semi-ui';

() => {
    const data = [
        '围城',
        '平凡的世界（全三册）',
        '三体（全集）',
        '雪中悍刀行（全集）',
        '撒哈拉的故事',
        '明朝那些事',
        '一禅小和尚',
        '沙丘',
        '被讨厌的勇气',
        '罪与罚',
        '月亮与六便士',
        '沉默的大多数',
    ];

    const [page, onPageChange] = useState(1);

    let pageSize = 4;

    const getData = (page) => {
        let start = (page - 1) * pageSize;
        let end = page * pageSize;
        return data.slice(start, end);
    };

    return (
        <div>
            <div style={{ marginRight: 16, width: 280, display: 'flex', flexWrap: 'wrap' }}>
                <List
                    dataSource={getData(page)}
                    split={false}
                    size='small'
                    className='component-list-demo-booklist'
                    style={{ border: '1px solid var(--semi-color-border)', flexBasis: '100%', flexShrink: 0 }}
                    renderItem={item => <List.Item className='list-item'>{item}</List.Item>}
                />
                <Pagination size='small' style={{ width: '100%', flexBasis: '100%', justifyContent: 'center' }} pageSize={pageSize} total={data.length} currentPage={page} onChange={cPage => onPageChange(cPage)} />
            </div>
        </div>
    );
};
```

### 带筛选器

你可以通过组装 Input 使用，实现对 List 列表的筛选

```jsx live=true dir="column"  hideInDSM

import React, { useState } from 'react';
import { List, Input } from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';

() => {
    const data = [
        '围城',
        '平凡的世界（全三册）',
        '三体（全集）',
        '雪中悍刀行（全集）',
        '撒哈拉的故事',
        '明朝那些事',
        '一禅小和尚',
        '沙丘',
        '被讨厌的勇气',
        '罪与罚',
    ];

    const [list, setList] = useState(data);

    const onSearch = (string) => {
        let newList;
        if (string) {
            newList = data.filter(item => item.includes(string));
        } else {
            newList = data;
        }
        setList(newList);
    };

    return (
        <div>
            <div style={{ marginRight: 16, width: 280, display: 'flex', flexWrap: 'wrap', border: '1px solid var(--semi-color-border)' }}>
                <List
                    className='component-list-demo-booklist'
                    dataSource={list}
                    split={false}
                    header={<Input onCompositionEnd={(v) => onSearch(v.target.value)} onChange={(v) => !v ? onSearch() : null} placeholder='搜索' prefix={<IconSearch />} />}
                    size='small'
                    style={{ flexBasis: '100%', flexShrink: 0, borderBottom: '1px solid var(--semi-color-border)' }}
                    renderItem={item =>
                        <List.Item className='list-item'>{item}</List.Item>
                    }
                />
            </div>
        </div>
    );
};
```

### 添加删除项

```jsx live=true dir="column" hideInDSM

import React, { useState } from 'react';
import { List, Input, Button } from '@douyinfe/semi-ui';
import { IconMinusCircle, IconPlusCircle } from '@douyinfe/semi-icons';

() => {
    const data = [
        '围城',
        '平凡的世界（全三册）',
        '三体（全集）',
        '雪中悍刀行（全集）',
        '撒哈拉的故事',
        '明朝那些事',
        '一禅小和尚',
        '沙丘',
        '被讨厌的勇气',
        '罪与罚',
        '月亮与六便士',
        '沉默的大多数',
        '第一人称单数',
    ];
    
    const [list, setList] = useState(data.slice(0, 8));

    const updateList = (item) => {
        let newList;
        if (item) {
            newList = list.filter(i => item !== i);
        } else {
            newList = list.concat(data.slice(list.length, list.length + 1));
        }
        setList(newList);
    };

    return (
        <div>
            <div style={{ marginRight: 16, width: 280, display: 'flex', flexWrap: 'wrap', border: '1px solid var(--semi-color-border)' }}>
                <List
                    className='component-list-demo-booklist'
                    dataSource={list}
                    split={false}
                    size='small'
                    style={{ flexBasis: '100%', flexShrink: 0, borderBottom: '1px solid var(--semi-color-border)' }}
                    renderItem={item => 
                        <div style={{ margin: 4 }} className='list-item'>
                            <Button type='danger' theme='borderless' icon={<IconMinusCircle />} onClick={() => updateList(item)} style={{ marginRight: 4 }} />
                            {item}
                        </div>
                    }
                />
                <div style={{ margin: 4, fontSize: 14 }} onClick={() => updateList()}>
                    <Button theme='borderless' icon={<IconPlusCircle />} style={{ marginRight: 4, color: 'var(--semi-color-info)' }}>
                    </Button>
                    新增书籍
                </div>
            </div>
        </div>
    );
};
```

### 单选或多选

你可以通过组合使用 Radio 或 Checkbox 将 List 增强为一个列表选择器

```jsx live=true dir="column" hideInDSM

import React, { useState } from 'react';
import { List, Input, Button, Checkbox, Radio, RadioGroup, CheckboxGroup } from '@douyinfe/semi-ui';

() => {
    const data = [
        '围城',
        '平凡的世界（全三册）',
        '三体（全集）',
        '雪中悍刀行（全集）',
        '撒哈拉的故事',
        '明朝那些事',
        '一禅小和尚',
        '沙丘',
        '被讨厌的勇气',
        '罪与罚',
        '月亮与六便士',
        '沉默的大多数',
        '第一人称单数',
    ];

    const [page, onPageChange] = useState(1);
    const [checkboxVal, setCV] = useState([...data[0]]);
    const [radioVal, setRV] = useState(data[0]);

    let pageSize = 8;

    const getData = (page) => {
        let start = (page - 1) * pageSize;
        let end = page * pageSize;
        return data.slice(start, end);
    };

    return (
        <div style={{ display: 'flex' }}>
            <div style={{ marginRight: 16, width: 280, display: 'flex', flexWrap: 'wrap' }}>
                <CheckboxGroup value={checkboxVal} onChange={(value) => setCV(value)}>
                    <List
                        dataSource={getData(page)}
                        className='component-list-demo-booklist'
                        split={false}
                        size='small'
                        style={{ border: '1px solid var(--semi-color-border)', flexBasis: '100%', flexShrink: 0 }}
                        renderItem={item => <List.Item className='list-item'><Checkbox value={item}>{item}</Checkbox></List.Item>}
                    />
                </CheckboxGroup>
            </div>
            <div style={{ marginRight: 16, width: 280, display: 'flex', flexWrap: 'wrap' }}>
                <RadioGroup value={radioVal} onChange={(e) => setRV(e.target.value)}>
                    <List
                        className='component-list-demo-booklist'
                        dataSource={getData(page)}
                        split={false}
                        size='small'
                        style={{ border: '1px solid var(--semi-color-border)', flexBasis: '100%', flexShrink: 0 }}
                        renderItem={item => <List.Item className='list-item'><Radio value={item}>{item}</Radio></List.Item>}
                    />
                </RadioGroup>
            </div>
        </div>
    );
};
```

### 响应键盘事件

你可以自行监听对应按键的键盘事件，实现不同 Item 的选择。如下面这个例子，可以使用上下方向键选择不同Item  

```jsx live=true dir="column" hideInDSM

import React, { useState, useRef } from 'react';
import { List, Input, Button } from '@douyinfe/semi-ui';

() => {
    const data = [
        '围城',
        '平凡的世界（全三册）',
        '三体（全集）',
        '雪中悍刀行（全集）',
        '撒哈拉的故事',
        '明朝那些事',
        '一禅小和尚',
        '沙丘',
        '被讨厌的勇气',
        '罪与罚',
        '月亮与六便士',
        '沉默的大多数',
        '第一人称单数',
    ];

    const [list, setList] = useState(data.slice(0, 10));
    const [hoverIndex, setHi] = useState(-1);
    const i = useRef(-1);

    let changeIndex = (offset) => {
        let currentIndex = i.current;
        let index = currentIndex + offset;
        if (index < 0) {
            index = list.length - 1;
        }
        if (index >= list.length) {
            index = 0;
        }
        i.current = index;
        setHi(index);
    };
    useEffect(() => {
        let keydownHandler = (event) => {
            let key = event.keyCode;
            switch (key) {
                case 38: // KeyCode.UP
                    event.preventDefault();
                    changeIndex(-1);
                    break;
                case 40: // KeyCode.DOWN
                    event.preventDefault();
                    changeIndex(1);
                    break;
                default:
                    break;
            }
        };
        window.addEventListener('keydown', keydownHandler);
        return () => {
            window.removeEventListener('keydown', keydownHandler);
        };
    }, []);

    return (
        <div>
            <div style={{ marginRight: 16, width: 280, display: 'flex', flexWrap: 'wrap', border: '1px solid var(--semi-color-border)' }}>
                <List
                    className='component-list-demo-booklist'
                    dataSource={list}
                    split={false}
                    size='small'
                    style={{ flexBasis: '100%', flexShrink: 0, borderBottom: '1px solid var(--semi-color-border)' }}
                    renderItem={(item, index) =>
                        <List.Item className={index === hoverIndex ? 'component-list-demo-booklist-active-item' : ''}>{item}</List.Item>
                    }
                />
            </div>
        </div>
    );
};
```

以上书单例子的Demo中涉及到的自定义样式如下

```scss
.component-list-demo-booklist {
    .list-item {
        &:hover {
            background-color: var(--semi-color-fill-0);
        }
        &:active {
            background-color: var(--semi-color-fill-1);
        }
    }
}


body > .component-list-demo-drag-item {
    font-size: 14px;
}

.component-list-demo-booklist-active-item {
    background-color: var(--semi-color-fill-0);
}
```


## API 参考

### List

| 属性         | 说明                                                     | 类型                             | 默认值     |
| ------------ | -------------------------------------------------------- | -------------------------------- | ---------- |
| bordered     | 是否显示边框                                             | boolean                          | `false`    |
| className    | 自定义样式类名                                           | string                           | -          |
| dataSource   | 列表数据源                                               | any[]                            | -          |
| emptyContent | 空列表的展示内容                                         | ReactNode                        | -          |
| footer       | 列表底部                                                 | ReactNode                        | -          |
| grid         | 列表栅格配置                                             | [Grid](/zh-CN/basic/grid#API参考)  | -          |
| header       | 列表头部                                                 | ReactNode                        | -          |
| layout       | 列表布局，支持`vertical`, `horizontal`                   | string                           | `vertical` |
| loadMore     | 加载更多的按钮                                           | ReactNode                        | -          |
| loading      | 是否处于加载中，为`true`时会显示 spin                    | boolean                          | `false`    |
| renderItem   | 当使用 dataSource 时，可以用 renderItem 自定义渲染列表项 | (item, ind) => ReactNode | -          |
| size         | 列表尺寸，支持 `small`, `default`, `large`                | string                           | `default`  |
| split        | 是否展示分割线                                           | boolean                          | `true`     |
| style        | 自定义样式对象                                           | CSSProperties                           | -          |
| onClick      | 点击回调事件 **v>=1.0.0**                                | (e: event) => void                         | -          |
| onRightClick | 右键点击回调事件 **v>=1.0.0**                            | (e: event) => void                         | -          |

### List grid props

**v>=1.7.0** 其他 grid 参数，请参考 [Grid](/zh-CN/basic/grid)

| 属性   | 说明                                                     | 类型           | 默认值 |
| ------ | -------------------------------------------------------- | -------------- | ------ |
| span   | 栅格占位格数                                             | number         | -      |
| gutter | 栅格间隔                                                 | number         | 0      |
| xs     | `<576px` 响应式栅格，可为栅格数或一个包含其他属性的对象  | number\|object | -      |
| sm     | `≥576px` 响应式栅格，可为栅格数或一个包含其他属性的对象  | number\|object | -      |
| md     | `≥768px` 响应式栅格，可为栅格数或一个包含其他属性的对象  | number\|object | -      |
| lg     | `≥992px` 响应式栅格，可为栅格数或一个包含其他属性的对象  | number\|object | -      |
| xl     | `≥1200px` 响应式栅格，可为栅格数或一个包含其他属性的对象 | number\|object | -      |
| xxl    | `≥1600px` 响应式栅格，可为栅格数或一个包含其他属性的对象 | number\|object | -      |

### List.Item

| 属性         | 说明                                                                                                | 类型      | 默认值       |
| ------------ | --------------------------------------------------------------------------------------------------- | --------- | ------------ |
| align        | 列表项头内容和主体内容的垂直对齐方式，支持 `flex-start`, `flex-end`, `center`, `baseline`, `stretch` | string    | `flex-start` |
| className    | 自定义样式类名                                                                                      | string    | -            |
| extra        | 列表项附加内容                                                                                      | ReactNode | -            |
| header       | 列表项头内容                                                                                        | ReactNode | -            |
| main         | 列表项主体内容                                                                                      | ReactNode | -            |
| style        | 自定义样式对象                                                                                      | CSSProperties    | -            |
| onClick      | 点击回调事件 **v>=1.0.0**                                                                           | (e: event) => void  | -            |
| onRightClick | 右键点击回调事件 **v>=1.0.0**                                                                       | (e: event) => void  | -            |


## 文案规范

- 首字母大写
- 结尾不跟随标点符号
- 语法平行：如主动态与被动态、陈述句与祈使句混合使用
  
## 设计变量
<DesignToken/>