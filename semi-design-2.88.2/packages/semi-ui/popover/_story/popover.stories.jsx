import React, { useState } from 'react';

import Popover from '../index';
import { strings } from '@douyinfe/semi-foundation/tooltip/constants';
import { Button, Input, Table, IconButton, Modal, Tag, Space, Select } from '@douyinfe/semi-ui';
import SelectInPopover from './SelectInPopover';
import BtnClose from './BtnClose';
import PopRight from './PopRight';
import NestedPopover from './NestedPopover';
import ArrowPointAtCenter from './ArrowPointAtCenter';
import { IconDelete } from '@douyinfe/semi-icons';

const Option = Select.Option;

export default {
  title: 'Popover',
  parameters: {
    chromatic: { disableSnapshot: true },
  },
}

let style = {
  display: 'inline-block',
  padding: '20px',
};

export const _Popover = () => (
  <div>
    <div style={style}>
      <Popover content="ies vigo" title="bytedance" position="bottom" visible={true} showArrow>
        bottom hover
      </Popover>
    </div>

    <div style={style}>
      <Popover content="ies vigo" title="bytedance" trigger="click" position="bottom">
        bottom click
      </Popover>
    </div>

    <div style={style}>
      <Popover content="ies vigo" title="bytedance" trigger="click" position="right">
        <Button>Pos:right, trigger: Click</Button>
      </Popover>
    </div>

    <div style={style}>
      <Popover
        content={<Button type="warning">btn</Button>}
        title="bytedance"
        trigger="click"
        position="right"
      >
        content is Node
      </Popover>
    </div>

    <div style={style}>
      <Popover content={<Input />} title="bytedance" trigger="click" position="right">
        content is Node
      </Popover>
    </div>
  </div>
);

_Popover.story = {
  name: 'popover',
};

export const Positions = () => (
  <div
    style={{
      width: 480,
      height: 360,
      boxSizing: 'content-box',
      padding: '150px 50px',
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'space-evenly',
    }}
  >
    {strings.POSITION_SET.map(pos => (
      <Popover
        key={pos}
        content={
          <div
            style={{
              padding: 20,
            }}
          >
            <p>Hi Bytedancer!</p>
          </div>
        }
        trigger="click"
        position={pos}
      >
        <Button key={pos}>{pos}</Button>
      </Popover>
    ))}
  </div>
);

Positions.story = {
  name: 'positions',
};

export const PopConfirm = () => (
  <div>
    <div style={style}>
      <Popover isConfirmMode content="hi byteddance ies">
        <a>IconDelete</a>
      </Popover>
    </div>
  </div>
);

PopConfirm.story = {
  name: 'popConfirm',
};

class Demo extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      visible: false,
    };
    this.changeVisible = this.changeVisible.bind(this);
    this.renderContent = this.renderContent.bind(this);
  }

  changeVisible(visible = true) {
    this.setState({
      visible,
    });
  }

  renderContent() {
    return (
      <>
        <p>hi byteddance ies</p>
        <Button onClick={() => this.changeVisible(false)}>cancel</Button>
        <Button onClick={() => this.changeVisible(false)}>confirm</Button>
      </>
    );
  }

  render() {
    const content = this.renderContent();
    const { visible } = this.state;
    return (
      <Popover trigger="custom" content={content} visible={visible} position="bottomLeft">
        <Button onClick={() => this.changeVisible(true)}>show Popover</Button>
      </Popover>
    );
  }
}

export const PopoverCustomVisible = () => <Demo />;

PopoverCustomVisible.story = {
  name: 'popover custom visible',
};


CompositeComponent.story = { name: '复合组件' };
export function CompositeComponent() {
  class TableApp extends React.Component {
    constructor(props) {
      super(props);
      this.raw = [
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
      this.state = {
        dataSource: [...this.raw],
        modalVisible: false,
        columns: [
          {
            title: 'Name',
            dataIndex: 'name',
            render: text => <a href="javascript:;">{text}</a>,
          },
          {
            title: 'Age',
            dataIndex: 'age',
          },
          {
            title: 'Address',
            dataIndex: 'address',
          },
          {
            title: 'Operation',
            render: (text, record) => (
              <div>
                <Button icon={<IconDelete />} onClick={() => this.removeRecord(record.key)} />
                <Button onClick={() => this.toggleModal(true)}>编辑</Button>
              </div>
            ),
          },
        ],
      };
    }

    removeRecord(key) {
      let dataSource = [...this.state.dataSource];

      if (key != null) {
        let idx = dataSource.findIndex(data => data.key === key); // console.log(key, dataSource, idx);

        if (idx > -1) {
          dataSource.splice(idx, 1);
          this.setState({
            dataSource,
          });
        }
      }
    }

    resetData() {
      let dataSource = [...this.raw];
      this.setState({
        dataSource,
      });
    }

    toggleModal = modalVisible => {
      this.setState({
        modalVisible,
      });
    };
    renderModalContent = () => {
      const { modalVisible } = this.state;
      return (
        <Modal
          visible={modalVisible}
          onCancel={() => this.toggleModal(false)}
          onOk={() => this.toggleModal(false)}
        >
          <p>This is a modal with customized styles.</p>
          <p>More content...</p>
          <Popover
            content={
              <div>
                <Button>按钮1</Button>
                <Button>按钮2</Button>
              </div>
            }
          >
            <Button>hover</Button>
          </Popover>
        </Modal>
      );
    };

    render() {
      let { columns, dataSource } = this.state;
      return (
        <>
          <Button onClick={() => this.resetData()}>Reset</Button>
          <Table columns={columns} dataSource={dataSource} pagination={false} />
          {this.renderModalContent()}
        </>
      );
    }
  }

  return <TableApp />;
};

const ScrollDemo = function ScrollDemo(props = {}) {
  const tops = [
    ['topLeft', 'TL'],
    ['top', 'Top'],
    ['topRight', 'TR'],
  ];
  const lefts = [
    ['leftTop', 'LT'],
    ['left', 'Left'],
    ['leftBottom', 'LB'],
  ];
  const rights = [
    ['rightTop', 'RT'],
    ['right', 'Right'],
    ['rightBottom', 'RB'],
  ];
  const bottoms = [
    ['bottomLeft', 'BL'],
    ['bottom', 'Bottom'],
    ['bottomRight', 'BR'],
  ];
  const { tagstyle, ...restProps } = props;
  return (
    <div
      style={{
        paddingLeft: 40,
      }}
    >
      <div
        style={{
          marginLeft: 40,
          whiteSpace: 'nowrap',
        }}
      >
        {tops.map((pos, index) => (
          <Popover
            content={
              <article>
                <p>hi bytedance</p>
                <p>hi bytedance</p>
              </article>
            }
            position={Array.isArray(pos) ? pos[0] : pos}
            key={index}
            trigger={'click'}
            {...restProps}
          >
            <Tag style={tagstyle}>{Array.isArray(pos) ? pos[1] : pos}</Tag>
          </Popover>
        ))}
      </div>
      <div
        style={{
          width: 40,
          float: 'left',
        }}
      >
        {lefts.map((pos, index) => (
          <Popover
            content={
              <article>
                <p>hi bytedance</p>
                <p>hi bytedance</p>
              </article>
            }
            position={Array.isArray(pos) ? pos[0] : pos}
            key={index}
            trigger={'click'}
            {...restProps}
          >
            <Tag style={tagstyle}>{Array.isArray(pos) ? pos[1] : pos}</Tag>
          </Popover>
        ))}
      </div>
      <div
        style={{
          width: 40,
          marginLeft: 180,
        }}
      >
        {rights.map((pos, index) => (
          <Popover
            content={
              <article>
                <p>hi bytedance</p>
                <p>hi bytedance</p>
              </article>
            }
            position={Array.isArray(pos) ? pos[0] : pos}
            key={index}
            trigger={'click'}
            {...restProps}
          >
            <Tag style={tagstyle}>{Array.isArray(pos) ? pos[1] : pos}</Tag>
          </Popover>
        ))}
      </div>
      <div
        style={{
          marginLeft: 40,
          clear: 'both',
          whiteSpace: 'nowrap',
        }}
      >
        {bottoms.map((pos, index) => (
          <Popover
            content={
              <article>
                <p>hi bytedance</p>
                <p>hi bytedance</p>
              </article>
            }
            position={Array.isArray(pos) ? pos[0] : pos}
            key={index}
            trigger={'click'}
            {...restProps}
          >
            <Tag style={tagstyle}>{Array.isArray(pos) ? pos[1] : pos}</Tag>
          </Popover>
        ))}
      </div>
    </div>
  );
};

export const ScrollPopover = () => {
  return (
    <>
      <div id="wrapper">
        <div
          style={{
            height: '200vh',
            width: '200vw',
            padding: 50,
          }}
        >
          滚动到下面
        </div>
      </div>
      <div
        style={{
          padding: 1200,
        }}
      >
        <ScrollDemo
          content={
            <article
              style={{
                padding: 12,
              }}
            >
              <p>hi bytedance</p>
              <p>hi bytedance</p>
            </article>
          }
        />
      </div>
    </>
  );
};

ScrollPopover.story = {
  name: 'scroll popover',
};

export const WithArrow = () => (
  <div>
    <div
      style={{
        padding: 120,
      }}
    >
      <ScrollDemo showArrow />
    </div>
    <div
      style={{
        padding: 120,
      }}
    >
      <ScrollDemo
        showArrow
        tagstyle={{
          minHeight: 80,
          minWidth: 120,
        }}
      />
    </div>
    <div
      style={{
        padding: 120,
      }}
    >
      <ScrollDemo
        showArrow
        tagstyle={{
          minHeight: 80,
          minWidth: 120,
        }}
        style={{
          backgroundColor: 'green',
        }}
      />
    </div>
  </div>
);

WithArrow.story = {
  name: 'with arrow',
};

export const NoContent = () => (
  <div>
    <div
      style={{
        padding: 50,
      }}
    >
      <ScrollDemo content={<div></div>} />
    </div>
    <div
      style={{
        padding: 50,
      }}
    >
      <ScrollDemo showArrow content={''} />
    </div>
    <div
      style={{
        padding: 50,
      }}
    >
      <ScrollDemo
        showArrow
        content={''}
        tagstyle={{
          height: 80,
          minWidth: 100,
        }}
        style={{
          padding: 20,
        }}
      />
    </div>
  </div>
);

NoContent.story = {
  name: 'no content',
};

export const _SelectInPopover = () => (
  <div
    style={{
      padding: 50,
    }}
  >
    <SelectInPopover />
  </div>
);

_SelectInPopover.story = {
  name: 'select in popover',
};

export const CloseBtnInPopover = () => <BtnClose />;

CloseBtnInPopover.story = {
  name: 'close btn in popover',
};

export const PopoverFloatRight = () => <PopRight />;

PopoverFloatRight.story = {
  name: 'popover float right',
};

export const NestedPopoverDemo = () => <NestedPopover />;
NestedPopoverDemo.story = {
  name: 'nested popover'
}

export const ArrowPointAtCenterDemo = () => <ArrowPointAtCenter />;
ArrowPointAtCenterDemo.story = {
  name: 'arrow point at center'
}

export const A11yKeyboard = () => {
  const [visible, setVisible] = React.useState(false);
  const popStyle = { height: 200, width: 200 };

  const renderContent = ({ initialFocusRef }) => {
    return (
      <div style={popStyle} data-cy="pop">
        <button data-cy="pop-focusable-first">first focusable</button>
        <a href="https://semi.design">link</a>
        {/* <input ref={initialFocusRef} placeholder="init focus" /> */}
        <input placeholder="" defaultValue="semi" />
        <a href="https://semi.design">link2</a>
        <button data-cy="pop-focusable-last">last focusable</button>
      </div>
    );
  };

  const noFocusableContent = (
    <div style={popStyle}>没有可聚焦元素</div>
  );

  const initFocusContent = ({ initialFocusRef }) => {
    return (
      <div style={popStyle} data-cy="pop">
        <button data-cy="pop-focusable-first">first focusable</button>
        <input placeholder="" defaultValue="semi" ref={initialFocusRef} data-cy="initial-focus-input" />
        <button data-cy="pop-focusable-last">last focusable</button>
      </div>
    );
  };

  return (
      <div style={{ paddingLeft: 100, paddingTop: 100 }}>
          <Space spacing={100}>
              <Popover content={renderContent} trigger="click" motion={false}>
                  <Button data-cy="click">click</Button>
              </Popover>
              <Popover content={renderContent} trigger="hover">
                  <span data-cy="hover">hover</span>
              </Popover>
              <Popover content={renderContent} trigger="focus">
                  <Input data-cy="focus" defaultValue="focus" style={{ width: 150 }} />
              </Popover>
              <Popover
                  content={renderContent}
                  trigger="custom"
                  visible={visible}
                  onEscKeyDown={() => {
                      console.log('esc key down');
                      setVisible(false);
                  }}
              >
                  <Button onClick={() => setVisible(!visible)} data-cy="custom">
                    custom trigger + click me toggle show
                  </Button>
              </Popover>
              <Popover content={noFocusableContent} trigger="click" data-cy="click-pop-contains-no-focusable">
                  <Button>pop内没有可聚焦元素</Button>
              </Popover>
              <Popover content={initFocusContent} trigger="click" motion={false}>
                  <Button data-cy="initial-focus">custom initialFocus</Button>
              </Popover>
              <Popover content={renderContent} trigger="click" motion={false} closeOnEsc={false}>
                  <Button data-cy="closeOnEsc-false">closeOnEsc=false</Button>
              </Popover>
              <Popover content={renderContent} trigger="click" motion={false} returnFocusOnClose={false}>
                  <Button data-cy="returnFocusOnClose-false">returnFocusOnClose=false</Button>
              </Popover>
          </Space>
      </div>
  );
};
A11yKeyboard.storyName = "a11y keyboard and focus";

/**
 * fix 嵌套 popover 的弹出层会导致外部 popover 关闭问题
 * 
 * @see https://github.com/DouyinFE/semi-design/issues/818
 * @see https://github.com/facebook/react/issues/4335#issuecomment-421705171
 */
export const FixNestedPopover = () => {
    return (
        <div data-cy="fix-nested-popover" style={{ paddingLeft: 100 }}>
            <Popover
                content={(
                    <div data-cy="select-in-popover" style={{ padding: 20 }}>
                        <Select
                            defaultValue="abc"
                            style={{ width: 120 }}
                        >
                            <Option value="abc">抖音</Option>
                            <Option value="hotsoon">火山</Option>
                            <Option value="pipixia" disabled>
                                皮皮虾
                            </Option>
                            <Option value="xigua">西瓜视频</Option>
                        </Select>
                    </div>
                )}
                trigger="click"
                showArrow
            >
                <Tag>点击此处</Tag>
            </Popover>
        </div>
    );
}

export const CustomBg = () => {
  return (
      <div id='popup-parent' style={{ position: 'relative' }}>
          <Popover
              content={
                  <article style={{ padding: 4 }}>
                      Hi, Semi UI Popover.
                  </article>
              }
              trigger='custom'
              visible
              position='right'
              showArrow
              style={{
                  backgroundColor: 'rgba(var(--semi-blue-4),1)',
                  borderColor: 'rgba(var(--semi-blue-4),1)',
                  color: 'var(--semi-color-white)',
                  borderWidth: 1,
                  borderStyle: 'solid',
              }}
          >
              <Tag
                  style={{
                      backgroundColor: 'rgba(var(--semi-blue-4),1)',
                      color: 'var(--semi-color-white)'
                  }}
              >
                  Colorful Popover
              </Tag>
          </Popover>
      </div>
  );
}
