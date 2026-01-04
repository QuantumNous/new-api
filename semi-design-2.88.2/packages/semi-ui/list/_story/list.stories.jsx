import React from 'react';
import InfiniteScroll from 'react-infinite-scroller';
import { DndProvider, DragSource, DropTarget, useDrag, useDrop } from 'react-dnd';
import HTML5Backend from 'react-dnd-html5-backend';
import update from 'immutability-helper';
import { Skeleton, Avatar, Button, ButtonGroup, Spin } from '../../index';
import List from '..';
import AutoSizer from 'react-virtualized/dist/commonjs/AutoSizer';
import VList from 'react-virtualized/dist/commonjs/List';
import InfiniteLoader from 'react-virtualized/dist/commonjs/InfiniteLoader';
import DndKitDrag from './DndKitDrag';

const Item = List.Item;


export default {
  title: 'List'
}

const data = [
  '从明天起，做一个幸福的人',
  '喂马，劈柴，周游世界',
  '从明天起，关心粮食和蔬菜',
  '我有一所房子，面朝大海，春暖花开',
];

const titles = ['示例标题1', '示例标题2', '示例标题3', '示例标题4', '示例标题5', '示例标题6'];

export const BasicList = () => (
  <div>
    <h3 style={{ marginBottom: 16 }}>Default Size</h3>
    <List
      header={<div>Header</div>}
      footer={<div>Footer</div>}
      bordered
      dataSource={data}
      renderItem={item => <Item>{item}</Item>}
    />
    <h3 style={{ marginBottom: 16 }}>Default Size</h3>
    <List header={<div>Header</div>} footer={<div>Footer</div>} bordered>
      <Item onRightClick={() => console.log('key 1')}>
        <span>从明天起，做一个幸福的人</span>
      </Item>
      <Item>
        <span>喂马，劈柴，周游世界</span>
      </Item>
      <Item>
        <span>从明天起，关心粮食和蔬菜'</span>
      </Item>
      <Item>
        <span>我有一所房子，面朝大海，春暖花开</span>
      </Item>
    </List>
    <h3 style={{ margin: '16px 0' }}>Small Size</h3>
    <List
      size="small"
      header={<div>Header</div>}
      footer={<div>Footer</div>}
      bordered
      onClick={e => console.log(e.target)}
      onRightClick={e => console.log(e.target)}
      dataSource={data}
      renderItem={item => <List.Item>{item}</List.Item>}
    />
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
);

BasicList.story = {
  name: 'basic list',
};

export const EmptyList = () => (
  <div>
    <List header={<div>Header</div>} footer={<div>Footer</div>} bordered />
  </div>
);

EmptyList.story = {
  name: 'empty list',
};

export const JsxList = () => (
  <List
    header={<div>Header</div>}
    footer={<div>Footer</div>}
    bordered
    split={false}
    // layout="horizontal"
    // grid
    grid={{
      gutter: 12,
      span: 6,
    }}
  >
    <Item>
      <span>从明天起，做一个幸福的人</span>
    </Item>
    <Item>
      <span>喂马，劈柴，周游世界</span>
    </Item>
    <Item>
      <span>从明天起，关心粮食和蔬菜'</span>
    </Item>
    <Item>
      <span>我有一所房子，面朝大海，春暖花开</span>
    </Item>
  </List>
);

JsxList.story = {
  name: 'jsx list',
};

export const NoBorder = () => (
  <div>
    <List
      header={<div>Header</div>}
      footer={<div>Footer</div>}
      dataSource={data}
      renderItem={item => <List.Item>{item}</List.Item>}
    />
    <br />
    <br />
    <List
      header={<div>Header</div>}
      footer={<div>Footer</div>}
      split={false}
      dataSource={data}
      renderItem={item => <List.Item>{item}</List.Item>}
    />
  </div>
);

NoBorder.story = {
  name: 'no border',
};

export const ItemStructure = () => (
  <div style={{ padding: 12, border: '1px solid var(--semi-color-border)', margin: 12 }}>
    <List
      dataSource={data}
      renderItem={item => (
        <List.Item
          header={<Avatar color="red">CA</Avatar>}
          main={
            <div>
              <span style={{ color: 'var(--semi-color-text-0)' }}>示例标题</span>
              <p style={{ color: 'var(--semi-color-text-2)', margin: '4px 0' }}>
                Semi Design 是由抖音前端团队与 UED
                团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
                Web 应用。
              </p>
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

ItemStructure.story = {
  name: 'item structure',
};

export const ItemLayout = () => (
  <div style={{ padding: 12, border: '1px solid var(--semi-color-border)', margin: 12 }}>
    <List
      dataSource={data}
      layout="horizontal"
      renderItem={item => (
        <List.Item
          header={<Avatar color="red">CA</Avatar>}
          main={
            <div>
              <span style={{ color: 'var(--semi-color-text-0)' }}>示例标题</span>
              <p style={{ color: 'var(--semi-color-text-2)', margin: '4px 0' }}>
                Semi Design 是由抖音前端团队与 UED
                团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
                Web 应用。
              </p>
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

ItemLayout.story = {
  name: 'item layout',
};

export const ItemLayoutAlign = () => (
  <div style={{ padding: 12, border: '1px solid var(--semi-color-border)', margin: 12 }}>
    <List
      dataSource={data}
      layout="horizontal"
      renderItem={item => (
        <List.Item
          header={<Avatar color="red">CA</Avatar>}
          main={
            <div>
              <span style={{ color: 'var(--semi-color-text-0)' }}>示例标题</span>
              <p style={{ color: 'var(--semi-color-text-2)', margin: '4px 0' }}>
                Semi Design 是由抖音前端团队与 UED
                团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
                Web 应用。
              </p>
            </div>
          }
          align="flex-end"
          extra={
            <ButtonGroup theme="borderless">
              <Button>编辑</Button>
              <Button>更多</Button>
            </ButtonGroup>
          }
        />
      )}
    />
    <br />
    <List
      dataSource={data}
      layout="horizontal"
      renderItem={item => (
        <List.Item
          header={<Avatar color="red">CA</Avatar>}
          main={
            <div>
              <span style={{ color: 'var(--semi-color-text-0)' }}>示例标题</span>
              <p style={{ color: 'var(--semi-color-text-2)', margin: '4px 0' }}>
                Semi Design 是由抖音前端团队与 UED
                团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
                Web 应用。
              </p>
            </div>
          }
          align="center"
          extra={
            <ButtonGroup theme="borderless">
              <Button>编辑</Button>
              <Button>更多</Button>
            </ButtonGroup>
          }
        />
      )}
    />
    <br />
    <List
      dataSource={data}
      layout="horizontal"
      renderItem={item => (
        <List.Item
          header={<Avatar color="red">CA</Avatar>}
          main={
            <div>
              <span style={{ color: 'var(--semi-color-text-0)' }}>示例标题</span>
              <p style={{ color: 'var(--semi-color-text-2)', margin: '4px 0' }}>
                Semi Design 是由抖音前端团队与 UED
                团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
                Web 应用。
              </p>
            </div>
          }
          align="baseline"
          extra={
            <ButtonGroup theme="borderless">
              <Button>编辑</Button>
              <Button>更多</Button>
            </ButtonGroup>
          }
        />
      )}
    />
    <br />
    <List
      dataSource={data}
      layout="horizontal"
      renderItem={item => (
        <List.Item
          header={<Avatar color="red">CA</Avatar>}
          main={
            <div>
              <span style={{ color: 'var(--semi-color-text-0)' }}>示例标题</span>
              <p style={{ color: 'var(--semi-color-text-2)', margin: '4px 0' }}>
                Semi Design 是由抖音前端团队与 UED
                团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
                Web 应用。
              </p>
            </div>
          }
          align="stretch"
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

ItemLayoutAlign.story = {
  name: 'item layout align',
};

export const Grid = () => (
  <div style={{ padding: 12, border: '1px solid var(--semi-color-border)', margin: 12 }}>
    <List
      grid={{
        gutter: 24,
        span: 6,
      }}
      dataSource={data}
      renderItem={item => (
        <List.Item>
          <div style={{ border: '1px solid var(--semi-color-border)', height: '50px' }}>{item}</div>
        </List.Item>
      )}
    />
  </div>
);

Grid.story = {
  name: 'grid',
};

export const ResponsiveGrid = () => (
  <div style={{ padding: 12, border: '1px solid var(--semi-color-border)', margin: 12 }}>
    <List
      grid={{
        gutter: 16,
        xs: 24,
        sm: 12,
        md: 6,
        lg: 6,
        xl: 4,
        xxl: 8,
      }}
      dataSource={titles}
      renderItem={item => (
        <List.Item
          style={{ padding: 12 }}
          header={<Avatar color="red">CA</Avatar>}
          main={
            <div>
              <span style={{ color: 'var(--semi-color-text-0)' }}>示例标题</span>
              <p style={{ color: 'var(--semi-color-text-2)', margin: '4px 0' }}>
                Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统。
              </p>
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

ResponsiveGrid.story = {
  name: 'responsive grid',
};

class LoadMoreList extends React.Component {
  constructor() {
    super();

    const count = 3;
    const dataList = [];
    for (let i = 0; i < 40; i++) {
      dataList.push({
        color: 'grey',
        title: `Semi Design Title ${i}`,
        loading: false,
      });
    }
    this.data = dataList;
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
        }, 1500);
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
          </Skeleton>
        )}
      />
    );
  }
}
export const LoadMore = () => <LoadMoreList />;

LoadMore.story = {
  name: 'load more',
};

class ScrollLoad extends React.Component {
  constructor() {
    super();

    const count = 6;
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
        }, 1500);
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
    const showLoadMore = this.count % 3 === 0;
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
      <div className="demo-infinite-container" style={{ height: 420, overflow: 'auto' }}>
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
export const _ScrollLoad = () => <ScrollLoad />;

_ScrollLoad.story = {
  name: 'scroll load',
};

const listItems = [
  {
    title: 'Semi Design Title 1',
    color: 'red',
  },
  {
    title: 'Semi Design Title 2',
    color: 'grey',
  },
  {
    title: 'Semi Design Title 3',
    color: 'light-green',
  },
  {
    title: 'Semi Design Title 4',
    color: 'light-blue',
  },
  {
    title: 'Semi Design Title 5',
    color: 'pink',
  },
];

const cardSource = {
  beginDrag(props) {
    return {
      id: props.id,
      index: props.index,
    };
  },
};

const cardTarget = {
  hover(props, monitor, component) {
    // test demo below is from react-dnd and react-dnd-html5-backend. https://react-dnd.github.io/react-dnd/about
    const dragIndex = monitor.getItem().index;
    const hoverIndex = props.index;

    if (dragIndex === hoverIndex) {
      return;
    }
    const hoverBoundingRect = component.node.getBoundingClientRect();
    const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
    const clientOffset = monitor.getClientOffset();
    const hoverClientY = clientOffset.y - hoverBoundingRect.top;
    if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
      return;
    }

    if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
      return;
    }

    monitor.getItem().index = hoverIndex;
    props.moveItem(dragIndex, hoverIndex);
  },
};

function collectDragSource(connect, monitor) {
  return {
    connectDragSource: connect.dragSource(),
    // isDragging: monitor.isDragging()
    draggingItem: monitor.getItem(),
  };
}

function collectDropTarget(connect) {
  return {
    connectDropTarget: connect.dropTarget(),
  };
}

class DraggableItem extends React.Component {
  render() {
    const { component, draggingItem, index, connectDragSource, connectDropTarget } = this.props;
    const opacity = draggingItem && draggingItem.index === index ? 0.3 : 1;
    const style = {
      border: '1px solid var(--semi-color-border)',
      marginBottom: 12,
      backgroundColor: 'white',
      cursor: 'move',
    };

    return connectDragSource(
      connectDropTarget(
        <div ref={node => {this.node = node}} style={{ ...style, opacity }}>
          {component}
        </div>
      )
    );
  }
}

DraggableItem = DragSource('item', cardSource, collectDragSource)(DraggableItem);
DraggableItem = DropTarget('item', cardTarget, collectDropTarget)(DraggableItem);

class DraggableList extends React.Component {
  constructor() {
    super();
    this.state = {
      data: listItems,
    };
  }

  moveItem = (dragIndex, hoverIndex) => {
    const { data } = this.state;
    const draggingItem = data[dragIndex];
    this.setState(
      update(this.state, {
        data: {
          $splice: [
            [dragIndex, 1],
            [hoverIndex, 0, draggingItem],
          ],
        },
      })
    );
  };

  renderDraggable = (item, id) => {
    const content = (
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
    );
    return (
      <DraggableItem
        key={item.title}
        index={id}
        id={item.title}
        component={content}
        moveItem={this.moveItem}
      />
    );
  };

  render() {
    const { data } = this.state;
    return (
      <div style={{ padding: 12, border: '1px solid var(--semi-color-border)', margin: 12 }}>
        <DndProvider backend={HTML5Backend}>
          <List dataSource={data} renderItem={this.renderDraggable} />
        </DndProvider>
      </div>
    );
  }
}

export const Draggable = () => <DraggableList />;

Draggable.story = {
  name: 'draggable',
};

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

export const Virtualized = () => <VirtualizedScroll />;

Virtualized.story = {
  name: 'virtualized',
};

export const DndKitDragDemo = () => <DndKitDrag />;
