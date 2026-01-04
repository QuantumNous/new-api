import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Transfer, Button, Popover, SideSheet, Avatar, Checkbox, Tree, Input, Tag } from '../../index';
import { omit, values, isNull } from 'lodash';
import './transfer.scss';
import { IconClose, IconSearch, IconHandle } from '@douyinfe/semi-icons';
import {
  useSortable,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import { CSS as cssDndKit } from '@dnd-kit/utilities';

import {
  closestCenter,
  DragOverlay,
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  KeyboardSensor,
  TraversalOrder
} from '@dnd-kit/core';

export default {
  title: 'Transfer'
}

const commonProps = {
  onSelect: (...args) => {
    console.log('onSelect');
    console.log(...args);
  },
  onChange: (...args) => {
    console.log('onChange');
    console.log(...args);
  },
  onDeselect: (...args) => {
    console.log('onDeselect');
    console.log(...args);
  },
  onSearch: (...args) => {
    console.log('onSearch');
    console.log(...args);
  },
};

const data = Array.from({ length: 20 }, (v, i) => {
  return {
    label: `选项名称${i}`,
    value: i,
    disabled: false,
    key: `key-${i}`,
  };
});

const treeData = [
  {
    label: 'Asia',
    value: 'Asia',
    key: '0',
    children: [
      {
        label: 'China',
        value: 'China',
        key: '0-0',
        children: [
          {
            label: 'Beijing',
            value: 'Beijing',
            key: '0-0-0',
            disabled: true,
          },
          {
            label: 'ShanghaionChangeonChangeonChange',
            value: 'Shanghai',
            key: '0-0-1',
          },
          {
            label: 'Chengdu',
            value: 'Chengdu',
            key: '0-0-2',
          },
          {
            label: 'Chongqing',
            value: 'Chongqing',
            key: '0-0-3',
          },
        ],
      },
      {
        label: 'Japan',
        value: 'Japan',
        key: '0-1',
        children: [
          {
            label: 'Osaka',
            value: 'Osaka',
            key: '0-1-0',
          },
        ],
      },
    ],
  },
  {
    label: 'North America',
    value: 'North America',
    key: '1',
    children: [
      {
        label: 'United States',
        value: 'United States',
        key: '1-0',
      },
      {
        label: 'Canada',
        value: 'Canada',
        key: '1-1',
      },
    ],
  },
];

const dataWithGroup = [
  {
    title: '类别A',
    children: [
      { label: '选项名称1', value: 1, disabled: false, key: 1 },
      { label: '选项名称2', value: 2, disabled: false, key: 2 },
      { label: '选项名称3', value: 3, disabled: false, key: 3 },
    ],
  },
  {
    title: '类别B',
    children: [
      { label: '选项名称1', value: 4, disabled: true, key: 4 },
      { label: '选项名称2', value: 5, disabled: false, key: 5 },
      { label: '选项名称3', value: 6, disabled: false, key: 6 },
    ],
  },
  {
    title: '类别C',
    children: [
      { label: '选项名称1', value: 7, disabled: false, key: 7 },
      { label: '选项名称2', value: 8, disabled: false, key: 8 },
      { label: '选项名称3', value: 9, disabled: false, key: 9 },
      { label: '选项名称3', value: 10, disabled: false, key: 10 },
      { label: '选项名称3', value: 11, disabled: false, key: 11 },
      { label: '选项名称3', value: 12, disabled: false, key: 12 },
      { label: '选项名称3', value: 13, disabled: false, key: 13 },
    ],
  },
];

const DefaultTransfer = () => {
  const [dataSource, setDataSource] = useState([]);
  const [treeDataSource, setTreeDataSource] = useState([]);
  return (
    <div style={{ margin: 10, padding: 10, width: 600 }}>
      <Button onClick={() => setDataSource(data)}>更改列表数据源</Button>
      <Transfer {...commonProps} dataSource={dataSource} defaultValue={[]} />
      <Button onClick={() => setTreeDataSource(treeData)}>更改树数据源</Button>
      <Transfer type="treeList" dataSource={treeDataSource}></Transfer>
    </div>
  );
};

export const _Transfer = DefaultTransfer;

export const TransferDraggable = () => (
  <div style={{ margin: 10, padding: 10, width: 600 }}>
    <Transfer {...commonProps} dataSource={data} defaultValue={[2, 4]} draggable />
  </div>
);

TransferDraggable.story = {
  name: 'Transfer draggable',
};

export const TransferDraggableAndDisabled = () => {
  const data = Array.from({ length: 30 }, (v, i) => {
      return {
          label: `选项名称 ${i}`,
          value: i,
          key: `key-${i}`,
          disabled: true,
      };
  });
  return (
    <>
      <div>Transfer设置draggable, 并且左侧面板中的选项disabled </div>
      <div>符合预期的行为： 右侧面板hover不会出现删除按钮，因此不可以点击删除，但是可以拖拽 </div>
      <Transfer
          style={{ width: 568, height: 416 }}
          dataSource={data}
          defaultValue={[2, 4]}
          draggable
          onChange={(values, items) => console.log(values, items)}
      />
    </>
  );
};

TransferDraggableAndDisabled.story = {
  name: 'transfer draggable and disabled',
}


const ControlledTransfer = () => {
  const [value, setValue] = useState([2, 3]);

  const handleChange = value => {
    setValue(value);
  };

  return (
    <div style={{ margin: 10, padding: 10, width: 600 }}>
      <Transfer {...commonProps} dataSource={data} value={value} onChange={handleChange} />
    </div>
  );
};

export const ControlledTransferDemo = () => <ControlledTransfer />;

ControlledTransferDemo.story = {
  name: '受控Transfer',
};

export const Loading = () => <Transfer loading />;

Loading.story = {
  name: 'loading',
};

export const GroupTransfer = () => (
  <div style={{ margin: 10, padding: 10, width: 600 }}>
    <Transfer {...commonProps} dataSource={dataWithGroup} type="groupList" />

    <Transfer {...commonProps} dataSource={dataWithGroup} defaultValue={[2, 4]} type="groupList" />
  </div>
);

GroupTransfer.story = {
  name: '分组Transfer',
};

const customFilter = (sugInput, item) => {
  return item.value.includes(sugInput) || item.label.includes(sugInput);
};

export const CustomFilterRenderSourceItemRenderSelectedItem = () => {
  const data = [
    {
      label: '夏可漫',
      value: 'xiakeman@example.com',
      abbr: '夏',
      color: 'amber',
      area: 'US',
      key: 1,
    },
    {
      label: '申悦',
      value: 'shenyue@example.com',
      abbr: '申',
      color: 'indigo',
      area: 'UK',
      key: 2,
    },
    {
      label: '文嘉茂',
      value: 'wenjiamao@example.com',
      abbr: '文',
      color: 'cyan',
      area: 'HK',
      key: 3,
    },
    {
      label: '曲晨一',
      value: 'quchenyi@example.com',
      abbr: '一',
      color: 'blue',
      area: 'India',
      key: 4,
    },
    {
      label: '曲晨二',
      value: 'quchener@example.com',
      abbr: '二',
      color: 'blue',
      area: 'India',
      key: 5,
    },
    {
      label: '曲晨三',
      value: 'quchensan@example.com',
      abbr: '三',
      color: 'blue',
      area: 'India',
      key: 6,
    },
  ];

  const renderSourceItem = item => {
    return (
      <div className="components-transfer-demo-source-item">
        <Checkbox
          onChange={() => {
            item.onChange();
          }}
          key={item.label}
          checked={item.checked}
          style={{ paddingLeft: 12, height: 52 }}
        >
          <Avatar color={item.color} size="small">
            {item.abbr}
          </Avatar>
          <div className="info">
            <div className="name">{item.label}</div>
            <div className="email">{item.value}</div>
          </div>
        </Checkbox>
      </div>
    );
  };
  const renderSelectedItem = item => {
    const { sortableHandle } = item;
    const DragHandle = sortableHandle(() => <IconHandle className={`semi-transfer-right-item-drag-handler`} />); 
    return (
      <div className="components-transfer-demo-selected-item" key={item.label}>
        <DragHandle />
        <Avatar color={item.color} size="small">
          {item.abbr}
        </Avatar>
        <div className="info">
          <div className="name">{item.label}</div>
          <div className="email">{item.value}</div>
        </div>
        <IconClose onClick={item.onRemove} />
      </div>
    );
  };
  return (
    <div style={{ margin: 10, padding: 10, width: 600 }}>
      <Transfer
        draggable
        {...commonProps}
        dataSource={data}
        filter={customFilter}
        defaultValue={['xiakeman@example.com']}
        renderSelectedItem={renderSelectedItem}
        renderSourceItem={renderSourceItem}
        inputProps={{ placeholder: '可通过邮箱或者姓名搜索' }}
      />
    </div>
  );
};

CustomFilterRenderSourceItemRenderSelectedItem.story = {
  name: 'custom filter, renderSourceItem, renderSelectedItem',
};

const TreeTransferDemo = () => {
  const treeData = [
    {
      label: 'Asia',
      value: 'Asia',
      key: '0',
      children: [
        {
          label: 'China',
          value: 'China',
          key: '0-0',
          children: [
            {
              label: 'Beijing',
              value: 'Beijing',
              key: '0-0-0',
              disabled: true,
            },
            {
              label: 'ShanghaionChangeonChangeonChange',
              value: 'Shanghai',
              key: '0-0-1',
            },
            {
              label: 'Chengdu',
              value: 'Chengdu',
              key: '0-0-2',
            },
            {
              label: 'Chongqing',
              value: 'Chongqing',
              key: '0-0-3',
            },
          ],
        },
        {
          label: 'Japan',
          value: 'Japan',
          key: '0-1',
          children: [
            {
              label: 'Osaka',
              value: 'Osaka',
              key: '0-1-0',
            },
          ],
        },
      ],
    },
    {
      label: 'North America',
      value: 'North America',
      key: '1',
      children: [
        {
          label: 'United States',
          value: 'United States',
          key: '1-0',
        },
        {
          label: 'Canada',
          value: 'Canada',
          key: '1-1',
        },
      ],
    },
  ];
  const [value, $value] = useState(['Shanghai']);

  const onSearch = v => {
    console.log(v);
  };
  const onChange = v => {
    console.log(v);
    $value(v);
  };

  const flatTreeData = dataSource => {
    let newData = [];
    let stack = [...dataSource].reverse();
    while (stack.length) {
      const current = stack.pop();
      if (current.children && Array.isArray(current.children)) {
        const nodes = current.children;
        for (let i = nodes.length - 1; i >= 0; i--) {
          const child = { ...nodes[i] };
          stack.push(child);
        }
      } else {
        current.isLeaf = true;
      }
      newData.push(omit(current, ['children']));
    }
    return newData;
  };

  const flatNodes = flatTreeData(treeData);

  const renderSourcePanel = ({ value, onSelect }) => {
    return (
      <section style={{ width: '50%' }}>
        <Tree
          defaultExpandAll
          multiple
          treeData={treeData}
          disableStrictly
          value={value}
          onChange={onSelect}
        ></Tree>
      </section>
    );
  };

  return (
    <div style={{ margin: 10, padding: 10, width: 600 }}>
      <Transfer
        type="treeList"
        draggable
        dataSource={treeData}
        value={value}
        onChange={onChange}
        onSearch={onSearch}
      ></Transfer>
      <Transfer
        type="treeList"
        draggable
        dataSource={treeData}
        value={value}
        renderSourcePanel={renderSourcePanel}
        onChange={onChange}
        onSearch={onSearch}
      ></Transfer>
    </div>
  );
};

export const TreeTransfer = () => <TreeTransferDemo />;

TreeTransfer.story = {
  name: 'tree transfer',
};

class CustomRenderDemo extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      dataSource: Array.from({ length: 100 }, (v, i) => ({
        label: `海底捞门店 ${i}`,
        value: i,
        disabled: false,
        key: i,
      })),
    };
    this.renderSourcePanel = this.renderSourcePanel.bind(this);
    this.renderSelectedPanel = this.renderSelectedPanel.bind(this);
    this.renderItem = this.renderItem.bind(this);
  }

  renderItem(type, item, onItemAction, selectedItems) {
    let buttonText = '删除';
    if (type === 'source') {
      let checked = selectedItems.has(item.key);
      buttonText = checked ? '删除' : '添加';
    }
    return (
      <div className="semi-transfer-item panel-item" key={item.label}>
        <p>{item.label}</p>
        <Button
          theme="borderless"
          type="primary"
          onClick={() => onItemAction(item)}
          className="panel-item-remove"
          size="small"
        >
          {buttonText}
        </Button>
      </div>
    );
  }

  renderSourcePanel(props) {
    const {
      loading,
      noMatch,
      filterData,
      selectedItems,
      allChecked,
      onAllClick,
      inputValue,
      onSearch,
      onSelectOrRemove,
    } = props;
    let content;
    switch (true) {
      case loading:
        content = <Spin loading />;
        break;
      case noMatch:
        content = <div className="empty sp-font">{inputValue ? '无搜索结果' : '暂无内容'}</div>;
        break;
      case !noMatch:
        content = filterData.map(item =>
          this.renderItem('source', item, onSelectOrRemove, selectedItems)
        );
        break;
      default:
        content = null;
        break;
    }
    return (
      <section className="source-panel">
        <div className="panel-header sp-font">门店列表</div>
        <div className="panel-main">
          <Input
            style={{ width: 454, margin: '12px 14px' }}
            prefix={<IconSearch />}
            onChange={onSearch}
            showClear
          />
          <div className="panel-controls sp-font">
            <span>待选门店: {filterData.length}</span>
            <Button onClick={onAllClick} theme="borderless" size="small">
              {allChecked ? '取消全选' : '全选'}
            </Button>
          </div>
          <div className="panel-list">{content}</div>
        </div>
      </section>
    );
  }

  renderSelectedPanel(props) {
    const { selectedData, onClear, clearText, onRemove } = props;

    let mainContent = selectedData.map(item => this.renderItem('selected', item, onRemove));

    if (!selectedData.length) {
      mainContent = <div className="empty sp-font">暂无数据，请从左侧筛选</div>;
    }

    return (
      <section className="selected-panel">
        <div className="panel-header sp-font">
          <div>已选同步门店: {selectedData.length}</div>
          <Button theme="borderless" type="primary" onClick={onClear} size="small">
            {clearText || '清空 '}
          </Button>
        </div>
        <div className="panel-main">{mainContent}</div>
      </section>
    );
  }

  render() {
    const { dataSource } = this.state;
    return (
      <Transfer
        onChange={values => console.log(values)}
        className="component-transfer-demo-custom-panel"
        renderSourcePanel={this.renderSourcePanel}
        renderSelectedPanel={this.renderSelectedPanel}
        dataSource={dataSource}
      />
    );
  }
}

export const CustomRender = () => <CustomRenderDemo />;

CustomRender.story = {
  name: 'customRender',
};

function SortableList({
  items,
  onSortEnd,
  renderItem,
}) {
  const [activeId, setActiveId] = useState(null);
  const sensors = useSensors(
      useSensor(MouseSensor),
      useSensor(TouchSensor),
      useSensor(KeyboardSensor, {
          coordinateGetter: sortableKeyboardCoordinates,
      })
  );
  const getIndex = useCallback((id) => items.indexOf(id), [items]);
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
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={onDragCancel}
          autoScroll={{ order: TraversalOrder.ReversedTreeOrder }}
      >
          <SortableContext items={items} strategy={verticalListSortingStrategy}>
              <div style={{ overflow: 'auto', display: 'flex', flexDirection: 'column', rowGap: '8px' }}>
                  {items.map((value, index) => (
                      <SortableItem
                          key={value}
                          id={value}
                          index={index}
                          renderItem={renderItem}
                      />
                  ))}
              </div>
              {createPortal(
                  <DragOverlay
                      style={{ zIndex: undefined }}
                  >
                      {activeId ? (
                          renderItem({
                              id: activeId,
                              sortableHandle: (WrapperComponent) => WrapperComponent
                          })
                      ) : null}
                  </DragOverlay>,
                  document.body
              )}
          </SortableContext>
      </DndContext>
  );
}

function SortableItem({ getNewIndex, id, renderItem }) {
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
      getNewIndex,
  });

  const sortableHandle = useCallback((WrapperComponent) => {
      return () => <span {...listeners} style={{ lineHeight: 0 }}><WrapperComponent /></span>;
  }, [listeners]);

  const wrapperStyle = {
      transform: cssDndKit.Transform.toString({
          ...transform,
          scaleX: 1,
          scaleY: 1,
      }),
      transition: transition,
      opacity: active && active.id === id ? 0 : undefined,
  };

  return <div 
      ref={setNodeRef}
      style={wrapperStyle}
      {...attributes}
  >
      {renderItem({ id, sortableHandle })}
  </div>;
}

class CustomRenderDragDemo extends React.Component {
  constructor(props) {
      super(props);
      this.state = {
          dataSource: Array.from({ length: 10 }, (v, i) => ({
              label: `海底捞门店 ${i}`,
              value: i,
              disabled: false,
              key: `key-${i}`,
          })),
      };
      this.renderSourcePanel = this.renderSourcePanel.bind(this);
      this.renderSelectedPanel = this.renderSelectedPanel.bind(this);
      this.renderItem = this.renderItem.bind(this);
  }

  renderItem(type, item, onItemAction, selectedItems, sortableHandle) {
      let buttonText = '删除';

      if (type === 'source') {
          let checked = selectedItems.has(item.key);
          buttonText = checked ? '删除' : '添加';
      }

      const DragHandle = (sortableHandle && sortableHandle(() => <IconHandle className="pane-item-drag-handler" />));

      return (
          <div className="semi-transfer-item panel-item" key={item.label}>
              {type === 'source' ? null : ( DragHandle ? <DragHandle /> : null) }
              <div className="panel-item-main" style={{ flexGrow: 1 }}>
                  <p style={{ margin: '0 12px' }}>{item.label}</p>
                  <Button
                      theme="borderless"
                      type="primary"
                      onClick={() => onItemAction(item)}
                      className="panel-item-remove"
                      size="small"
                  >
                      {buttonText}
                  </Button>
              </div>
          </div>
      );
  }

  renderSourcePanel(props) {
      const {
          loading,
          noMatch,
          filterData,
          selectedItems,
          allChecked,
          onAllClick,
          inputValue,
          onSearch,
          onSelectOrRemove,
      } = props;
      let content;
      switch (true) {
          case loading:
              content = <Spin loading />;
              break;
          case noMatch:
              content = <div className="empty sp-font">{inputValue ? '无搜索结果' : '暂无内容'}</div>;
              break;
          case !noMatch:
              content = filterData.map(item => this.renderItem('source', item, onSelectOrRemove, selectedItems));
              break;
          default:
              content = null;
              break;
      }
      return (
          <section className="source-panel">
              <div className="panel-header sp-font">门店列表</div>
              <div className="panel-main">
                  <Input
                      style={{ width: 454, margin: '12px 14px' }}
                      prefix={<IconSearch />}
                      onChange={onSearch}
                      showClear
                  />
                  <div className="panel-controls sp-font">
                      <span>待选门店: {filterData.length}</span>
                      <Button onClick={onAllClick} theme="borderless" size="small">
                          {allChecked ? '取消全选' : '全选'}
                      </Button>
                  </div>
                  <div className="panel-list">{content}</div>
              </div>
          </section>
      );
  }

  renderSelectedPanel(props) {
      const { selectedData, onClear, clearText, onRemove, onSortEnd } = props;
      let mainContent = null;

      if (!selectedData.length) {
          mainContent = <div className="empty sp-font">暂无数据，请从左侧筛选</div>;
      }

      const renderSelectItem = ({ id, sortableHandle }) => {
          const item = selectedData.find(item => id === item.key);
          return this.renderItem('selected', item, onRemove, null, sortableHandle);
      };

      const sortData = selectedData.map(item => item.key);

      mainContent = <div className="panel-main" style={{ display: 'block' }}>
          <SortableList onSortEnd={onSortEnd} items={sortData} renderItem={renderSelectItem}></SortableList>
      </div>;

      return (
          <section className="selected-panel">
              <div className="panel-header sp-font">
                  <div>已选同步门店: {selectedData.length}</div>
                  <Button theme="borderless" type="primary" onClick={onClear} size="small">
                      {clearText || '清空 '}
                  </Button>
              </div>
              {mainContent}
          </section>
      );
  }

  render() {
      const { dataSource } = this.state;
      return (
          <Transfer
              defaultValue={[2, 4]}
              onChange={values => console.log(values)}
              className="component-transfer-demo-custom-panel"
              renderSourcePanel={this.renderSourcePanel}
              renderSelectedPanel={this.renderSelectedPanel}
              dataSource={dataSource}
          />
      );
  }
}

export const CustomRenderWithDragSort = () => <CustomRenderDragDemo />;

CustomRenderWithDragSort.story = {
  name: 'customRender with drag sort',
};

export const TransferInPopover = () => {
  // 点击可拖拽item，导致弹出层消失问题：https://github.com/DouyinFE/semi-design/issues/1226
  // 在弹出层中点击item，导致可拖拽item被遮挡问题：https://github.com/DouyinFE/semi-design/issues/1149
  const [visible, setVisible] = useState(false);
  const change = () => {
      setVisible(!visible);
  };

  const data = Array.from({ length: 30 }, (v, i) => {
    return {
      label: `选项名称 ${i}`,
      value: i,
      disabled: false,
      key: i
    };
  });

  const transferNode = (
    <Transfer
      style={{ width: 568, height: 416 }}
      dataSource={data}
      defaultValue={[2, 4]}
      draggable
      onChange={(values, items) => console.log(values, items)}
    />
  );

  return (
    <div className="App">
      <>
        {/* 弹出层：Popover */}
        <Popover
          trigger="click"
          position='rightTop'
          content={transferNode}
        >
          <Button>Transfer In Popover</Button>
        </Popover>
        {/* 弹出层：sideSheet */}
        <br /><br />
        <Button onClick={change}>Transfer In SideSheet</Button>
        <SideSheet title="滑动侧边栏" visible={visible} onCancel={change} size="medium">
          {transferNode}
        </SideSheet>
      </>
    </div>
  );
}

export const RenderHeader = () => {
 
  const renderSourceHeader = (props) => {
    const { num, showButton, allChecked, onAllClick } = props;
    return <div style={{ margin: '10px 0 0 10px', height: 24, display: 'flex', alignItems: 'center' }}>
      <span style={{ marginRight: 10 }} >共 {num} 项</span>
      {showButton && <Button
        theme="borderless"
        type="tertiary"
        size="small" 
        onClick={onAllClick}>{ allChecked ? '取消全选' : '全选' }</Button>}
    </div>;
  };

  const renderSelectedHeader = (props) => {
    const { num, showButton, onClear } = props;
    return <div style={{ margin: '10px 0 0 10px', height: 24, display: 'flex', alignItems: 'center' }}>
      <span style={{ marginRight: 10 }}>{num} 项已选</span>
      {showButton && <Button
        theme="borderless"
        type="tertiary"
        size="small"
        onClick={onClear}>清空</Button>}
    </div>;
  };

  return (
    <Transfer
      style={{ width: 568, height: 416 }}
      dataSource={data}
      renderSourceHeader={renderSourceHeader}
      renderSelectedHeader={renderSelectedHeader}
    />
  );
};
