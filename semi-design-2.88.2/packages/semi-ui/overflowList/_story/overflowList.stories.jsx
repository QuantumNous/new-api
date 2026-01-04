import React, { useState } from 'react';
import { Icon, Tag, Table, Slider, Button } from '../../index';
import OverflowList from '..';
import {
  IconAlarm,
  IconCamera,
  IconBookmark,
  IconDuration,
  IconEdit,
  IconFolder,
  IconFolderOpen,
  IconBolt,
} from '@douyinfe/semi-icons';

export default {
  title: 'OverflowList'
}

const ITEMS = [
  { icon: <IconFolderOpen />, key: 'All' },
  { icon: <IconFolderOpen />, key: 'Users' },
  { icon: <IconFolderOpen />, key: 'Janet' },
  { href: '#', icon: <IconFolderOpen />, key: 'Photos' },
  { href: '#', icon: <IconFolderOpen />, key: 'Wednesday' },
  { icon: <IconBolt />, key: 'image', current: true },
  { icon: <IconFolderOpen />, key: 'Users2' },
  { icon: <IconFolderOpen />, key: 'Users3' },
  { icon: <IconFolderOpen />, key: 'Users4' },
  { icon: <IconFolderOpen />, key: 'Users5' },
  { icon: <IconFolderOpen />, key: 'Users6' },
  { icon: <IconFolderOpen />, key: 'Users7' },
];
const createItems = (length = 10) => {
  return Array(length).fill().map(()=>({ key: Math.random() }))
}
class Demo extends React.Component {
  renderOverflow = items => {
    // console.log('overflow items: ', items);
    return <Tag>{items.length}</Tag>;
  };
  renderItem = (item, ind) => {
    // console.log('visible item: ', item);
    return (
      <span key={item.key} style={{ marginRight: 8 }}>
        {item.key}
      </span>
    );
  };
  render() {
    return (
      <div style={{ width: '500px' }}>
        <OverflowList
          items={createItems(80)}
          overflowRenderer={this.renderOverflow}
          visibleItemRenderer={this.renderItem}
        />
      </div>
    );
  }
}
export const ASimpleOverflowList = () => {
  const [width, setWidth] = useState(100)
  const renderOverflow = (items) => {
      // console.log('overflow items: ', items);
      return (items.length ? <Tag style={{ flex: '0 0 auto' }}>+{items.length}</Tag> : null)
  }
  const renderItem = (item, ind) => {
      // console.log('visible item: ', item);
      return (
          <Tag color='blue' key={item.key} style={{  flex: '0 0 auto' }}>
              <Icon type={item.icon} style={{ }}/>
              {item.key}
          </Tag>
      )
  }
  const items =  Array.from(new Array(100)).map((i, ind) => ({ icon: "alarm", key: `${ind}-alarm` }))
      
  return (
      <div style={{width:'800px'}}>
          <Slider step={1} value={width} onChange={(value) => setWidth(value)} />
          <div><span>.</span></div>
          <br/>
          <br/>
          <div style={{ maxWidth: `${width}%` }}>
              <OverflowList
                  items={items}
                  onOverflow={e=>{
                    console.log('🚀 ~~~~~~ ASimpleOverflowList ~~~~~~ object', e)
                  }}
                  // minVisibleItems={3}
                  overflowRenderer={renderOverflow}
                  visibleItemRenderer={renderItem}
              />
          </div>
      </div>
  );
};

ASimpleOverflowList.story = {
  name: 'a simple semi overflow list',
};

class StartCollapse extends React.Component {
  renderOverflow = items => {
    // console.log('overflow items: ', items);
    return <Tag>{items.length}</Tag>;
  };
  renderItem = (item, ind) => {
    // console.log('visible item: ', item);
    return (
      <span key={item.key} style={{ marginRight: 8 }}>
        {item.key}
      </span>
    );
  };
  render() {
    return (
      <div style={{ width: '30%' }}>
        <OverflowList
          items={ITEMS}
          collapseFrom="start"
          overflowRenderer={this.renderOverflow}
          visibleItemRenderer={this.renderItem}
        />
      </div>
    );
  }
}

export const CollapseFromStart = () => <StartCollapse />;

CollapseFromStart.story = {
  name: 'collapse from start',
};

class MinCollapse extends React.Component {
  renderOverflow = items => {
    // console.log('overflow items: ', items);
    return <Tag>{items.length}</Tag>;
  };
  renderItem = (item, ind) => {
    // console.log('visible item: ', item);
    return (
      <span key={item.key} style={{ marginRight: 8 }}>
        {item.key}
      </span>
    );
  };
  render() {
    return (
      <div style={{ width: '30%' }}>
        <OverflowList
          items={ITEMS}
          minVisibleItems={3}
          overflowRenderer={this.renderOverflow}
          visibleItemRenderer={this.renderItem}
          onOverflow={item => console.log(item)}
        />
      </div>
    );
  }
}

export const MinVisibleItems = () => <MinCollapse />;

MinVisibleItems.story = {
  name: 'minVisibleItems',
};

class OverlapDemo extends React.Component {
  renderOverflow = items => {
    return items.map(item => <Tag>{item.length}</Tag>);
  };
  renderItem = (item, ind) => {
    return (
      <div key={item.key} style={{ marginRight: 8 }}>
        {item.key}
      </div>
    );
  };
  render() {
    return (
      <div style={{ width: '40%' }}>
        <OverflowList
          items={ITEMS}
          overflowRenderer={this.renderOverflow}
          visibleItemRenderer={this.renderItem}
          renderMode="scroll"
        />
      </div>
    );
  }
}

export const OverlapOverflowList = () => <OverlapDemo />;

OverlapOverflowList.story = {
  name: 'overlap overflow list',
};

class OverlapDemo2 extends React.Component {
  renderOverflow = items => {
    return items.map(item => <Tag>{item.length}</Tag>);
  };
  renderItem = (item, ind) => {
    return (
      <div key={item.key} style={{ marginRight: 8 }}>
        {item.key}
      </div>
    );
  };
  render() {
    return (
      <div style={{ width: '40%' }}>
        <OverflowList
          items={ITEMS}
          threshold={0.2}
          onIntersect={item => console.log(item)}
          overflowRenderer={this.renderOverflow}
          visibleItemRenderer={this.renderItem}
          renderMode="scroll"
        />
      </div>
    );
  }
}

export const OverlapOverflowThreshold = () => <OverlapDemo2 />;

OverlapOverflowThreshold.story = {
  name: 'overlap overflow threshold',
};

const data = [
  {
    key: '1',
    name: 'John Brown',
    age: 32,
    age1: 23,
    age2: 11,
    address: [1, 2, 3, 4, 5],
  },
  {
    key: '2',
    name: 'Jim Green',
    age: 42,
    age1: 23,
    age2: 11,
    address: [1, 2, 3, 4, 5],
  },
  {
    key: '3',
    name: 'Joe Black',
    age: 32,
    age1: 23,
    age2: 11,
    address: [1, 2, 3, 4, 5],
  },
  {
    key: '4',
    name: 'Disabled User',
    age: 99,
    age1: 23,
    age2: 11,
    address: [1, 2, 3, 4, 5],
  },
];

class TableDemo extends React.Component {
  renderOverflow = items => {
    return <Tag>{items.length}</Tag>;
  };
  renderItem = (item, ind) => {
    return (
      <div key={`${ind}-item`} style={{ marginRight: 8 }}>
        {item}
      </div>
    );
  };
  renderColumn(items) {
    return (
      <div
      // style={{ width: '99%' }}
      >
        <OverflowList
          items={items.concat(items)}
          // observeAll={true}
          style={{ width: 88 }}
          overflowRenderer={items => <Tag>{items.length}</Tag>}
          visibleItemRenderer={(item, ind) => (
            <div key={`${ind}-item`} style={{ marginRight: 8 }}>
              {item}
            </div>
          )}
        />
      </div>
    );
    // return (
    //     <div>
    //         <OverflowList
    //             items={items.concat(items)}
    //             style={{ width: 88 }}
    //             overflowRenderer={this.renderOverflow}
    //             visibleItemRenderer={this.renderItem}
    //         />
    //     </div>
    // );
  }
  render() {
    const columns = [
      {
        title: 'Name',
        dataIndex: 'name',
        width: '30%',
      },
      {
        title: 'combine',
        dataIndex: 'test',
        children: [
          {
            title: 'Age',
            children: [
              {
                title: 'Age1',
                dataIndex: 'age1',
              },
              {
                title: 'Age2',
                dataIndex: 'age2',
              },
            ],
          },
          {
            title: 'Key',
            dataIndex: 'key',
          },
        ],
      },
      {
        title: 'Address',
        width: '20%',
        dataIndex: 'address',
        render: item => this.renderColumn(item),
        className: 'table-width-test',
      },
    ];
    return <Table columns={columns} dataSource={data} />;
  }
}

export const OverflowInTable = () => <TableDemo />;

OverflowInTable.story = {
  name: 'overflow in table',
};

const LargeData = () => {
  const [width, setWidth] = useState(100);
  const renderOverflow = items => {
    // console.log('overflow items: ', items);
    return items.length ? <Tag style={{ flex: '0 0 auto' }}>+{items.length}</Tag> : null;
  };
  const renderItem = (item, ind) => {
    // console.log('visible item: ', item);
    return (
      <Tag color="blue" key={item.key} style={{ marginRight: 8, flex: '0 0 auto' }}>
        {item.icon}
        {item.key}
      </Tag>
    );
  };
  const items = [
    { icon: <IconAlarm style={{ marginRight: 4 }} />, key: 'alarm' },
    { icon: <IconBookmark style={{ marginRight: 4 }} />, key: 'bookmark' },
    { icon: <IconCamera style={{ marginRight: 4 }} />, key: 'camera' },
    { icon: <IconDuration style={{ marginRight: 4 }} />, key: 'duration' },
    { icon: <IconEdit style={{ marginRight: 4 }} />, key: 'edit' },
    { icon: <IconFolder style={{ marginRight: 4 }} />, key: 'folder' },
  ];

  return (
    <div>
      <Slider step={1} value={width} onChange={value => setWidth(value)} />
      <br />
      <br />
      <div style={{ width: `${width}%` }}>
        <OverflowList
          items={items}
          minVisibleItems={3}
          overflowRenderer={renderOverflow}
          visibleItemRenderer={renderItem}
        />
      </div>
    </div>
  );
};

export const OverflowListWithSlide = () =>{
   const [width, setWidth] = useState(100);
    const renderOverflow = items => {
        return items.length ? <Tag style={{ flex: '0 0 auto' }}>+{items.length}</Tag> : null;
    };
    const renderItem = (item, ind) => {
        return (
            <Tag color="blue" key={item.key} style={{ marginRight: 8, flex: '0 0 auto' }}>
                {item.icon}
                {item.key}
            </Tag>
        );
    };

    const items = [
        { icon: <IconAlarm style={{ marginRight: 4 }} />, key: 'alarm' },
        { icon: <IconBookmark style={{ marginRight: 4 }} />, key: 'bookmark' },
        { icon: <IconCamera style={{ marginRight: 4 }} />, key: 'camera' },
        { icon: <IconDuration style={{ marginRight: 4 }} />, key: 'duration' },
        { icon: <IconEdit style={{ marginRight: 4 }} />, key: 'edit' },
        { icon: <IconFolder style={{ marginRight: 4 }} />, key: 'folder' },
    ];

    return (
        <div>
            <Slider step={1} value={width} onChange={value => setWidth(value)} />
            <br />
            <br />
            <div style={{ width: `${width}%` }}>
                <OverflowList
                    items={items}
                    // minVisibleItems={3}
                    overflowRenderer={renderOverflow}
                    visibleItemRenderer={renderItem}
                />
            </div>
        </div>
    );
}

OverflowListWithSlide.story = {
  name: 'overflowList with slide',
};
export const Fix1362 = () =>{
  const items1 = [
        { icon: <IconAlarm style={{ marginRight: 4 }} />, key: 'alarm' },
        { icon: <IconBookmark style={{ marginRight: 4 }} />, key: 'bookmark' },
        { icon: <IconCamera style={{ marginRight: 4 }} />, key: 'camera' },
        { icon: <IconDuration style={{ marginRight: 4 }} />, key: 'duration' },
        { icon: <IconEdit style={{ marginRight: 4 }} />, key: 'edit' },
        { icon: <IconFolder style={{ marginRight: 4 }} />, key: 'folder' },
    ];

  const items2 = [
      { icon: <IconAlarm style={{ marginRight: 4 }} />, key: 'newAlarm' },
      { icon: <IconBookmark style={{ marginRight: 4 }} />, key: 'newBookmark' },
      { icon: <IconCamera style={{ marginRight: 4 }} />, key: 'newCamera' },
      { icon: <IconDuration style={{ marginRight: 4 }} />, key: 'newDuration' },
  ];

  const [items, setItem] = useState(items1);
  const [flag, setFlag] = useState(false);

  const renderOverflow = items => {
    return items.map(item => <Tag>{item.length}</Tag>);
  };
  const renderItem = (item, ind) => {
    return (
      <div key={item.key} style={{ marginRight: 8 }}>
        {item.key}
      </div>
    );
  };

  const change = () =>{
    setItem(flag ? items1: items2)
    setFlag(!flag)
  }

  return (
      <div style={{ marginTop: 100, height: 1000 }}>
          <Button onClick={change}>change</Button>
          <br />
          <br />
          <div style={{ width: 500 }}>
              <OverflowList
                  renderMode='scroll'
                  items={items}
                  overflowRenderer={renderOverflow}
                  visibleItemRenderer={renderItem}
              />
          </div>
      </div>
  );
}
Fix1362.story = {
  name: 'fix #1362',
};

export const FixDisplayFlexDemo = () =>{
  const [width, setWidth] = useState(100);
  const renderOverflow = items => {
        return items.length ? <Tag style={{ flex: '0 0 auto' }}>+{items.length}</Tag> : null;
    };
  const renderItem = (item, ind) => {
      return (
          <Tag color="blue" key={item.key} style={{ marginRight: 8, flex: '0 0 auto' }}>
              {item.icon}
              {item.key}
          </Tag>
      );
  };

  const items = [
      { icon: <IconAlarm style={{ marginRight: 4 }} />, key: 'alarm' },
      { icon: <IconBookmark style={{ marginRight: 4 }} />, key: 'bookmark' },
      { icon: <IconCamera style={{ marginRight: 4 }} />, key: 'camera' },
      { icon: <IconDuration style={{ marginRight: 4 }} />, key: 'duration' },
      { icon: <IconEdit style={{ marginRight: 4 }} />, key: 'edit' },
      { icon: <IconFolder style={{ marginRight: 4 }} />, key: 'folder' },
  ];

  return (
      <div>
          <Slider step={1} value={width} onChange={value => setWidth(value)} />
          <br />
          <br />
          <div style={{ width: `${width}%`, display: 'flex' }}>
              <OverflowList
                  style={{ width: '100%' }}
                  items={items}
                  minVisibleItems={3}
                  overflowRenderer={renderOverflow}
                  visibleItemRenderer={renderItem}
              />
          </div>
      </div>
  );
}

FixDisplayFlexDemo.story = {
  name: 'overflowList with display flex',
};

export const FixFirstLongTagDemo = () =>{
  const [width, setWidth] = useState(20);
  const renderOverflow = items => {
        return items.length ? <Tag style={{ flex: '0 0 auto' }}>+{items.length}</Tag> : null;
    };
  const renderItem = (item, ind) => {
      return (
          <Tag color="blue" key={item.key} style={{ marginRight: 8, flex: '0 0 auto' }}>
              {item.icon}
              {item.key}
          </Tag>
      );
  };

  const items = [
      { icon: <IconAlarm style={{ marginRight: 4, width: 400 }} />, key: 'alarm' },
      { icon: <IconBookmark style={{ marginRight: 4 }} />, key: 'bookmark' },
      { icon: <IconCamera style={{ marginRight: 4 }} />, key: 'camera' },
      { icon: <IconDuration style={{ marginRight: 4 }} />, key: 'duration' },
      { icon: <IconEdit style={{ marginRight: 4 }} />, key: 'edit' },
      { icon: <IconFolder style={{ marginRight: 4 }} />, key: 'folder' },
  ];

  return (
      <div>
          <div>修复第一个item就溢出, 不触发 onOverflow 问题</div>
          <Slider step={1} value={width} onChange={value => setWidth(value)} />
          <br />
          <br />
          <div style={{ width: `${width}%` }}>
              <OverflowList
                  items={items}
                  onOverflow={(items)=>{
                    console.log('触发了onOverflow', items);
                  }}
                  overflowRenderer={renderOverflow}
                  visibleItemRenderer={renderItem}
              />
          </div>
      </div>
  );
}

FixFirstLongTagDemo.story = {
  name: 'overflowList with first long tag',
};