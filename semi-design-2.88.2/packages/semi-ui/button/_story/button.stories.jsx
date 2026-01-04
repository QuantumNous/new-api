import React, { useState } from 'react';

import withPropsCombinations from 'react-storybook-addon-props-combinations';
import { strings, numbers, cssClasses } from '@douyinfe/semi-foundation/button/constants';
import Button from '../index';
import ButtonGroup from '../buttonGroup';
import SplitButtonGroup from '../splitButtonGroup';
import Dropdown from '../../dropdown';
import { Tooltip, Switch } from '@douyinfe/semi-ui';
import {
  IconTick,
  IconEdit,
  IconTwitter,
  IconUser,
  IconCopy,
  IconSearch,
  IconPlay,
} from '@douyinfe/semi-icons';
import Collapse from '../../collapse';
import { ColorfulDemo, ColorfulGroupDemo } from './colorful';

export default {
  title: 'Button',
}

export const Primary = () => <Button type="primary">UI semi</Button>;

export const Danger = () => <Button type="danger">hello button</Button>;

export const Warning = () => <Button type="warning">hello button</Button>;

export const WithIcon = () => (
  <>
    <Button aria-label='Button demo' icon={<IconTick />}>hello button</Button>
    <br />
    <Button aria-label='Button demo' icon={<IconEdit />} noHorizontalPadding={false} ghost={false}>
      Edit me
    </Button>
    <Button aria-label='Button demo' icon={<IconUser />} />
  </>
);

export const CombinationShow = withPropsCombinations(
  Button,
  {
    disabled: [false, true],
    children: ['hello button'],
    size: strings.sizes,
    type: strings.btnTypes,
    theme: strings.themes, // block: [false, true],
    // ghost: [false, true],
    // light: [false, true],
  },
  {
    showSource: false,
  }
);

export const ButtonGroupDemo = () => (
  <div>
    <ButtonGroup aria-label='ButtonGroup demo' disabled>
      <Button>复制</Button>
      <Button type="primary">查找</Button>
      <Button type="danger">粘贴</Button>
    </ButtonGroup>
    <br />
    <ButtonGroup aria-label='ButtonGroup demo'>
      <Button icon={<IconCopy />} theme={'solid'} />
      <Button icon={<IconSearch />} theme={'solid'} />
      <Button icon={<IconPlay />} theme={'solid'} />
    </ButtonGroup>
    <br />

    <ButtonGroup size={'large'} aria-label='ButtonGroup demo'>
      <Button icon={<IconCopy />} theme={'solid'} />
      <Button icon={<IconSearch />} theme={'solid'} />
      <Button icon={<IconPlay />} theme={'solid'} />
    </ButtonGroup>
    <br />

    <ButtonGroup size={'small'} aria-label='ButtonGroup demo'>
      <Button icon={<IconCopy />} theme={'solid'} />
      <Button icon={<IconSearch />} theme={'solid'} />
      <Button icon={<IconPlay />} theme={'solid'} />
    </ButtonGroup>
    <br />

    <ButtonGroup aria-label='ButtonGroup demo'>
      <Button icon={<IconCopy />} theme={'solid'}>
        拷贝
      </Button>
      <Button icon={<IconSearch />} theme={'solid'}>
        搜索
      </Button>
      <Button icon={<IconPlay />} theme={'solid'}>
        播放
      </Button>
    </ButtonGroup>
    <br />

    <ButtonGroup size={'large'} aria-label='ButtonGroup demo'>
      <Button icon={<IconCopy />} theme={'solid'}>
        拷贝
      </Button>
      <Button icon={<IconSearch />} theme={'solid'}>
        搜索
      </Button>
      <Button icon={<IconPlay />} theme={'solid'}>
        播放
      </Button>
    </ButtonGroup>
    <br />

    <ButtonGroup size={'small'} aria-label='ButtonGroup demo'>
      <Button icon={<IconCopy />} theme={'solid'}>
        拷贝
      </Button>
      <Button icon={<IconSearch />} theme={'solid'}>
        搜索
      </Button>
      <Button icon={<IconPlay />} theme={'solid'}>
        播放
      </Button>
    </ButtonGroup>
    <br />
    <div>ButtonGroup children 不是合法元素的情况:</div>
    <ButtonGroup>
      {false}
      {123}
      {null}
      {undefined}
      text
      <span>span</span>
      {true && <Button>拷贝</Button>}
      <Button>查询</Button>
      <Button>剪切</Button>
    </ButtonGroup>
    <br />
    <br />
    <ButtonGroup theme={'outline'}>
      <Button>拷贝</Button>
      <Button>查询</Button>
      <Button>剪切</Button>
    </ButtonGroup>
    <br />
  </div>
);

export function Loading() {
    const [loading, setLoading] = useState(false);
    return (
      <div
        style={{
          maxWidth: 400,
          maxHeight: 300,
          padding: 50,
        }}
      >
        <div>
          <Switch checked={loading} onChange={loading => setLoading(loading)} />
        </div>
        <Button loading={loading}>保存</Button>
        <Button loading={loading} type="danger" theme="solid">
          删除
        </Button>
        <Button loading={loading} type="danger" theme="solid" disabled>
          删除
        </Button>
        <Button loading={loading} type="danger" theme="solid" block>
          删除
        </Button>
        <Tooltip content={loading ? '正在保存' : '保存'}>
          <Button loading={loading}>保存</Button>
        </Tooltip>
        <Button icon={<IconEdit />} loading={loading} />
        <Tooltip content={loading ? '载入中' : '编辑'}>
          <Button icon={<IconEdit />} loading={loading} />
        </Tooltip>
        <Tooltip content={loading ? '载入中' : '编辑'}>
          <Button icon={<IconEdit />} loading={loading} theme="solid" />
        </Tooltip>
        <Tooltip content={loading ? '载入中' : '编辑'}>
          <Button icon={<IconEdit />} loading={loading} theme="solid" type="danger" />
        </Tooltip>
        <Tooltip content={loading ? '载入中' : '编辑'}>
          <Button icon={<IconEdit />} loading={loading} theme="solid" type="warning" disabled />
        </Tooltip>
      </div>
    );
};

const menu = [
  {
    node: 'title',
    name: '标题一',
  },
  {
    node: 'item',
    name: '编辑项目',
    onClick: () => console.log('编辑项目点击'),
  },
  {
    node: 'item',
    name: '重置项目',
    type: 'secondary',
  },
  {
    node: 'divider',
  },
  {
    node: 'item',
    name: '从项目创建模版',
    type: 'tertiary',
  },
  {
    node: 'item',
    name: '复制项目',
    type: 'warning',
  },
  {
    node: 'divider',
  },
  {
    node: 'item',
    name: '删除项目',
    type: 'danger',
  },
];
const content = '批量通过';

export const SplitButton = () => (
  <>
    <p>基础</p>
    <SplitButtonGroup>
      <Button theme="solid" type="primary">
        前面
      </Button>
      <Button theme="solid" type="primary">
        后面
      </Button>
    </SplitButtonGroup>
    <br />
    <SplitButtonGroup>
      <Button theme="solid" type="primary">
        One
      </Button>
    </SplitButtonGroup>
    <br />
    <SplitButtonGroup>
      <Button size="small" theme="solid" type="primary">
        前面
      </Button>
      <Button size="small" theme="solid" type="primary">
        中间
      </Button>
      <Button size="small" theme="solid" type="primary">
        后面
      </Button>
      <Dropdown trigger="click" menu={menu} position="bottomRight">
        <Button size="small" theme="solid" type="primary" icon={<IconTwitter />}></Button>
      </Dropdown>
    </SplitButtonGroup>
  </>
);

export const StopPropagationWhenDisabled = () => (
  <>
    <Collapse>
      <Collapse.Panel
        header={
          <>
            title<Button>按钮</Button>
          </>
        }
        itemKey="1"
      >
        <p>Hi, bytedance dance dance. This is the docsite of Semi UI. </p>
      </Collapse.Panel>
      <Collapse.Panel
        header={
          <>
            title<Button disabled>按钮</Button>
          </>
        }
        itemKey="2"
      >
        <p>Hi, bytedance dance dance. This is the docsite of Semi UI. </p>
      </Collapse.Panel>
    </Collapse>
    <div onClick={() => console.log('div')}>
      <span>正常冒泡</span>
      <Button onClick={() => console.log('button')}>按钮</Button>
    </div>
    <div onClick={() => console.log('div')}>
      <span>禁用 Button 后，阻止冒泡</span>
      <Button disabled onClick={() => console.log('button')}>
        按钮
      </Button>
    </div>
  </>
);

export const Colorful = () => {
  return <ColorfulDemo />
}

export const ColorfulGroup = () => {
  return <ColorfulGroupDemo />
}