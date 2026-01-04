---
localeCode: en-US
order: 74
category: Show
title: List
subTitle: List
icon: doc-list
dir: column
brief: Lists display a set of related contents
---

## Demos

### How to import

```jsx import
import { List } from '@douyinfe/semi-ui';
```

### Basic Usage

You can use `size` to size list. Supported values include `large`, `default`, `Small`. Header and Footer customized.

```jsx live=true dir="column" noInline=true 
import React from 'react';
import { List } from '@douyinfe/semi-ui';

class SimpleList extends React.Component {
    render() {
        const data = [
            'Do not go gentle into that good night,',
            'Old age should burn and rave at close of day;',
            'Rage, rage against the dying of the light.',
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
                <br />
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
                <br />
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

### Template

List.Item has a built-in template consisting of: `header`, `main`, and `extra`. The alignment of `header` and `main` set by `align` properties using one of `flex-start`(default), `flex-end`, `center`, `baseline`, and `stretch` .

```jsx live=true dir="column" noInline=true
import React from 'react';
import { List, ButtonGroup, Button, Avatar } from '@douyinfe/semi-ui';

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
                {`Life's but a walking shadow, a poor player, that struts and frets his hour upon the stage, and then is
                heard no more; it is a tale told by an idiot, full of sound and fury, signifying nothing.`}
            </p>,
            // eslint-disable-next-line react/jsx-key
            <p style={{ color: 'var(--semi-color-text-2)', margin: '4px 0', width: 500 }}>
                Come what come may, time and the hour run through the roughest day.
            </p>,
            // eslint-disable-next-line react/jsx-key
            <p style={{ color: 'var(--semi-color-text-2)', margin: '4px 0', width: 500 }}>
                {`Where shall we three meet again in thunder, lightning, or in rain? When the hurlyburly's done, when the
                battle's lost and won`}
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
                                    <span style={{ color: 'var(--semi-color-text-0)', fontWeight: 500 }}>Example</span>
                                    {item}
                                </div>
                            }
                            extra={
                                <ButtonGroup theme="borderless">
                                    <Button>Edit</Button>
                                    <Button>More</Button>
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

### Layout

Use `layout` property to set list layout, one of `vertical`(default) or `horizontal`.

```jsx live=true dir="column" noInline=true
import React from 'react';
import { List, Avatar } from '@douyinfe/semi-ui';

class LayoutList extends React.Component {
    render() {
        const data = [
            {
                title: 'Title 1',
                color: 'light-blue',
            },
            {
                title: 'Title 2',
                color: 'grey',
            },
            {
                title: 'Title 3',
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
                                        {` Life's but a walking shadow, a poor player, that struts and frets his hour upon
                                        the stage, and then is heard no more; it is a tale told by an idiot, full of
                                        sound and fury, signifying nothing.`}
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

### Grid

Use `grid` property to set grid layout. Use `span` to set the number of occupying spaces for each item and `gutter` for spacing between items.

```jsx live=true dir="column" noInline=true
import React from 'react';
import { List, Descriptions, Rating, ButtonGroup, Button } from '@douyinfe/semi-ui';

class LayoutList extends React.Component {
    render() {
        const data = [
            {
                title: 'Platform A',
                rating: 4.5,
                feedbacks: 124,
            },
            {
                title: 'Platform B',
                rating: 4,
                feedbacks: 108,
            },
            {
                title: 'Platform C',
                rating: 4.5,
                feedbacks: 244,
            },
            {
                title: 'Platform D',
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
                                        { key: 'Rating', value: <Rating allowHalf size="small" value={item.rating} /> },
                                        { key: 'Feedbacks', value: item.feedbacks },
                                    ]}
                                />
                                <div style={{ margin: '12px 0', display: 'flex', justifyContent: 'flex-end' }}>
                                    <ButtonGroup theme="borderless" style={{ marginTop: 8 }}>
                                        <Button>Edit</Button>
                                        <Button>More</Button>
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

### Responsive List

Refer to [Grid](/en-US/basic/grid) for responsive dimensions.

```jsx live=true dir="column" noInline=true
import React from 'react';
import { List, Descriptions, Rating, ButtonGroup, Button } from '@douyinfe/semi-ui';

class Responsive extends React.Component {
    render() {
        const data = [
            {
                title: 'Platform A',
                rating: 4.5,
                feedbacks: 124,
            },
            {
                title: 'Platform B',
                rating: 4,
                feedbacks: 108,
            },
            {
                title: 'Platform C',
                rating: 3.5,
                feedbacks: 244,
            },
            {
                title: 'Platform D',
                feedbacks: 189,
            },
            {
                title: 'Platform E',
                rating: 3,
                feedbacks: 128,
            },
            {
                title: 'Platform D',
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
                        Xs: 0,
                        sm: 0,
                        md: 12,
                        lg: 8,
                        Xl: 8,
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
                                        { key: 'Rating', value: <Rating allowHalf size="small" value={item.rating} /> },
                                        { key: 'Feedbacks', value: item.feedbacks },
                                    ]}
                                />
                                <div style={{ margin: '12px 0', display: 'flex', justifyContent: 'flex-end' }}>
                                    <ButtonGroup theme="borderless" style={{ marginTop: 8 }}>
                                        <Button>Edit</Button>
                                        <Button>More</Button>
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

### Load More

You can use `loadMore` to achieve loading state for more incoming contents.

```jsx live=true dir="column" noInline=true
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
                    <Button onClick={() => this.onLoadMore()}>Load More</Button>
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
                                        Create a consistent, good-looking, easy-to-use, and efficient user experience
                                        with a user-centric, content-first, and human-friendly design system
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

### Scroll to Load

You can integrate [react-infinite-scroller](https://github.com/CassetteRocks/react-infinite-scroller) to implement scrolling load list. Recommended interaction could be reveal a loadmore button after three scrolling loads.

```jsx live=true dir="column" noInline=true hideInDSM
import React from 'react';
import { List, Avatar, Spin, Button } from '@douyinfe/semi-ui';
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
                    <Button onClick={this.fetchData}>show more</Button>
                </div>
            ) : null;

        return (
            <div
                className
                Name="light-scrollbar"
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
                                            Create a consistent, good-looking, easy-to-use, and efficient user
                                            experience with a user-centric, content-first, and human-friendly design
                                            system
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

### Scroll to Load Infinite Lists

You can integrate [react-virtualized](https://github.com/bvaughn/react-virtualized) to implement infinite scrolling lists with virtualization to improve the performance for large amounts of data.

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
                            Create a consistent, good-looking, easy-to-use, and efficient user experience with a
                            user-centric, content-first, and human-friendly design system
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

### Drag Sort
You can integrate [dnd-kit](https://github.com/clauderic/dnd-kit/tree/master) to implement drag and drop sort.

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

### With Pagination

You can use Pagination in combination to achieve a paged List

```jsx live=true dir="column" hideInDSM
import React, { useState } from 'react';
import { List, Pagination } from '@douyinfe/semi-ui';

() => {
    const data = [
        'Siege',
        'The ordinary world',
        'Three Body',
        'Snow in the Snow',
        'Saharan story',
        'Those things in the Ming Dynasty',
        'A little monk of Zen',
        'Dune',
        'The courage to be hated',
        'Crime and Punishment',
        'Moon and sixpence',
        'The silent majority',
        'First person singular',
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

### With filter

You can use it by assembling Input to filter the List

```jsx live=true dir="column"  hideInDSM
import React, { useState } from 'react';
import { List, Input } from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';

() => {
    const data = [
        'Siege',
        'The ordinary world',
        'Three Body',
        'Snow in the Snow',
        'Saharan story',
        'Those things in the Ming Dynasty',
        'A little monk of Zen',
        'Dune',
        'The courage to be hated',
        'Crime and Punishment',
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
                    header={<Input onCompositionEnd={(v) => onSearch(v.target.value)} onChange={(v) => !v ? onSearch() : null} placeholder='search' prefix={<IconSearch />} />}
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

### Add delete item

```jsx live=true dir="column" hideInDSM
import React, { useState } from 'react';
import { List, Input, Button } from '@douyinfe/semi-ui';
import { IconMinusCircle, IconPlusCircle } from '@douyinfe/semi-icons';

() => {
    const data = [
        'Siege',
        'The ordinary world',
        'Three Body',
        'Snow in the Snow',
        'Saharan story',
        'Those things in the Ming Dynasty',
        'A little monk of Zen',
        'Dune',
        'The courage to be hated',
        'Crime and Punishment',
        'Moon and sixpence',
        'The silent majority',
        'First person singular',
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
                    Add book
                </div>
            </div>
        </div>
    );
};
```

### Single or multiple selection

You can enhance the List into a list selector by combining Radio or Checkbox

```jsx live=true dir="column" hideInDSM

import React, { useState } from 'react';
import { List, Input, Button, Checkbox, Radio, RadioGroup, CheckboxGroup } from '@douyinfe/semi-ui';

() => {
    const data = [
        'Siege',
        'The ordinary world',
        'Three Body',
        'Snow in the Snow',
        'Saharan story',
        'Those things in the Ming Dynasty',
        'A little monk of Zen',
        'Dune',
        'The courage to be hated',
        'Crime and Punishment',
        'Moon and sixpence',
        'The silent majority',
        'First person singular',
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

### Keyboard events

You can monitor the keyboard events of the corresponding keys by yourself to realize the selection of different items. As in the following example, you can use the up and down arrow keys to select different items

```jsx live=true dir="column" hideInDSM
import React, { useState, useRef } from 'react';
import { List, Input, Button } from '@douyinfe/semi-ui';

() => {
    const data = [
        'Siege',
        'The ordinary world',
        'Three Body',
        'Snow in the Snow ',
        'Saharan story',
        'Those things in the Ming Dynasty',
        'A little monk of Zen',
        'Dune',
        'The courage to be hated',
        'Crime and Punishment',
        'Moon and sixpence',
        'The silent majority',
        'First person singular',
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

The custom styles involved in the Demo of the above book list example are as follows

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

## API reference

### List

| Properties   | Instructions                                                       | type                             | Default    |
| ------------ | ------------------------------------------------------------------ | -------------------------------- | ---------- |
| bordered     | Toggle whether to display border                                   | boolean                          | `false`    |
| className    | Class name                                                         | string                           | -          |
| dataSource   | List data source                                                   | any[]                            | -          |
| emptyContent | Displayed content when empty                                       | ReactNode                        | -          |
| footer       | Footer of list                                                     | ReactNode                        | -          |
| grid         | Grid configuration                                                 | [Grid](/en-US/basic/grid#API-reference) | -   |
| header       | Header of list                                                     | ReactNode                        | -          |
| layout       | Layout, one of `vertical`, `vertical`                              | string                           | `vertical` |
| loadMore     | Loadmore button                                                    | ReactNode                        | -          |
| loading      | Toggle whether to display `Spin` when loading                      | boolean                          | `false`    |
| renderItem   | When using dataSource, you can customize rendering with renderItem | (item, ind) => ReactNode | -          |
| size         | Size, one of `small`, `default`, `large`                           | string                           | `default`  |
| split        | Toggle whether to display split line                               | boolean                          | `true`     |
| style        | Inline style                                                       | CSSProperties                           | -          |
| onClick      | Callback function when click an item **v>=1.0.0**                  | function                         | -          |
| onRightClick | Callback function when right click an item **v>=1.0.0**            | function                         | -          |

### Listgrid props

**v>=1.7.0** Other grid properties are also supported. Refer to [Grid](/en-US/basic/grid).

| Properties | Instructions                                                                  | type           | Default |
| ---------- | ----------------------------------------------------------------------------- | -------------- | ------- |
| span       | Number of grid spaces                                                         | number         | -       |
| gutter     | Grid spacing                                                                  | number         | 0       |
| xs         | `< 576px` responsive grid, a number or an object containing other attributes  | number\|object | -       |
| sm         | `≥ 576px` responsive grid, a number or an object containing other properties  | number\|object | -       |
| md         | `≥ 768px` responsive grid, a number or an object containing other properties  | number\|object | -       |
| lg         | `≥ 992px` responsive grid, a number or an object containing other properties  | number\|object | -       |
| xl         | `≥ 1200px` responsive grid, a number or an object containing other properties | number\|object | -       |
| xxl        | `≥ 1600px` responsive grid, a number or an object containing other properties | number\|object | -       |

### List.Item

| Properties   | Instructions                                                                                            | type      | Default      |
| ------------ | ------------------------------------------------------------------------------------------------------- | --------- | ------------ |
| align        | Vertical alignment of header and main, one of `flex-start`, `flex-end`, `center`, `baseline`, `stretch` | string    | `flex-start` |
| className    | Class name                                                                                              | string    | -            |
| extra        | Additional content                                                                                      | ReactNode | -            |
| header       | List item header content                                                                                | ReactNode | -            |
| main         | List item body content                                                                                  | ReactNode | -            |
| onClick      | Callback function when click an item **v>=1.0.0**                                                       | function  | -            |
| onRightClick | Callback function when right click an item **v>=1.0.0**                                                 | function  | -            |
| style        | Inline style                                                                                            | CSSProperties    | -            |

## Content Guidelines

- Capitalize the first letter
- do not follow punctuation at the end
- Grammatical parallelism: mixed use of active and passive, declarative and imperative sentences

## Design Tokens
<DesignToken/>
