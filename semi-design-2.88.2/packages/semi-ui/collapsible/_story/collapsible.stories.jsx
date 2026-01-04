/* argus-disable unPkgSensitiveInfo */
import React, { useState } from 'react';
import { Button, CheckboxGroup, Upload, Table, Collapse, Tabs } from '../../index';
import Collapsible from '..';
import NestedDemo from './Nested';
import { IconChevronDown, IconChevronRight, IconUpload } from '@douyinfe/semi-icons';

const TabPane = Tabs.TabPane;

export default {
  title: 'Collapsible',
}

class Demo extends React.Component {
  state = {
    isOpen: false,
  };
  toggle = () => {
    this.setState({
      isOpen: !this.state.isOpen,
    });
  };

  render() {
    const { isOpen } = this.state;
    const collapsed = (
      <ul>
        <li>
          <p>Semi Design 以内容优先进行设计。</p>
        </li>
        <li>
          <p>更容易地自定义主题。</p>
        </li>
        <li>
          <p>适用国际化场景。</p>
        </li>
        <li>
          <p>效率场景加入人性化关怀。</p>
        </li>
      </ul>
    );
    return (
      <div>
        <Button onClick={() => this.toggle()}>显示更多</Button>
        <Collapsible isOpen={isOpen}>{collapsed}</Collapsible>
      </div>
    );
  }
}

export const RegularCollapsible = () => <Demo />;

class DemoDOM extends React.Component {
  state = {
    isOpen: false,
  };
  toggle = () => {
    this.setState({
      isOpen: !this.state.isOpen,
    });
  };

  render() {
    const { isOpen } = this.state;
    const collapsed = (
      <ul>
        <li>
          <p>Semi Design 以内容优先进行设计。</p>
        </li>
        <li>
          <p>更容易地自定义主题。</p>
        </li>
        <li>
          <p>适用国际化场景。</p>
        </li>
        <li>
          <p>效率场景加入人性化关怀。</p>
        </li>
      </ul>
    );
    return (
      <div>
        <Button onClick={() => this.toggle()}>显示更多</Button>
        <Collapsible keepDOM lazyRender={!!this.props.lazyRender} isOpen={isOpen}>
          {collapsed}
        </Collapsible>
      </div>
    );
  }
}

export const KeepDom = () => <DemoDOM />;

export const LazyRender = () => <DemoDOM lazyRender={true} />;

class DefaultOpen extends React.Component {
  state = {
    isOpen: true,
  };
  toggle = () => {
    this.setState({
      isOpen: !this.state.isOpen,
    });
  };

  render() {
    const { isOpen } = this.state;
    const collapsed = (
      <ul>
        <li>
          <p>Semi Design 以内容优先进行设计。</p>
        </li>
        <li>
          <p>更容易地自定义主题。</p>
        </li>
        <li>
          <p>适用国际化场景。</p>
        </li>
        <li>
          <p>效率场景加入人性化关怀。</p>
        </li>
      </ul>
    );
    return (
      <div>
        <Button onClick={() => this.toggle()}>toggle</Button>
        <Collapsible isOpen={isOpen}>{collapsed}</Collapsible>
      </div>
    );
  }
}

export const DefaultOpenDemo = () => <DefaultOpen />;
export const NestedCollapsible = () => <NestedDemo />;

class Wrap extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isOpen: props.isOpen,
      options: [
        {
          label: '抖音',
          value: 'dy',
        },
        {
          label: '火山',
          value: 'hotsoon',
        },
        {
          label: '皮皮虾',
          value: 'pipixia',
        },
        {
          label: '今日头条',
          value: 'toutiao',
        },
      ],
      values: [],
    };
    this.toggle = this.toggle.bind(this);
    this.onChange = this.onChange.bind(this);
  }

  toggle() {
    this.setState({
      isOpen: !this.state.isOpen,
    });
  }

  onChange(values) {
    this.setState({
      values,
    });
  }

  render() {
    const { isOpen, options, values } = this.state;
    return (
      <>
        <div onClick={this.toggle}>
          {isOpen ? <IconChevronDown /> : <IconChevronRight />}
          权限点
          <span>
            {values.length}/{options.length}
          </span>
        </div>
        <Collapse defaultActiveKey="1" motion={false}>
          <Collapse.Panel header="This is panel header 1" itemKey="1">
            <p>Hi, bytedance dance dance. This is the docsite of Semi UI. </p>
          </Collapse.Panel>
          <Collapse.Panel header="This is panel header 2" itemKey="2">
            <p>Hi, bytedance dance dance. This is the docsite of Semi UI. </p>
          </Collapse.Panel>
          <Collapse.Panel header="This is panel header 3" itemKey="3">
            <p>Hi, bytedance dance dance. This is the docsite of Semi UI. </p>
          </Collapse.Panel>
        </Collapse>
        {/* <Collapsible isOpen={isOpen}>
           <div style={{ height: '40px' }}>
               <CheckboxGroup options={options} direction="horizontal" onChange={this.onChange} value={values} />
           </div>
        </Collapsible> */}
      </>
    );
  }
}

export const CollapsibleTest = () => <Wrap />;

class App extends React.Component {
  render() {
    const expandColumns = [
      {
        title: 'Name',
        dataIndex: 'name',
        key: 'name',
      },
      {
        title: 'Age',
        dataIndex: 'age',
        key: 'age',
      },
      {
        title: 'Address',
        dataIndex: 'address',
        key: 'address',
      },
      {
        title: 'Action',
        dataIndex: '',
        key: 'x',
        render: () => <a>Delete</a>,
      },
    ];
    const rowSelection = {
      onChange: (selectedRowKeys, selectedRows) => {
        // console.log(`selectedRowKeys: ${selectedRowKeys}`, 'selectedRows: ', selectedRows);
      },
      getCheckboxProps: record => ({
        disabled: record.name === 'Michael James',
        // Column configuration not to be checked
        name: record.name,
      }),
    };
    const expandData = [
      {
        name: 'John Brown',
        age: 32,
        address: 'New York No. 1 Lake Park',
        description:
          'My name is John Brown, I am 32 years old, living in New York No. 1 Lake Park.',
      },
      {
        name: 'Jim Green',
        age: 42,
        address: 'London No. 1 Lake Park',
        description: 'My name is Jim Green, I am 42 years old, living in London No. 1 Lake Park.',
      },
      {
        name: 'Joe Black',
        age: 32,
        address: (
          <Collapse defaultActiveKey="1" motion={false}>
            <Collapse.Panel header="This is panel header 1" itemKey="1">
              <p>Hi, bytedance dance dance. This is the docsite of Semi UI. </p>
            </Collapse.Panel>
            <Collapse.Panel header="This is panel header 2" itemKey="2">
              <p>Hi, bytedance dance dance. This is the docsite of Semi UI. </p>
            </Collapse.Panel>
            <Collapse.Panel header="This is panel header 3" itemKey="3">
              <p>Hi, bytedance dance dance. This is the docsite of Semi UI. </p>
            </Collapse.Panel>
          </Collapse>
        ),
        description: 'My name is Joe Black, I am 32 years old, living in Sidney No. 1 Lake Park.',
      },
    ];

    const expandRowRender = (record, index) => <Wrap isOpen={true} />;

    return (
      <Table
        rowKey={'name'}
        columns={expandColumns}
        rowSelection={rowSelection}
        expandedRowRender={expandRowRender}
        dataSource={expandData}
      />
    );
  }
}

export const CollapsibleInTable = () => <App />;

class InTab extends React.Component {
  constructor() {
    super();
    this.state = {
      isOpenFirst: false,
      isOpenSecond: false,
    };
  }

  render() {
    const { isOpenFirst, isOpenSecond } = this.state;
    return (
      <div>
        <Tabs
          onTabClick={e =>
            this.setState({
              active: e,
            })
          }
        >
          <TabPane tab="第一" itemKey="1">
            <h3>第一个tabpane</h3>
            <Button
              onClick={() => {
                this.setState({
                  isOpenFirst: !isOpenFirst,
                });
              }}
            >
              开关
            </Button>
            <Collapsible isOpen={isOpenFirst}>
              第一个tabpane下的collapsible的open状态正常
            </Collapsible>
          </TabPane>
          <TabPane tab="第二" itemKey="2">
            <h3>第二个tabpane</h3>
            <Button
              onClick={() => {
                this.setState({
                  isOpenSecond: !isOpenSecond,
                });
              }}
            >
              开关
            </Button>
            <Collapsible isOpen={isOpenSecond}>
              第二个tabpane下的collapsibleopen状态异常
            </Collapsible>
          </TabPane>
        </Tabs>
      </div>
    );
  }
}

export const CollapsibleInTab = () => <InTab />;

CollapsibleInTab.story = {
  name: 'collapsible in tab',
};

class WithUpload extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isOpen: true,
    };
    this.toggle = this.toggle.bind(this);
    this.action = '//semi.design/api/upload/';
    this.defaultFileList = [
      {
        preview: false,
        name: '2D (2).ecpj',
        status: 'success',
        uid: 'd116a179410eb0ca18e66074509bde93-0',
        url:
          'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/bag.jpeg',
      },
      {
        preview: false,
        name: '2D-sticker-temp.psd',
        status: 'success',
        uid: 'b7d579069320590ba4b128672eedbae2-1',
        url:
          'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/bag.jpeg',
      },
      {
        preview: false,
        name: '2D-sticker-temp (1).psd',
        status: 'success',
        uid: 'b7d579069320590ba4b128672eedbae2-2',
        url:
          'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/bag.jpeg',
      },
    ];
  }

  toggle() {
    this.setState({
      isOpen: !this.state.isOpen,
    });
  }

  render() {
    const { isOpen } = this.state;
    return (
      <div>
        <Collapsible isOpen={isOpen} collapseHeight={120}>
          <Upload
            dragable={true}
            name="file" // accept={ALLOW_FILE}
            defaultFileList={[
              {
                preview: false,
                name: '2D (2).ecpj',
                status: 'success',
                uid: 'd116a179410eb0ca18e66074509bde93-0',
                url:
                  'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/bag.jpeg',
              },
              {
                preview: false,
                name: '2D-sticker-temp.psd',
                status: 'success',
                uid: 'b7d579069320590ba4b128672eedbae2-1',
                url:
                  'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/bag.jpeg',
              },
              {
                preview: false,
                name: '2D-sticker-temp (1).psd',
                status: 'success',
                uid: 'b7d579069320590ba4b128672eedbae2-2',
                url:
                  'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/bag.jpeg',
              },
            ]}
            dragMainText="点击上传文件或拖拽文件到这里"
            dragSubText="图片、PDF、PPT、Word、视频等"
            onError={this.uploadError}
            onSuccess={(...args) => this.uploadSuccess(i, ...args)}
            onRemove={(...args) => this.onRemoveFile(i, ...args)}
            onProgress={() =>
              this.setState({
                fileLoading: true,
              })
            }
          >
            <Button icon={<IconUpload />} theme="light">
              点击上传
            </Button>
          </Upload>
        </Collapsible>
        <Button onClick={this.toggle}>{isOpen ? '剩余1项' : '展开'}</Button>
      </div>
    );
  }
}

export const CollapsibleWithUpload = () => <WithUpload />;

class CusHeight extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isOpen: false,
    };
    this.toggle = this.toggle.bind(this);
  }

  toggle() {
    this.setState({
      isOpen: !this.state.isOpen,
    });
  }

  render() {
    const { isOpen } = this.state;
    const maskStyle = isOpen
      ? {}
      : {
          WebkitMaskImage:
            'linear-gradient(to bottom, black 0%, rgba(0, 0, 0, 1) 60%, rgba(0, 0, 0, 0.2) 80%, transparent 100%)',
        };
    const collapsed = (
      <ul>
        <li>
          <p>Semi Design 以内容优先进行设计。</p>
        </li>
        <li>
          <p>更容易地自定义主题。</p>
        </li>
        <li>
          <p>适用国际化场景。</p>
        </li>
        <li>
          <p>效率场景加入人性化关怀。</p>
        </li>
      </ul>
    );
    const linkStyle = {
      position: 'absolute',
      left: 0,
      right: 0,
      textAlign: 'center',
      bottom: -10,
      fontWeight: 700,
      cursor: 'pointer',
    };
    console.log('out state', isOpen);
    return (
      <>
        <Button onClick={this.toggle}>Toggle</Button>
        <div
          style={{
            position: 'relative',
          }}
        >
          <Collapsible
            isOpen={isOpen}
            collapseHeight={40}
            style={{ ...maskStyle }}
            onInnerStateOpen={bool => {
              if (isOpen !== bool) {
                this.setState({
                  isOpen: bool,
                });
              }
            }}
          >
            {collapsed}
          </Collapsible>
          {isOpen ? null : (
            <a onClick={this.toggle} style={{ ...linkStyle }}>
              + Show More
            </a>
          )}
        </div>
      </>
    );
  }
}

export const CollapseHeight = () => <CusHeight />;

const Child = ({ onClick }) => {
  const [isCOpen, setIsCOpen] = useState(false);
  return (
    <div>
      <div
        style={{
          display: isCOpen ? 'block' : 'none',
          height: 200,
          background: 'green',
        }}
      >
        child
      </div>
      <Button
        onClick={() => {
          setIsCOpen(!isCOpen);
          onClick();
        }}
      >
        Toggle
      </Button>
    </div>
  );
}; // dynamic update content, children comp need to separate from parent to avoid rerender of entire comp

const DynamDemo = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [reCalcKey, setReCalcKey] = useState(0);
  return (
    <div>
      <Button onClick={() => setIsOpen(!isOpen)}>折叠</Button>
      <Collapsible isOpen={isOpen}>
        <div>
          <div
            style={{
              height: 200,
              background: 'blue',
            }}
          >
            father
          </div>
          <Child onClick={() => setReCalcKey(reCalcKey + 1)} />
        </div>
      </Collapsible>
    </div>
  );
};

export const DynamicCollapsible = () => <DynamDemo />;