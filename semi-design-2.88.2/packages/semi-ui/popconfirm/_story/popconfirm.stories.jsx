import React, { useState } from 'react';

import Popconfirm from '../index';
import Button from '../../button';
import Input from '../../input';
import Table from '../../table';
import Toast from '../../toast';
import { Space } from '../../index';

import TypesConfrimDemo from './TypesConfirm';
import DynamicDisableDemo from './DynamicDisable';
import TitleConfirmDemo from './TitlePopconfirm';
import InTableDemo from './InTable';
import ShowArrow from './ShowArrow';
import ShowCloseIcon from './ShowCloseIcon';

export default {
  title: 'Popconfirm',
  parameters: {
    chromatic: { disableSnapshot: true },
  },
}

let style = {
  display: 'inline-block',
  padding: '20px',
};

export const Simple = () => (
  <div>
    <div style={style}>
      <Popconfirm
        title="确定是否要保存此修改？确定是否要保存此修改？确定是否要保存此修改？确定是否要保存此修改？确定是否要保存此修改？确定是否要保存此修改？确定是否要保存此修改？确定是否要保存此修改？"
        content="此修改将不可逆"
      >
        <a>Delete</a>
      </Popconfirm>
    </div>
  </div>
);

Simple.story = {
  name: 'simple',
};

export const _Button = () => (
  <div>
    <div style={style}>
      <Popconfirm position="bottomLeft" title="确定是否要保存此修改？" content="此修改将不可逆此修改将不可逆此修改将不可逆此修">
        <Button>Save</Button>
      </Popconfirm>
    </div>
  </div>
);

_Button.story = {
  name: 'button',
};

const dataSource = [
  {
    key: '1',
    name: 'John Brown',
    age: 32,
    address: 'New York No. 1 Lake Park, New York No. 1 Lake Park',
  },
  {
    key: '2',
    name: 'Jim Green',
    age: 42,
    address: 'London No. 1 Lake Park',
  },
  {
    key: '3',
    name: 'Joe Black',
    age: 32,
    address: 'Sidney No. 1 Lake Park',
  },
  {
    key: '4',
    name: 'Disabled User',
    age: 99,
    address: 'Sidney No. 1 Lake Park',
  },
];
const columns = [
  {
    title: 'Name',
    dataIndex: 'name',
    render: text => (
      <Popconfirm position="bottomLeft" title="确定是否要保存此修改？" content="此修改将不可逆">
        <Button>{text}</Button>
      </Popconfirm>
    ),
  },
  {
    title: 'Age',
    dataIndex: 'age',
  },
  {
    title: 'Address',
    dataIndex: 'address',
  },
];

export const _Table = () => (
  <div>
    <Table dataSource={dataSource} columns={columns} />
  </div>
);

_Table.story = {
  name: 'table',
};

export const TypesConfirm = () => <TypesConfrimDemo />;

TypesConfirm.story = {
  name: 'types-confirm',
};

export const DynamicDisable = () => <DynamicDisableDemo />;

DynamicDisable.story = {
  name: 'dynamic disable',
};

export const TitlePopconfirm = () => <TitleConfirmDemo />;

TitlePopconfirm.story = {
  name: 'title popconfirm',
};

export const InTable = () => <InTableDemo />;

InTable.story = {
  name: 'in table',
};


export const ShowArrowDemo = () => <ShowArrow />;
ShowArrowDemo.style = {
  name: 'show arrow'
}

export const ShowCloseIconDemo = () => <ShowCloseIcon />;
ShowCloseIcon.style = {
  name: 'show close icon'
}

export const ClickOutSideDemo = () => {
    const [v, setV] = useState(false)
    const onConfirm = () => {
      Toast.success('确认保存！');
    };

    const onCancel = () => {
      Toast.warning('取消保存！');
    }
    return (
      <Popconfirm
          title="确定是否要保存此修改？"
          content="此修改将不可逆"
          visible={v}
          onClickOutSide={onCancel}
          onConfirm={onConfirm}
          onCancel={onCancel}
      >
          <Button onClick={() => setV(true)}>保存</Button>
      </Popconfirm>
    )
}


ClickOutSideDemo.story = {
  name: 'ClickOutSideDemo',
};

export const PromiseCallback = () => {
  const onConfirm = () => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        console.log('ccc');
        resolve(1);
      }, 2000)
    })
  };

  const onCancel = () => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        console.log('ccc');
        reject(1);
      }, 2000)
    })
  };

  return (
    <Popconfirm
      title="确定是否要保存此修改？"
      content="此修改将不可逆"
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <Button>保存</Button>
    </Popconfirm>
  );
};

PromiseCallback.story = {
  name: 'PromiseCallbackDemo',
};

export const KeyboardAndFocus = () => {
  return (
    <div style={{ height: '150vh', marginTop: 200 }}>
      <Space>
        <div data-cy="initial-focus-confirm">
          <Popconfirm
              title="确定是否要保存此修改？"
              content="此修改将不可逆"
              okButtonProps={{
                autoFocus: true,
                type: 'danger',
                className: 'test-ok',
              }}
          >
              <Button>确认聚焦</Button>
          </Popconfirm>
        </div>
        <div data-cy="initial-focus-cancel">
          <Popconfirm
              title="确定是否要保存此修改？"
              content="此修改将不可逆"
              cancelButtonProps={{
                autoFocus: true,
                className: 'test-cancel',
              }}
          >
              <Button>取消聚焦</Button>
          </Popconfirm>
        </div>
        <div data-cy="initial-focus-content">
          <Popconfirm
              title="确定是否要保存此修改？"
              content={({ initialFocusRef }) => {
                return <input ref={initialFocusRef} placeholder="focus here" />;
              }}
          >
              <Button>内容聚焦</Button>
          </Popconfirm>
        </div>
      </Space>
    </div>
  );
};
KeyboardAndFocus.storyName = "a11y focus";

export const ESCKeyDown = () => {
  return (
    <div style={{ height: '150vh', marginTop: 200 }}>
      <Space>
        <div data-cy="content">
          <Popconfirm
              title="确定是否要保存此修改？"
              content="此修改将不可逆"
              okButtonProps={{
                autoFocus: true,
                className: 'test-ok',
              }}
          >
              <Button>content</Button>
          </Popconfirm>
        </div>
        <div data-cy="trigger">
          <Popconfirm
                title="确定是否要保存此修改？"
                content={<div onClick={() => console.log('clicked')} className='test-text'>此修改将不可逆</div>}
                okButtonProps={{ autoFocus: true }}
            >
              <Button>trigger</Button>
          </Popconfirm>
        </div>
      </Space>
    </div>
  );
};
ESCKeyDown.storyName = "a11y esc keydown";
