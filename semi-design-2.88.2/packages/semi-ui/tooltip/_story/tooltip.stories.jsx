import React, { useState, useMemo, PureComponent } from 'react';
import Tooltip from '../index';
import './story.scss';
import {
  Tag,
  Icon,
  IconButton,
  Switch,
  Checkbox,
  Radio,
  Button,
  Select,
  InputNumber,
  Space,
  Popover,
  Input,
  RadioGroup,
  SideSheet,
  Dropdown,
  Popconfirm
} from '@douyinfe/semi-ui';

import InTableDemo from './InTable';
import EdgeDemo from './Edge';
import ScrollTooltip from './ScrollDemo';
import DangerousHtml from './DangerousHtml';
import ArrowPointAtCenter from './ArrowPointAtCenter';
import CustomContainer from './CustomContainer';
import ContainerPosition from './ContainerPosition';
import { IconList, IconSidebar, IconEdit } from '@douyinfe/semi-icons';
import {  
  Right2Left, Right2LeftTop, Right2LeftBottom, Right2RightTop, Right2RightBottom,
  Left2Right, Left2RightTop, Left2RightBottom, Left2LeftTop, Left2LeftBottom,
  Top2Bottom, Top2BottomLeft, Top2BottomRight, Top2TopLeft, Top2TopRight,
  Bottom2Top, Bottom2TopLeft, Bottom2TopRight, Bottom2BottomLeft, Bottom2BottomRight,
 } from './AutoAdjustOverflow';
 import FixedStringEllipsis from './FixedStringEllipsis';

 export {
  FixedStringEllipsis,
 }

export default {
  title: 'Tooltip',
  parameters: {
    chromatic: { disableSnapshot: true },
  },
};

function test(visible) {
  console.log('visible Change:' + visible);
}

export const ContextMenuTooltip = () => {
  return <Tooltip content='context menu content' trigger='contextMenu'>
    <Button>点击右键展开 Tooltip</Button>
  </Tooltip>
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
  const { tagStyle, ...restProps } = props;
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
          <Tooltip
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
            <Tag style={tagStyle}>{Array.isArray(pos) ? pos[1] : pos}</Tag>
          </Tooltip>
        ))}
      </div>
      <div
        style={{
          width: 40,
          float: 'left',
        }}
      >
        {lefts.map((pos, index) => (
          <Tooltip
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
            <Tag style={tagStyle}>{Array.isArray(pos) ? pos[1] : pos}</Tag>
          </Tooltip>
        ))}
      </div>
      <div
        style={{
          width: 40,
          marginLeft: 180,
        }}
      >
        {rights.map((pos, index) => (
          <Tooltip
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
            <Tag style={tagStyle}>{Array.isArray(pos) ? pos[1] : pos}</Tag>
          </Tooltip>
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
          <Tooltip
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
            <Tag style={tagStyle}>{Array.isArray(pos) ? pos[1] : pos}</Tag>
          </Tooltip>
        ))}
      </div>
    </div>
  );
};

export const ScaleContainerTooltip = () => {

    return <div>
        <div id={"scaleContainer"} style={{border: '1px solid red', width: 400, height: 400, transform:'scale(1.5)',transformOrigin:'left'}}>
            <Tooltip
                content={
                    <article>
                        <p>hi bytedance</p>
                        <p>hi bytedance</p>
                    </article>
                }
                trigger={'click'}
                getPopupContainer={()=>document.querySelector("#scaleContainer")}
            >
                <Tag style={{'margin': '90px 90px'}}>Tooltip 跟着缩放</Tag>
            </Tooltip>
        </div>

        <div  style={{border: '1px solid red', width: 400, height: 400, scale: '1.5',marginTop:500,transformOrigin:'left'}}>
            <Tooltip
                content={
                    <article>
                        <p>hi bytedance</p>
                        <p>hi bytedance</p>
                    </article>
                }
                trigger={'click'}
            >
                <Tag style={{'margin': '90px 90px'}}>Tooltip 不跟着缩放</Tag>
            </Tooltip>
        </div>

    </div>
}

export const TooltipOnVisibleChange = () => {
    const [visible, setVisible] = useState(true);
    return (
        <div className="demo">
            <div>
                <label>受控</label>
                <Tooltip
                    content={
                        <article>
                            <p>hi bytedance</p>
                            <p>hi bytedance</p>
                        </article>
                    }
                    position="top"
                    onVisibleChange={setVisible}
                    trigger="click"
                    visible={visible}
        >
          <Tag>demo</Tag>
        </Tooltip>
      </div>

      <br />
      <br />
      <div>
        <label>非受控</label>
        <Tooltip
          content={
            <article>
              <p>hi bytedance</p>
              <p>hi bytedance</p>
            </article>
          }
          position="leftTop"
          onVisibleChange={test}
          trigger="click"
        >
          <Tag>demo</Tag>
        </Tooltip>
      </div>
      <br />
      <br />

      {/* <Tooltip
       content={
           <article>
               <p>hi bytedance</p>
               <p>hi bytedance</p>
           </article>
       }
       position="rightBottom"
       onVisibleChange={test}
       trigger="hover"
    >
       <Tag>hover</Tag>
    </Tooltip>
    <br />
    <br />
    <Tooltip
       content={
           <article>
               <p>hi bytedance</p>
               <p>hi bytedance</p>
           </article>
       }
       mouseLeaveDelay={100}
       position="rightBottom"
       onVisibleChange={test}
       trigger="hover"
    >
       <Tag>hover with leave delay time</Tag>
    </Tooltip>
    <br />
    <br />
    <Tooltip
       content={
           <article>
               <p>hi bytedance</p>
               <p>hi bytedance</p>
           </article>
       }
       position="rightBottom"
       onVisibleChange={test}
       trigger="click"
    >
       <Tag>click</Tag>
    </Tooltip> */}
    </div>
  );
};

TooltipOnVisibleChange.story = {
  name: 'tooltip onVisibleChange',
};

export const GetPopupContainerDemo = () => (
  <div className="demo">
    <div className="content-layer" />
    <Tooltip
      content={
        <article>
          <p>hi bytedance</p> <p>hi bytedance</p>
        </article>
      }
      position="bottom"
      visible
      trigger="custom"
      getPopupContainer={() => document.querySelector('.content-layer')}
    >
      <Tag>指定弹出层的容器</Tag>
      {/* <div className='content'></div> */}
    </Tooltip>
    <div>
      <label>给定容器为window，看是否报错</label>
      <Tooltip content={'单选'} position="top" getPopupContainer={() => window}>
        <Radio style={{ display: 'inline-flex' }}>单选</Radio>
      </Tooltip>
    </div>
  </div>
);

GetPopupContainerDemo.story = {
  name: 'tooltip指定弹出层的容器',
};

export const TooltipAll = () => (
  <div className="demo">
    <ScrollDemo />
    <div
      style={{
        padding: 120,
      }}
    >
      <ScrollDemo
        showArrow
        tagStyle={{
          height: 80,
        }}
      />
    </div>
  </div>
);

TooltipAll.story = {
  name: 'tooltip All',
};

export const NoContent = () => (
  <div className="demo">
    <div
      style={{
        padding: 120,
      }}
    >
      <ScrollDemo showArrow content={''} />
    </div>
    <div
      style={{
        padding: 120,
      }}
    >
      <ScrollDemo
        showArrow
        tagStyle={{
          minHeight: 80,
          minWidth: 120,
        }}
        content={''}
      />
    </div>
  </div>
);

NoContent.story = {
  name: 'no content',
};

export const AdjustPosition = () => (
  <>
    <div className="adjust">
      <div className="wrapper">
        第一个滚动区域
        <Tooltip
          content={
            <article>
              <p>hi bytedance</p>
              <p>hi bytedance</p>
            </article>
          }
          position="rightBottom"
          trigger="click"
        >
          {/* <Tag className='topLeft'>topleft</Tag> */}
          <div>test</div>
        </Tooltip>
        <Tooltip
          content={
            <article>
              <p>hi bytedance</p>
              <p>hi bytedance</p>
            </article>
          }
          position="topRight"
          trigger="click"
        >
          <Tag className="topRight">topRight</Tag>
        </Tooltip>
        <Tooltip
          content={
            <article>
              <p>hi bytedance</p>
              <p>hi bytedance</p>
            </article>
          }
          position="bottomLeft"
          trigger="click"
        >
          <Tag className="bottomLeft">bottomLeft</Tag>
        </Tooltip>
        <Tooltip
          content={
            <article>
              <p>hi bytedance</p>
              <p>hi bytedance</p>
            </article>
          }
          position="bottomRight"
          trigger="click"
        >
          <Tag className="bottomRight">bottomRight</Tag>
        </Tooltip>
      </div>
    </div>
    <div className="adjust2">
      <div className="wrapper2">第二个滚动区域</div>
    </div>
  </>
);

AdjustPosition.story = {
  name: '自适应',
};

export const AdjustPosIfNeed = () => {
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

     return (
        <div style={{ paddingLeft: 40 }}>
            <div style={{ marginLeft: 40, whiteSpace: 'nowrap' }}>
                {tops.map((pos, index) => (
                    <Tooltip
                        showArrow
                        arrowPointAtCenter
                        content={
                            <article>
                                Hi ByteDancer, this is a tooltip.
                                <br /> We have 2 lines.
                            </article>
                        }
                        position={Array.isArray(pos) ? pos[0] : pos}
                        key={index}
                    >
                        <Tag 
                          style={{ marginRight: '8px' }}
                          data-cy={Array.isArray(pos) ? pos[0] : pos}
                        >
                          {Array.isArray(pos) ? pos[1] : pos}
                        </Tag>
                    </Tooltip>
                ))}
            </div>
            <div style={{ width: 40, float: 'left' }}>
                {lefts.map((pos, index) => (
                    <Tooltip
                        showArrow
                        arrowPointAtCenter
                        content={
                            <article>
                                Hi ByteDancer, this is a tooltip.
                                <br /> We have 2 lines.
                            </article>
                        }
                        position={Array.isArray(pos) ? pos[0] : pos}
                        key={index}
                    >
                        <Tag data-cy={Array.isArray(pos) ? pos[0] : pos} style={{ marginBottom: '8px' }}>{Array.isArray(pos) ? pos[1] : pos}</Tag>
                    </Tooltip>
                ))}
            </div>
            <div style={{ width: 40, marginLeft: 180 }}>
                {rights.map((pos, index) => (
                    <Tooltip
                        showArrow
                        arrowPointAtCenter
                        content={
                            <article>
                                Hi ByteDancer, this is a tooltip.
                                <br /> We have 2 lines.
                            </article>
                        }
                        position={Array.isArray(pos) ? pos[0] : pos}
                        key={index}
                    >
                        <Tag data-cy={Array.isArray(pos) ? pos[0] : pos} style={{ marginBottom: '8px' }}>{Array.isArray(pos) ? pos[1] : pos}</Tag>
                    </Tooltip>
                ))}
            </div>
            <div style={{ marginLeft: 40, clear: 'both', whiteSpace: 'nowrap' }}>
                {bottoms.map((pos, index) => (
                    <Tooltip
                        showArrow
                        arrowPointAtCenter
                        content={
                            <article>
                                Hi ByteDancer, this is a tooltip.
                                <br /> We have 2 lines.
                            </article>
                        }
                        position={Array.isArray(pos) ? pos[0] : pos}
                        key={index}
                    >
                        <Tag data-cy={Array.isArray(pos) ? pos[0] : pos} position={Array.isArray(pos) ? pos[0] : pos} style={{ marginRight: '8px' }}>{Array.isArray(pos) ? pos[1] : pos}</Tag>
                    </Tooltip>
                ))}
            </div>
        </div>
    );
}

AdjustPosIfNeed.story = {
  name: '自适应位置',
};

export const CompositeComponent = () => (
  <div
    style={{
      padding: 50,
    }}
  >
    <Tooltip
      content={
        <article>
          <p>hi bytedance</p> <p>hi bytedance</p>
        </article>
      }
      position="top"
    >
      <IconList />
    </Tooltip>
    <Tooltip content={'收起'} position="top">
      <IconButton icon={<IconSidebar />} />
    </Tooltip>
    <Tooltip content={'开关'} position="top">
      <Switch />
    </Tooltip>
    <Tooltip content={'选择框'} position="top">
      <Checkbox
        style={{
          display: 'inline-flex',
        }}
      >
        选择框
      </Checkbox>
    </Tooltip>
    <Tooltip content={'单选'} position="top">
      <Radio
        style={{
          display: 'inline-flex',
        }}
      >
        单选
      </Radio>
    </Tooltip>
  </div>
);

CompositeComponent.story = {
  name: '复合组件',
};

export const WrapDisabledElems = () => (
  <div
    style={{
      padding: 50,
    }}
  >
    <Tooltip content="disabled">
      <IconButton disabled icon={<IconEdit />} />
    </Tooltip>
    <Tooltip content="disabled">
      <IconButton disabled icon={<IconEdit />} block />
    </Tooltip>
    <Tooltip content="disabled">
      <Button disabled block>
        编辑
      </Button>
    </Tooltip>
    <Tooltip content="disabled">
      <Button
        disabled
        style={{
          display: 'block',
        }}
      >
        编辑
      </Button>
    </Tooltip>
  </div>
);

WrapDisabledElems.story = {
  name: 'wrap disabled elems',
};

export const InTable = () => (
  <div
    style={{
      marginTop: 50,
    }}
  >
    <InTableDemo />
  </div>
);

InTable.story = {
  name: 'in table',
};

export const _EdgeDemo = () => <EdgeDemo />;

_EdgeDemo.story = {
  name: 'edge demo',
};

export const ScrollTooltipDemo = () => <ScrollTooltip />;
ScrollTooltipDemo.story = {
  name: 'scroll demo and set popup container',
};
export const DangerousHtmlDemo = () => <DangerousHtml />;
DangerousHtmlDemo.story = {
  name: 'in dangerous html',
};
export const ArrowPointAtCenterDemo = () => <ArrowPointAtCenter />;
ArrowPointAtCenterDemo.story = {
  name: 'arrow point at center',
};
export const CustomContainerDemo = () => <CustomContainer />;
CustomContainerDemo.story = {
  name: 'custom container',
};
export const ContainerPositionDemo = () => <ContainerPosition />;
ContainerPositionDemo.story = {
  name: 'container observer',
};

export const QuickMoveMouse = () => {
  /**
   * mouseEnterDelay, mouseLeaveDelay 默认都为 50
   * mouseEnterDelay, mouseLeaveDelay 都为 0，快速滑动可能出现两个 tooltip 出现
   */
  const Demo = () => {
    const props = {
      mouseEnterDelay: 50,
      mouseLeaveDelay: 0,
    };
    return (
      <div className="demo">
        <div>
          <Tooltip content={'1'} {...props}>
            aaaaaaaaaaa
          </Tooltip>
        </div>
        <div>
          <Tooltip content={'2'} {...props}>
            bbbbbbbbbbb
          </Tooltip>
        </div>
        <div>
          <Tooltip content={'3'} {...props}>
            ccccccccccc
          </Tooltip>
        </div>
        <div>
          <Tooltip content={'4'} {...props}>
            aaaaaaaaaaa
          </Tooltip>
        </div>
        <div>
          <Tooltip content={'5'} {...props}>
            bbbbbbbbbbb
          </Tooltip>
        </div>
        <div>
          <Tooltip content={'6'} {...props}>
            ccccccccccc
          </Tooltip>
        </div>
        <div>
          <Tooltip content={'7'} {...props}>
            aaaaaaaaaaa
          </Tooltip>
        </div>
        <div>
          <Tooltip content={'8'} {...props}>
            bbbbbbbbbbb
          </Tooltip>
        </div>
        <div>
          <Tooltip content={'9'} {...props}>
            ccccccccccc
          </Tooltip>
        </div>
      </div>
    );
  };

  return <Demo />;
};

QuickMoveMouse.story = {
  name: '快速移动鼠标可见性',
};

export const MotionFalseFix1402 = () => {
  function Demo() {
    const Test = React.forwardRef((props, ref) => (
      <span {...props} ref={ref}>
        Test
      </span>
    ));
    return (
      <div>
        <Tooltip content={'hi bytedance'} motion={false}>
          <Test />
        </Tooltip>
        <br />
        <br />
        <Tooltip content={'hi bytedance'}>
          <Test />
        </Tooltip>
      </div>
    );
  }

  return <Demo />;
};

MotionFalseFix1402.story = {
  name: 'motion=false fix #1402',
};

export const DisabledWrapperCls = () => (
  <>
    <Tooltip wrapperClassName="test" content={'hi bytedance'}>
      <Button>按钮</Button>
    </Tooltip>
    <br />
    <br />
    <Tooltip wrapperClassName="test" content={'hi bytedance'}>
      <Button disabled>禁用的单个按钮</Button>
    </Tooltip>
    <br />
    <br />
    <Tooltip wrapperClassName="test" content={'hi bytedance'}>
      <Button>正常的多个按钮</Button>
      <Button>正常的多个按钮</Button>
    </Tooltip>
    <br />
    <br />
    <Tooltip wrapperClassName="test" content={'hi bytedance'}>
      <Select disabled placeholder="请选择业务线" style={{ width: 120 }}>
        <Select.Option value="abc">抖音</Select.Option>
        <Select.Option value="hotsoon">火山</Select.Option>
        <Select.Option value="jianying" disabled>
          剪映
        </Select.Option>
        <Select.Option value="xigua">西瓜视频</Select.Option>
      </Select>
    </Tooltip>
    <br />
    <br />
  </>
);

DisabledWrapperCls.story = {
  name: 'disabledWrapperCls',
};

export const ShowArrow = () => {
  function Demo() {
    const Test = React.forwardRef((props, ref) => (
      <Tag {...props} ref={ref}>
        Test
      </Tag>
    ));
    return (
      <div>
        <h4>should show content and arrow when click</h4>
        <Tooltip showArrow trigger="click" content={'hi bytedance'}>
          <Test />
        </Tooltip>
      </div>
    );
  }

  return <Demo />;
};

ShowArrow.story = {
  name: 'showArrow',
};

export const OnClickOutSideDemo = () => {
  let [v, setV] = useState(false);
  let clickOutSide = () => {
    console.log('clickOutSide');
    setV(false);
  };
  return (
    <>
      <Tooltip onClickOutSide={() => clickOutSide()} content={'hi bytedance'} visible={v} trigger="custom">
        <Button onClick={() => setV(true)}>按钮</Button>
      </Tooltip>
      <br />
      <br />
      <Tooltip onClickOutSide={() => console.log('clickOutSide')} content={'hi bytedance'} trigger="click">
        <Button>单个按钮</Button>
      </Tooltip>
    </>
  );
};
OnClickOutSideDemo.story = {
  name: 'OnClickOutSide',
};

export const AutoAdjustWithSpacing = () => {
  const [height, setHeight] = useState(84);
  const [key, setKey] = useState(1);
  const initSpacing = 8;
  const [spacing, setSpacing] = useState(initSpacing);

  const change = (height, hasSpace) => {
    setHeight(height);
    hasSpace ? setSpacing(initSpacing) : setSpacing(0);
    setKey(Math.random());
  };

  return (
    <div className="demo1">
      <div>
        <Tooltip
          motion={false}
          rePosKey={key}
          // spacing={spacing}
          content={
            <article style={{ boxSizing: 'border-box', height: height }}>
              <p>hi bytedance, + padding 20</p>
              <p>hi bytedance</p>
            </article>
          }
          position="top"
          trigger="custom"
          visible={true}
        >
          <Tag>demo</Tag>
        </Tooltip>
      </div>
      <div style={{ marginTop: 200 }}>
        <Switch
          onChange={hasSpace => change(height, hasSpace)}
          checked={spacing === initSpacing ? true : false}
        ></Switch>
        <InputNumber onChange={height => change(Number(height))} value={height} style={{ width: 200 }} />
      </div>
    </div>
  );
};

AutoAdjustWithSpacing.story = {
  name: 'AutoAdjustWithSpacing',
};

/**
 * Chromatic UI test
 */
export const leftTopOverDemo = () => {
  const [visible, setVisible] = useState(true);
  const content = <div style={{ height: 200, width: 200 }}>Semi Design</div>;

  const commonProps = {
    content,
    showArrow: false,
    visible:true,
    trigger: 'custom',
    motion: false,
  };
  const buttonStyle = {
    width: 200,
  };

  return (
    <div data-cy="wrapper">
      <Button onClick={() => setVisible(!visible)} data-cy="toggleVisible">toggle visible</Button>
      <div style={{ paddingTop: 110 }}>
        <Space spacing={80}>
          <Tooltip {...commonProps} position="leftBottomOver" trigger="click">
            <Button data-cy="leftBottomOver" style={buttonStyle}>
              leftBottomOver
            </Button>
          </Tooltip>
          <Tooltip {...commonProps} position="rightBottomOver" trigger="click">
            <Button data-cy="rightBottomOver" style={buttonStyle}>
              rightBottomOver
            </Button>
          </Tooltip>
        </Space>
      </div>
      <Space spacing={80}>
        <Tooltip {...commonProps} position="leftTopOver" trigger="click">
          <Button data-cy="leftTopOver" style={buttonStyle}>
            leftTopOver
          </Button>
        </Tooltip>
        <Tooltip {...commonProps} position="rightTopOver" trigger="click">
          <Button data-cy="rightTopOver" style={buttonStyle}>
            rightTopOver
          </Button>
        </Tooltip>
      </Space>
    </div>
  );
};

leftTopOverDemo.storyName = `leftTopOver visible`;
leftTopOverDemo.parameters = {
  chromatic: {
    disableSnapshot: false,
    delay: 3000,
    viewports: [1200],
  },
};

/**
 * Cypress test
 */
export const leftTopOverAutoAdjustOverflow = () => {
  const content = <div style={{ height: 200, width: 200 }}>Semi Design</div>;

  const commonProps = {
    content,
    trigger: 'click',
    showArrow: false,
  };

  return (
    <div
      data-cy="wrapper"
      style={{ width: '200vw', height: '200vw', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div>
        <Tooltip {...commonProps} position="leftTopOver">
          <Button data-cy="leftTopOver" style={{ width: 200 }}>
            leftTopOver
          </Button>
        </Tooltip>
      </div>
    </div>
  );
};
leftTopOverAutoAdjustOverflow.storyName = `leftTopOver autoAdjustOverflow`;

export const autoFocusContentDemo = () => {
  const [controlMotionVisible, setControlMotionVisible] = React.useState(false);
  const [controlNoMotionVisible, setControlNoMotionVisible] = React.useState(false);

  const onMotionVisibleChange = React.useCallback(() => {
    setControlMotionVisible(!controlMotionVisible);
  }, [setControlMotionVisible, controlMotionVisible]);

  const onNoMotionVisibleChange = React.useCallback(() => {
    setControlNoMotionVisible(!controlNoMotionVisible);
  }, [setControlNoMotionVisible, controlNoMotionVisible]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', gap: 18, flex: 1, alignItems: 'center' }}>
        <span>Hover触发</span>
        <Popover position="bottomLeft" content={<Input autofocus data-cy="hoverInput"/>}>
          <Button data-cy="hover">motion</Button>
        </Popover>

        <Popover motion={false} position="bottomLeft" content={<Input autofocus data-cy="hoverNoMotionInput"/>}>
          <Button data-cy="hoverNoMotion">no motion</Button>
        </Popover>
      </div>
      <div style={{ display: 'flex', gap: 18, flex: 1, alignItems: 'center' }}>
        <span>Click触发</span>
        <Popover position="bottomLeft" content={<Input autofocus data-cy="clickInput"/>} trigger="click">
          <Button data-cy="click">motion</Button>
        </Popover>

        <Popover motion={false} position="bottomLeft" content={<Input autofocus data-cy="clickNoMotionInput"/>} trigger="click">
          <Button data-cy="clickNoMotion">no motion</Button>
        </Popover>
      </div>
      <div style={{ display: 'flex', gap: 18, flex: 1, alignItems: 'center' }}>
        <span>受控</span>
        <Button onClick={onMotionVisibleChange} data-cy="controlled">motion状态切换</Button>
        <Popover visible={controlMotionVisible} trigger="custom" position="bottomLeft" content={<Input autofocus data-cy="controlledInput"/>}>
          <Button disabled data-cy="controlledDisableBtn">motion</Button>
        </Popover>

        <Button onClick={onNoMotionVisibleChange } data-cy="controlledNoMotion">no motion状态切换</Button>
        <Popover
          visible={controlNoMotionVisible}
          trigger="custom"
          motion={false}
          position="bottomLeft"
          content={<Input autofocus data-cy="controlledNoMotionInput"/>}
        >
          <Button disabled data-cy="controlledNoMotionDisableBtn">no motion</Button>
        </Popover>
      </div>
    </div>
  );
};


export const FlashWithReact18 = () => {
  const [visible, setV] = useState(false);

  const change = () => {
    setV(false);
  }

  return (<>
    <Tooltip content='test work with react 18' position='bottom' trigger='custom' visible={visible}>
      <Button style={{ marginLeft: 10 }} onClick={() => setV(true)}>show, semi with react 18 motion=true, abnormal</Button>
    </Tooltip>
    <Button style={{ marginLeft: 10 }} onClick={() => change()}>hide</Button>

  </>);
}




export const Transition = () => {

  const [transitionState, setT] = useState('');

  const [insert, setInsert] = useState(false);

  const handleLeave = () => {
    console.log('set insert false')
    setInsert(false);
  }

  const CommonDOM = () => {
    const enterCls = `semi-tooltip-bounceIn`;
    const leaveCls = `semi-tooltip-zoomOut`;
    const animateStyle = {
      animationDirection: 'normal',
      animationName: transitionState === 'enter' ? enterCls : leaveCls,
      animationDuration: '1000ms',
    }

    const handleEnd = () => {
      if (transitionState === 'enter') {
        console.log('animation end of show');
      } else if (transitionState === 'leave') {
        console.log('animation end of hide');
        handleLeave();
      }
    }
     
    return <div style={{ ...animateStyle }} onAnimationEnd={handleEnd}>test</div>
  };

  const toggleShow = (insert) => {
    if (!transitionState) {
      setT('enter');
      setInsert(insert);
    } else if (transitionState === 'enter') {
      setT('leave');
    } else if (transitionState === 'leave') {
      setT('enter');
      setInsert(insert);
    }
  };

  return (
    <>
      <div style={{ width: 200, height: 90, border: '1px solid var(--semi-color-text-1)' }}>
        {
          insert ? (
            <CommonDOM></CommonDOM>
            ): null
        }
      </div>
      <Button onClick={() => toggleShow(true)}>show</Button>
      <Button onClick={() => toggleShow(false)}>hide</Button>
    </>
  )
}

export const TransitionDemo = () => {
  const [key, setKey] = useState(1);
  return (
    <>
    <Transition key={key} />
    <Button onClick={() => setKey(Math.random())}>reset Demo</Button>
  </>
  )
}

export const AdjustPosIfNeedTBLR = () => {
  
  const content = <article>
    Hi ByteDancer, this is a tooltip.
    <br /> We have 2 lines.
  </article>

  const contentHigh = <article>
    Hi ByteDancer, this is a tooltip.
    <br /> We have 2 lines.
    <br /> We have 2 lines.
  </article>

  return (
    <div style={{ paddingLeft: 0, width: 800, height: '100%' }}>
      <Tooltip
        showArrow
        arrowPointAtCenter
        content={content}
        position={'top'}
      >
        <Tag style={{ position: 'absolute', left: 20, top: 40 }}>top to bottomLeft</Tag>
      </Tooltip>
      <Tooltip
        showArrow
        arrowPointAtCenter
        content={content}
        position={'top'}
      >
        <Tag style={{ position: 'absolute', right: 20, top: 40 }}>top to bottomRight</Tag>
      </Tooltip>
      <Tooltip
        showArrow
        arrowPointAtCenter
        content={content}
        position={'top'}
      >
        <Tag style={{ position: 'absolute', left: 20, top: 70 }}>top to topLeft</Tag>
      </Tooltip>
      <Tooltip
        showArrow
        arrowPointAtCenter
        content={content}
        position={'top'}
      >
        <Tag style={{ position: 'absolute', right: 20, top: 70 }}>top to topRight</Tag>
      </Tooltip>
      <Tooltip
        showArrow
        arrowPointAtCenter
        content={content}
        position={'bottom'}
      >
        <Tag data-cy={'bottom'} style={{ position: 'absolute', left: 20, bottom: 70 }}>bottom to bottomLeft</Tag>
      </Tooltip>
      <Tooltip
        showArrow
        arrowPointAtCenter
        content={content}
        position={'bottom'}
      >
        <Tag data-cy={'bottom'} style={{ position: 'absolute', right: 20, bottom: 70 }}>bottom to bottomRight</Tag>
      </Tooltip>
      <Tooltip
        showArrow
        arrowPointAtCenter
        content={content}
        position={'bottom'}
      >
        <Tag data-cy={'bottom'} style={{ position: 'absolute', left: 20, bottom: 40 }}>bottom to topLeft</Tag>
      </Tooltip>
      <Tooltip
        showArrow
        arrowPointAtCenter
        content={content}
        position={'bottom'}
      >
        <Tag data-cy={'bottom'} style={{ position: 'absolute', right: 20, bottom: 40 }}>bottom to topRight</Tag>
      </Tooltip>
      <Tooltip
        showArrow
        arrowPointAtCenter
        content={contentHigh}
        position={'left'}
      >
        <Tag style={{ position: 'absolute', left: 300, top: 20 }}>left to leftTop</Tag>
      </Tooltip>
      <Tooltip
        showArrow
        arrowPointAtCenter
        content={contentHigh}
        position={'left'}
      >
        <Tag style={{ position: 'absolute', left: 300, bottom: 20 }}>left to leftBottom</Tag>
      </Tooltip>
      <Tooltip
        showArrow
        arrowPointAtCenter
        content={contentHigh}
        position={'left'}
      >
        <Tag style={{ position: 'absolute', left: 180, top: 20 }}>left to rightTop</Tag>
      </Tooltip>
      <Tooltip
        showArrow
        arrowPointAtCenter
        content={contentHigh}
        position={'left'}
      >
        <Tag style={{ position: 'absolute', left: 180, bottom: 20 }}>left to rightBottom</Tag>
      </Tooltip>
      <Tooltip
        showArrow
        arrowPointAtCenter
        content={contentHigh}
        position={'right'}
      >
        <Tag style={{ position: 'absolute', right: 300, top: 20 }}>right to rightTop</Tag>
      </Tooltip>
      <Tooltip
        showArrow
        arrowPointAtCenter
        content={contentHigh}
        position={'right'}
      >
        <Tag style={{ position: 'absolute', right: 300, bottom: 20 }}>right to rightBottom</Tag>
      </Tooltip>
      <Tooltip
        showArrow
        arrowPointAtCenter
        content={contentHigh}
        position={'right'}
      >
        <Tag style={{ position: 'absolute', right: 180, top: 20 }}>right to leftTop</Tag>
      </Tooltip>
      <Tooltip
        showArrow
        arrowPointAtCenter
        content={contentHigh}
        position={'right'}
      >
        <Tag style={{ position: 'absolute', right: 180, bottom: 20 }}>right to leftBottom</Tag>
      </Tooltip>
      <Tooltip
        showArrow
        arrowPointAtCenter
        content={contentHigh}
        position={'rightTop'}
      >
        <Tag style={{ position: 'absolute', right: 180, bottom: 50 }}>right to leftBottom</Tag>
      </Tooltip>
    </div>
  );
}

export const marginDemo = () => {
  const [visible, setVisible] = useState(false);
  const change = () => {
    setVisible(!visible);
  };
  return (
    <>
      <Button onClick={change}>Open SideSheet</Button>
      <SideSheet title="滑动侧边栏" visible={visible} onCancel={change}>
        <div style={{ height: '800px', overflow: 'scroll' }}>
          <div
            id='test'
            style={{
              height: '880px',
              display: 'flex',
              flexDirection: 'column-reverse',
              position: 'relative'
            }}
          >
            <Tooltip
              getPopupContainer={() => document.querySelector('#test')}
              content='cecece'
              position='bottom'
              margin={{ marginTop: 0, marginLeft: 0, marginBottom: 36, marginRight: 0 }}
            >
              <div style={{ marginBottom: 20 }}>
                test
              </div>
            </Tooltip>
          </div>
        </div>
        <footer style={{
          position: 'sticky',
          bottom: 0,
          height: 36,
          border: '1px solid pink'
        }}>
          i am footer
        </footer>
      </SideSheet>
    </>
  );
};

export const SmartPosAdjustDemo = () => {
  const [pos, setPosition] = useState('top');
  const onChange = (e) => {
    setPosition(e.target.value);
  };
  return (
    <div style={{ width: 800, height: 800 }}>
      <Popover 
        position={pos}
        showArrow={true}
        content={
          <div style={{ minWidth: 900, height: 900, backgroundColor: 'lightblue' }}>
            <article>
              <p>hi semi! hi semi! hi semi!hi semi! hi semi</p>
              <p>hi semi! hi semi! hi semi!hi semi! hi semi</p>
              <p>hi semi! hi semi! hi semi!</p>
            </article>
          </div>
        }
      >
        <Tag style={{ marginLeft: 450, marginTop: 550 }}>悬停此处</Tag>
      </Popover>
      <div style={{ marginLeft: 250, width: 300 }}>
        <RadioGroup onChange={onChange} value={pos} aria-label="position" name="position">
          <Radio value={'topLeft'}>TL </Radio>
          <Radio value={'top'}>top </Radio>
          <Radio value={'topRight'}>TR </Radio>
          <Radio value={'bottomLeft'}>BL</Radio>
          <Radio value={'bottom'}>Bottom</Radio>
          <Radio value={'bottomRight'}>BR</Radio>
          <Radio value={'leftTop'}>LT</Radio>
          <Radio value={'left'}>Left</Radio>
          <Radio value={'leftBottom'}>LB</Radio>
          <Radio value={'rightTop'}>RT</Radio>
          <Radio value={'right'}>Right</Radio>
          <Radio value={'rightBottom'}>RB</Radio>
        </RadioGroup>
      </div>
    </div>
  )
}

export const OcclusionDemo = () => {
  return (
  <div>
    <Tooltip
      position='left'
      content={
        <div
          style={{
            width: 520,
            height: 360
          }}
        >
          我的上侧被遮挡啦！但是我可以正常显示！ 我的上侧被遮挡啦！但是我可以正常显示！我的上侧被遮挡啦！但是我可以正常显示！
        </div>
      }
    >
      <div
        style={{
          position: "absolute",
          top: -120,
          width: 150,
          height: 200,
          backgroundColor: "lightBlue",
        }}
      >
        我的上侧被遮挡啦！我的上侧被遮挡啦！我的上侧被遮挡啦！我的上侧被遮挡啦！我的上侧被遮挡啦！我的上侧被遮挡啦！我的上侧被遮挡啦！我的上侧被遮挡啦！我的上侧被遮挡啦！
      </div>
    </Tooltip>
      <Tooltip
      content={
        <div
          style={{
            width: 520,
            height: 360
          }}
        >
          我的右侧被遮挡啦！但是我可以正常显示！ 我的右侧被遮挡啦！但是我可以正常显示！ 我的右侧被遮挡啦！但是我可以正常显示！
        </div>
      }
    >
      <div
        style={{
          position: "absolute",
          right: -120,
          width: 150,
          height: 20,
          lineHeight: "20px",
          backgroundColor: "lightBlue",
        }}
      >
        我的右侧被遮挡啦！
      </div>
    </Tooltip>
  </div>
  );
}

export const Fix1449 = () =>{
  return <div style={{ width: "100%", overflow: "hidden" }}>
      <div style={{ position: "relative", height: 200 }}>
        <Select
          placeholder=""
          style={{ width: 400, left: 500, position: "absolute" }}
          filter
          position='bottomLeft'
          autoAdjustOverflow
        >
          <Select.Option value="abc">抖音</Select.Option>
          <Select.Option value="ulikecam">轻颜相机</Select.Option>
          <Select.Option value="jianying" disabled>
            剪映
          </Select.Option>
          <Select.Option value="xigua">西瓜视频</Select.Option>
        </Select>
      </div>
      <div style={{ position: "relative", height: 100 }}>
      <Tooltip 
        visible
        position='topLeft'
        content={
          <div >
            贴右显示
          </div>
        }>
        <Button style={{ width: 200, left: 700, top: 50, position: "absolute" }}>
          缩小视口以遮挡我的右侧
        </Button>
      </Tooltip>
    </div>
    </div>
}

// right -> other
export const AutoRight2LeftDemo = () => <Right2Left />;
AutoRight2LeftDemo.storyName = `✅ auto : right -> left`;

export const AutoRight2LeftBottomDemo = () => <Right2LeftBottom />;
AutoRight2LeftBottomDemo.storyName = `✅ auto : right -> leftBottom`;

export const AutoRight2LeftTopDemo = () => <Right2LeftTop />;
AutoRight2LeftTopDemo.storyName = `✅ auto : riht -> leftTop`;

export const AutoRight2RightBottomDemo = () => <Right2RightBottom />;
AutoRight2RightBottomDemo.storyName = `✅ auto : right -> rightBottom`;

export const AutoRight2RightTopDemo = () => <Right2RightTop />;
AutoRight2RightTopDemo.storyName = `✅ auto : riht -> rightTop`;


// left -> other
export const Left2RightDemo = () => <Left2Right />;
Left2RightDemo.storyName = `✅ auto : left -> right`;

export const Left2LeftBottomDemo = () => <Left2LeftBottom />;
Left2LeftBottomDemo.storyName = `✅ auto : left -> leftBottom`;

export const Left2LeftTopDemo = () => <Left2LeftTop />;
Left2LeftTopDemo.storyName = `✅ auto : left -> leftTop`;

export const Left2RightBottomDemo = () => <Left2RightBottom />;
Left2RightBottomDemo.storyName = `✅ auto : left -> rightBottom`;

export const Left2RightTopDemo = () => <Left2RightTop />;
Left2RightTopDemo.storyName = `✅ auto : left -> rightTop`;

// top -> other
export const Top2BottomDemo = () => <Top2Bottom />;
Top2BottomDemo.storyName = `✅ auto : top -> bottom`;

export const Top2BottomLeftDemo = () => <Top2BottomLeft />;
Top2BottomLeftDemo.storyName = `✅ auto : top -> bottomLeft`;

export const Top2BottomRightDemo = () => <Top2BottomRight />;
Top2BottomRightDemo.storyName = `✅ auto : top -> bottomRight`;

export const Top2TopLeftDemo = () => <Top2TopLeft />;
Top2TopLeftDemo.storyName = `✅ auto : top -> topLeft`;

export const Top2TopRightDemo = () => <Top2TopRight />;
Top2TopRightDemo.storyName = `✅ auto : top -> topRight`;


// bottom -> other
export const Bottom2TopDemo = () => <Bottom2Top />;
Bottom2TopDemo.storyName = `✅ auto : bottom -> top`;

export const Bottom2TopLeftDemo = () => <Bottom2TopLeft />;
Bottom2TopLeftDemo.storyName = `✅ auto : bottom -> topLeft`;

export const Bottom2TopRightDemo = () => <Bottom2TopRight />;
Bottom2TopRightDemo.storyName = `✅ auto : bottom -> topRight`;

export const Bottom2BottomLeftDemo = () => <Bottom2BottomLeft />;
Bottom2BottomLeftDemo.storyName = `✅ auto : bottom -> bottomLeft`;

export const Bottom2BottomRightDemo = () => <Bottom2BottomRight />;
Bottom2BottomRightDemo.storyName = `✅ auto : bottom -> bottomRight`;


export const Fix1557 = () =>{
   return (
      <Dropdown
          trigger='hover'
          disableFocusListener
          render={
              <Dropdown.Menu>
                  <Popconfirm
                    content={
                        <>
                        <Select filter/>
                        </>
                    }
                  >
                      <Button>点我后再点击select, Dropdown 面板不收起</Button>
                  </Popconfirm>
              </Dropdown.Menu>
          }
      >
          <Tag>Hover Me</Tag>
      </Dropdown>
  );
}

export const wordBreak = () => {
  const gapElement = (gap=200) => <div style={{ marginTop: gap }}></div>;

  const tooltipShowProps = { 
    trigger: "custom",  
    visible: true ,
    // showArrow: false
  };

  const testContent = {
    '长hash': 'ide2d3a4e9d7b7d93fc4c3b8e4b1b4b08e4f5a9f13ed8b8d6f7c5b7c4c7e4b9e6b9e6e5d4e4c5f6e3b1e7b3a3e3e5c5f4e9c8',
    'url测试': 'https://semi.design/zh-CN/show/tooltip#%E4%BB%85%E5%BD%93%E5%86%85%E5%AE%B9%E5%AE%BD%E5%BA%A6%E8%B6%85%E5%87%BA%E6%97%B6%E5%B1%95%E7%A4%BA%20Tooltip',
    '中文测试': '中文测试中文测试中文测试中文测试中文测试中文测试中文测试中文测试中文测试中文测试中文测试中文测试',
    // 以下为英文中最长的单词
    '英文测试': 'pneumonoultramicroscopicsilicovolcanoconiosis',
    '日语测试': '超音波検査による胸部エコー検査結果、心拍数や脈波などの検査結果から、緊急性はないものの肺炎の可能性があるため、抗生物質の処方箋を出します。',
    '韩语测试': '인공지능과 빅데이터 기술을 활용한 자율주행 자동차의 개발은 현재 국내외에서 많은 관심을 받고 있습니다.',
    '泰语测试': 'เทคโนโลยีการผลิตอาหารและสารสกัดจากพืชชนิดต่าง ๆ กำลังเป็นที่สนใจในวงการอาหารทั่วโลก',
    '阿拉伯语测试': 'تطور التكنولوجيا والذكاء الاصطناعي يؤثر بشكل كبير على صناعة العمليات الإنتاجية ونمط الحياة الحديثة.',
    '越南语': 'Ứng dụng công nghệ thông tin và trí tuệ nhân tạo đang ngày càng được sử dụng rộng rãi trong lĩnh vực sản xuất và dịch vụ. không-gian-phi-trụ-điện-từ',
    '俄罗斯语': 'Разработка новейших технологий искусственного интеллекта и машинного обучения становится все более важной в наши дни.',
    '印尼语': 'Pemanfaatan teknologi informasi dan kecerdasan buatan semakin penting dalam industri modern.',
    '马来语': 'Penggunaan teknologi maklumat dan kecerdasan buatan semakin penting dalam industri moden.',
    '泰语': 'บริการจัดส่งสินค้าทางไปรษณีย์ภายในประเทศไทยมีความสะดวกสบายและรวดเร็วมากยิ่งขึ้นด้วยการใช้เทคโนโลยีที่ทันสมัยในการติดตามสถานะและการจัดส่งสินค้า นอกจากนี้ยังมีการให้บริการเพิ่มเติมอย่างต่างๆ เช่น การจัดส่งพิเศษ การรับส่งเอกสาร การจัดส่งด่วน เป็นต้น',
    '土耳其语': "Otomobil endüstrisi, Türkiye'nin en önemli sanayi kollarından biridir. Türkiye, yılda yaklaşık 1 milyon adet otomobil üretimiyle Avrupa'nın önde gelen üreticileri arasındadır.",
    '葡萄牙语': "A eletricidade é uma fonte de energia renovável e limpa, que é produzida a partir de fontes como a energia solar, eólica, hidroelétrica e geotérmica.",
    '西班牙语': "La biotecnología es una rama de la ciencia que utiliza organismos vivos o partes de ellos para desarrollar productos y servicios que mejoren la calidad de vida.",
    '意大利语': "L'ingegneria genetica è una branca della biologia molecolare che si occupa di manipolare il DNA per creare organismi con caratteristiche specifiche.",
    '法语': 'La pharmacologie est la science qui étudie les effets des médicaments sur les êtres vivants et leur utilisation pour la prévention, le diagnostic et le traitement des maladies.',
    '德语': 'Die Kernenergie ist eine umstrittene Energiequelle, die durch die Nutzung der Energie aus Atomkernen Strom erzeugt.',
    '罗马尼亚语': 'Ingineria software este o ramură a informaticii care se ocupă cu dezvoltarea de programe și aplicații software.',
    '瑞典语': 'Neurovetenskap är studiet av nervsystemet och dess funktioner, inklusive dess relationer till beteende och kognition.',
    '波兰语': 'Archeologia jest nauką humanistyczną zajmującą się badaniem śladów pozostawionych przez człowieka w przeszłości.',
    '荷兰语': 'Psychologie is de wetenschappelijke studie van het menselijk gedrag en de processen die daaraan ten grondslag liggen.',
  };

  const longWordContent = {
    '英文测试': "pneumonoultramicroscopicsilicovolcanoconiosis",
    '泰语测试': "หน้าต่างจอภาพ",
    '阿拉伯语测试': "أفاستسقيناكموها",
    '越南语': "bấtđồngxứngđáng",
    '俄罗斯语': "человеконенавистничество",
    '印尼语': "melipatgandakan",
    '马来语': "pengangkutan",
    '土耳其语': "çekoslovakyalılaştıramadıklarımızdanmışsınızcasına",
    '葡萄牙语': "otorrinolaringologista",
    '西班牙语': "electroencefalografista",
    '意大利语': "precipitevolissimevolmente",
    '法语': "anticonstitutionnellement ",
    '德语': "Donaudampfschifffahrtsgesellschaftskapitän",
    '罗马尼亚语': "neîncorporabile",
    '瑞典语': "realisationsvinstbeskattning",
    '波兰语': "najedźcieżżebrzącychświniątkach",
    '荷兰语': "Kindercarnavalsoptochtvoorbereidingswerkzaamheden"
  }

  return (
  <>
    {['bottom','top'].map((item, index) => {
      return <div key={`${index}`}>
        <Tooltip {...tooltipShowProps} content={'中'} position={item}>
          <span style={{ marginRight: 10 }}>中文测试</span>
        </Tooltip>
        <Tooltip {...tooltipShowProps} content={'-'} position={item}>
          <span style={{ marginRight: 10 }}>高度测试</span>
        </Tooltip>
        <Tooltip showArrow={false} {...tooltipShowProps} content={'中'} position={item} >
          <span style={{ marginRight: 10 }}>中文无 arrow 测试</span>
        </Tooltip>
        <Tooltip showArrow={false} {...tooltipShowProps} content={'t'} position={item}>
          <span style={{ marginRight: 10 }}>英文无 arrow 测试</span>
        </Tooltip>
        {gapElement(100)}
      </div>
    })}
    <p style={{ marginTop: 50 }}>以下为 word-wrap: break-word <strong>VS</strong> word-wrap: normal </p>
    {Object.entries(testContent).map((item, index) => {
      const [key, value] = item;
      return <div key={`${index}`}>
        {gapElement(200)}
        <Tooltip {...tooltipShowProps} content={value} position={'top'}>
        {`${key}`}
        </Tooltip>
        <Tooltip {...tooltipShowProps} content={value} position={'top'} style={{ wordWrap: 'normal' }}>
          <span style={{ marginLeft: 350 }}>{`${key}`}</span>
        </Tooltip>
      </div>
    })}
    {Object.entries(longWordContent).map((item, index) => {
      const [key, value] = item;
      return <div key={`${index}`}>
        {gapElement(100)}
        <Tooltip {...tooltipShowProps} content={value} position={'top'} style={{ width: 50 }}>
        {`${key}`}
        </Tooltip>
        <Tooltip {...tooltipShowProps} content={value} position={'top'} style={{ wordWrap: 'normal', width: 50 }}>
          <span style={{ marginLeft: 350 }}>{`${key}`}</span>
        </Tooltip>
      </div>
    })}
  </>
  );
}


export const TooltipAllAddSpacing = () => (
  <div className="demo">
    <ScrollDemo spacing={{ x: 16, y: 16}} />
    <div
      style={{
        padding: 120,
      }}
    >
      <ScrollDemo
        showArrow={false}
        spacing={{ x: 16, y: 16}}
      />
    </div>
  </div>
);

TooltipAllAddSpacing.story = {
  name: 'tooltip All Add Spacing',
};
export const ViewportPrioritJudgment = () => {
  // If the viewport reverse space is sufficient, the viewport result shall prevail
  return (
    <div style={{ height: '1000px' }}>
      <Tooltip content={"hi bytedance"} position='top'>
        <Button theme="solid" type="tertiary" style={{ marginBottom: 20, marginTop: 200 }}>
          悬停显示
        </Button>
      </Tooltip>
    </div>
  )
}
