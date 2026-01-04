import React from 'react';

import Nav from '..';
import Switch from '../../switch';
import AutoOpenDemo from './AutoOpen';
import ControlledSelectedKeys from './ControlledSelectedKeys';
import LinkNavDemo from './LinkNav';
import MountUnmount from './MountUnmount';
import WithRouter from './WithRouter';
import WithChildren from './WithChildren';
import ItemsChange from './ItemsChange';
import DisabledNav from './DisabledNav';
import Button from '../../button';
import GetPopupNav from './Popup';
import CustomArrowIcon from './CustomIcon';
import FixedSelectedKeys from './FixedSelectedKeys';
import FixedOpenKeys from './FixedOpenKeys';
import NumberItemKey from './NumberItemKey';

import {
  IconMail,
  IconFolder,
  IconGift,
  IconList,
  IconFlag,
  IconStar,
  IconCloud,
  IconEdit,
  IconFile,
  IconCamera,
  IconArticle,
  IconUser,
  IconAscend,
  IconDescend,
  IconSetting,
  IconUserGroup,
} from '@douyinfe/semi-icons';

export default {
  title: 'Navigation'
}

export {
  FixedSelectedKeys,
  FixedOpenKeys,
  NumberItemKey
}

export const Default = () => {
  return (
    <div style={{ height: '100vh', display: 'inline-block' }}>
      <Nav onSelect={(...args) => console.log(...args)}>
        <Nav.Item itemKey={'1'} text={'Option 1'} icon={<IconMail />} />
        <Nav.Sub text={'Group 2'} icon={<IconFolder />} stayWhenClick={true} itemKey={'2'}>
          {['2-1', '2-2'].map(k => (
            <Nav.Item key={k} itemKey={String(k)} text={'Option ' + k} />
          ))}
          <Nav.Item itemKey={'2-3'} text={'Option 2-3'} />
          <Nav.Sub text={'Group 2-4'} itemKey={'2-4'}>
            <Nav.Item itemKey={'2-4-1'} text={'Option 2-3-1'} />
            <Nav.Item itemKey={'2-4-2'} text={'Option 2-3-2'} />
          </Nav.Sub>
        </Nav.Sub>
        <Nav.Item key={3} itemKey={'3'} text={'Option 3'} icon={<IconGift />} />
        <Nav.Item key={4} itemKey={'4'} text={'Option 4'} icon={<IconList />} />
        <Nav.Sub text={'Group 5'} icon={<IconFlag />} stayWhenClick={true} itemKey={'5'}>
          {['5-1', '5-2'].map(k => (
            <Nav.Item key={k} itemKey={String(k)} text={'Option ' + k} />
          ))}
        </Nav.Sub>
        <Nav.Item itemKey={'6'} text={'Option 6 (with link)'} icon={<IconStar />} link="/?path=/story/navigation--collapse-expand" linkOptions={{target: '_blank'}}/>
        <Nav.Sub text={'Group 7'} icon={<IconFolder />} stayWhenClick={true} itemKey={'7'}>
          {['7-1', '7-2'].map(k => (
            <Nav.Item
              key={k}
              itemKey={String(k)}
              text={'Option ' + k + ' (with link)'}
              link={`/?path=/story/navigation--collapse-expand`}
            />
          ))}
          <Nav.Item itemKey={'7-3'} text={'Option 7-3'} />
        </Nav.Sub>
      </Nav>
    </div>
  );
};

Default.story = {
  name: 'default',
};

class NavApp extends React.Component {
  state = {
    isCollapsed: true,
  };

  updateCollapsed = isCollapsed => {
    this.setState({ isCollapsed });
  };

  render() {
    let { isCollapsed } = this.state;
    return (
      <div style={{ height: '100vh', display: 'inline-block' }}>
        <div>
          {'收起到左侧'}
          <Switch defaultChecked={isCollapsed} onChange={v => this.updateCollapsed(v)} />
        </div>
        <Nav isCollapsed={isCollapsed}>
          <Nav.Item itemKey={'1'} text={'Option 1'} icon={<IconCloud />} />
          <Nav.Sub text={'Group 2'} icon={<IconEdit />} stayWhenClick={true}>
            {['2-1', '2-2'].map(k => (
              <Nav.Item key={k} itemKey={String(k)} text={'Option ' + k} />
            ))}
            <Nav.Sub text={'Group 2-3'} icon={<IconFile />}>
              <Nav.Item itemKey={'2-3-1'} text={'Option 2-3-1'} />
              <Nav.Item itemKey={'2-3-2'} text={'Option 2-3-2'} />
            </Nav.Sub>
          </Nav.Sub>
          <Nav.Item key={3} itemKey={'3'} text={'Option 3'} icon={<IconCamera />} />
          <Nav.Item key={4} itemKey={'4'} text={'Option 4'} icon={<IconArticle />} />
          <Nav.Sub text={'Group 5'} stayWhenClick={true} icon={<IconFolder />} dropdownProps={{ spacing: 20 }}>
            {['5-1', '5-2'].map(k => (
              <Nav.Item key={k} itemKey={String(k)} text={'Option ' + k} />
            ))}
          </Nav.Sub>
        </Nav>
      </div>
    );
  }
}

export const CollapseExpand = () => <NavApp />;

CollapseExpand.story = {
  name: 'collapse/expand',
};

export const ConfigItems = () => (
  <div style={{ border: '1px solid black', height: '100vh', display: 'inline-block' }}>
    <Nav
      items={[
        { itemKey: 'user', text: '用户管理', icon: <IconUser />, link: '/user' },
        { itemKey: 'union', text: '公会中心', icon: <IconUser />, link: '/star' },
        {
          text: '任务平台',
          icon: <IconSetting />,
          itemKey: 'job',
          items: ['任务管理', '用户任务查询'],
        },
      ]}
      onSelect={key => console.log(key)}
    />
  </div>
);

ConfigItems.story = {
  name: 'config items',
};

export const Horizontal = () => (
  <div>
    <Nav
      mode="horizontal"
      items={[
        '1',
        { itemKey: '2', text: 'Option 2 Option 2 Option 2 Option 2', icon: <IconCamera /> },
        {
          text: 'Group 3',
          itemKey: '3',
          icon: <IconFile />,
          items: ['3-1', {text: '3-2',  link: `/?path=/story/navigation--collapse-expand`}, { text: 'Group 3-3', items: ['3-3-1', '3-3-2'] }],
        },
      ]}
      onSelect={key => console.log(key)}
      subDropdownProps={{
        clickToHide: true,
        spacing: 12
      }}
    />
  </div>
);

Horizontal.story = {
  name: 'horizontal',
};

class Demo extends React.Component {
  constructor() {
    super();
    this.state = {
      isCollapsed: false,
      defaultOpenKeys: ['2', '2-3'],
      mode: 'vertical',
      navHeight: '100vh',
    };
  }

  updateCollapsed(isCollapsed) {
    this.setState({ isCollapsed });
  }

  render() {
    let { isCollapsed, defaultOpenKeys, mode, navHeight } = this.state;
    let logo = '//lf1-cdn-tos.bytescm.com/obj/ttfe/ies/semi/logo_huoshan.png';
    let testIcon = '//lf1-cdn-tos.bytescm.com/obj/mosaic-legacy/da9d0015af0f09667998';
    let vigoIcon = '//lf1-cdn-tos.bytescm.com/obj/mosaic-legacy/504100070cbe0498d66f';
    return (
      <div>
        <Nav
          isCollapsed={isCollapsed}
          defaultOpenKeys={defaultOpenKeys}
          style={{ height: navHeight }}
          mode={mode}
        >
          <Nav.Header logo={<img src={logo} />} text="互娱运营" />
          <Nav.Item
            itemKey={'1'}
            text={<strong>火山运营</strong>}
            icon={<img width="20" height="20" src={vigoIcon} />}
          />
          <Nav.Sub
            itemKey={'2'}
            text={<span>抖音运营</span>}
            icon={<img width="20" height="20" src={testIcon} />}
            stayWhenClick={true}
          >
            {['2-1', '2-2'].map(k => (
              <Nav.Item key={k} itemKey={String(k)} text={'Option ' + k} />
            ))}
          </Nav.Sub>
          <Nav.Footer>
            <Button
              title="展开/收起切换"
              icon={isCollapsed ? <IconAscend /> : <IconDescend />}
              onClick={() => this.updateCollapsed(!isCollapsed)}
            />
          </Nav.Footer>
        </Nav>
      </div>
    );
  }
}
export const ExpandCollapseWithLogo = () => <Demo />;

ExpandCollapseWithLogo.story = {
  name: 'expand collapse with logo',
};

class HorizontalDemo extends React.Component {
  render() {
    return (
      <div style={{ width: '100%' }}>
        <Nav
          bodyStyle={{ height: 320 }}
          items={[
            { itemKey: 'user', text: '用户管理', icon: <IconUser /> },
            { itemKey: 'union', text: '公会中心', icon: <IconStar /> },
            {
              itemKey: 'union-management',
              text: '公会管理',
              icon: <IconUserGroup />,
              items: ['公告设置', '公会查询', '信息录入'],
            },
            {
              itemKey: 'approve-management',
              text: '审批管理',
              icon: <IconEdit />,
              items: [
                '入驻审核',
                {
                  itemKey: 'operation-management',
                  text: '运营管理',
                  items: ['人员管理', '人员变更'],
                },
              ],
            },
            {
              text: '任务平台',
              icon: <IconSetting />,
              itemKey: 'job',
              items: ['任务管理', '用户任务查询'],
            },
          ]}
          onSelect={key => console.log(key)}
          header={{
            logo: (
              <img src="https://sf6-cdn-tos.douyinstatic.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/webcast_logo.svg" />
            ),
            text: 'Semi 运营后台',
          }}
          footer={{
            collapseButton: true,
          }}
        />
      </div>
    );
  }
}
export const HorizontalWithLogo = () => <HorizontalDemo />;

HorizontalWithLogo.story = {
  name: 'horizontal with logo',
};

export const AutoOpen = () => <AutoOpenDemo />;

AutoOpen.story = {
  name: 'auto open',
};

export const LinkNav = () => <LinkNavDemo />;
LinkNav.story = {
  name: 'link nav',
}

export const MountUnmountDemo = () => <MountUnmount />;
MountUnmountDemo.story = {
  name: 'mount unmount'
}

export const ControlledSelectedKeysDemo = () => <ControlledSelectedKeys />;
ControlledSelectedKeysDemo.story = {
  name: 'controlled selected keys'
};

export const WithRouterDemo = () => <WithRouter />;
WithRouter.story = {
  name: 'with router'
};

export const WithChildrenDemo = () => <WithChildren />;
WithChildrenDemo.story = {
  name: 'with children'
}

export const ItemsChangeDemo = () => <ItemsChange />;
ItemsChangeDemo.story = {
  name: 'nav cannot set item to 0 dynamically'
};

export const DisabledNavDemo = () => <DisabledNav />;
DisabledNavDemo.story = {
  name: 'disabled nav'
}

export const PopupDemo = () => <GetPopupNav />;
PopupDemo.story = {
  name: 'getPopupContainer'
}

export const CustomArrowIconDemo = () => <CustomArrowIcon></CustomArrowIcon>
CustomArrowIconDemo.story = {
  name: 'CustomArrowIcon'
}


class DisabledSub extends React.Component {
    render() {
        return (
            <Nav
                style={{ height: 520 }}
                bodyStyle={{ height: 300 }}
                items={[
                    {
                        text: '任务平台',
                        itemKey: '1',
                        icon: <IconMail />,
                        items: [{
                            text: '任务平台1',
                            disabled: true,
                            itemKey: '11',
                            items: ['任务1管理', '用户2任务查询'],
                        }, {
                            text: '任务平台2',
                            disabled: true,
                            itemKey: '12',
                            items: ['任务11管理', '用户22任务查询'],
                        }],
                    },
                ]}
                onSelect={key => console.log(key)}
                footer={{
                    collapseButton: true,
                }}
            />
        );
    }
}

export const DisabledSubDemo = () => <DisabledSub></DisabledSub>
DisabledSubDemo.story = {
  name: 'DisabledSubDemo'
}


export const renderWrapperDemo = () => {
  return (
    <Nav
            renderWrapper={({ itemElement, isSubNav, isInSubNav, props }) => {
                const routerMap = {
                    Home: "/",
                    About: "/about",
                    Dashboard: "/dashboard",
                    "Nothing Here": "/nothing-here"
                };
                return (
                    <a
                        style={{ textDecoration: "none" }}
                        to={routerMap[props.itemKey]}
                    >
                      {itemElement}
                    </a>
                );
            }}
            items={[
                { itemKey: "Home", text: "Home" },
                { itemKey: "About", text: "About" },
                {
                    text: "Disabled",
                    itemKey: "Disabled",
                    disabled: true,
                    items: ["Dashboard", "Nothing Here"]
                },
                {
                  text: "Sub",
                  itemKey: "Sub",
                  items: [{ itemKey: "Dashboard", text: "Dashboard", items: ["Dashboard1", "Nothing Here1"] }, "Nothing Here"]
              }
            ]}
    ></Nav>
  )
}