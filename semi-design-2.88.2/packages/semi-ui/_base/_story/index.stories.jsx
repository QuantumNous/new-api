import React, { useMemo } from 'react';
import {Button, Typography, Card, Tooltip, Tag, Avatar, Rating, Nav, Layout, ConfigProvider, Select} from '../../index';
import { IconHelpCircle, IconUser, IconStar, IconSetting } from '@douyinfe/semi-icons';
import './index.scss';
import semiGlobal from "../../_utils/semi-global";

export default {
  title: 'Base',
};

export { default as SemiA11y } from './a11y';

export const TestAlwaysDarkLight = () => {
  function Demo() {
    const { Text } = Typography;
    const { Header, Footer, Sider, Content } = Layout;

    const switchMode = () => {
      const body = document.body;
      if (body.hasAttribute('theme-mode')) {
        body.removeAttribute('theme-mode');
        // 通知官网更新当前模式，下同
        // window.setMode("light");
      } else {
        body.setAttribute('theme-mode', 'dark');
        // window.setMode("dark");
      }
    };
    const opts = {
      content: 'Hi, Bytedance dance dance',
      duration: 3,
    };

    const blocks = title => (
      <Layout>
        <Header style={{ height: 60 }}>Header</Header>
        <Layout style={{ height: 'calc(100vh - 260px)' }}>
          <Sider style={{ background: 'var(--semi-color-white)' }}>
            <div class="semi-always-light">
              <Nav
                style={{ background: 'var(--semi-color-white)' }}
                // bodyStyle={{ height: '100%' }}
                items={[
                  { itemKey: 'user', text: '用户管理', icon: <IconUser /> },
                  { itemKey: 'union', text: '公会中心', icon: <IconStar /> },
                  {
                    text: '任务平台',
                    icon: <IconSetting />,
                    itemKey: 'job',
                    items: ['任务管理', '用户任务查询'],
                  },
                ]}
                onSelect={data => console.log('trigger onSelect: ', data)}
                onClick={data => console.log('trigger onClick: ', data)}
              />
            </div>
          </Sider>
          <Content>
            <Card
              title={`Semi Design ${title}`}
              style={{ maxWidth: 360, marginRight: 12 }}
              headerExtraContent={<Text link>更多</Text>}
            >
              Semi Design 是由抖音前端团队与 UED
              团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
              Web 应用。
              <Tooltip content={'hi bytedance'}>
                <IconHelpCircle />
              </Tooltip>
            </Card>
            <div>
              <div>
                <Avatar style={{ margin: 4 }}>AS</Avatar>
                <Avatar color="red" style={{ margin: 4 }}>
                  BM
                </Avatar>
                <Avatar color="light-blue" style={{ margin: 4 }}>
                  TJ
                </Avatar>
                <Avatar style={{ color: '#f56a00', backgroundColor: '#fde3cf', margin: 4 }}>
                  ZL
                </Avatar>
                <Avatar style={{ backgroundColor: '#87d068', margin: 4 }}>YZ</Avatar>
              </div>
              <Tag> default tag </Tag>
              <Rating defaultValue={5} />
            </div>
          </Content>
        </Layout>
        <Footer
          style={{
            height: 200,
            background: 'var(--semi-color-black)',
            color: 'var(--semi-color-white)',
          }}
        >
          Footer
        </Footer>
      </Layout>
    );

    return (
      <div className="container">
        <div>
          <Button onClick={switchMode}>Switch Mode</Button>
        </div>
        <div>
          <div>{blocks('default')}</div>
          {/* <div id="semi-always-dark">{blocks('always dark')}</div>
                    <div id="semi-always-light">{blocks('always light')}</div> */}
        </div>
      </div>
    );
  }

  return <Demo />;
};



semiGlobal.config.overrideDefaultProps = {
    Button: {
        type: 'warning',
    },
    Select: {
        zIndex: 2000,
        // getPopupContainer: () => document.querySelector('#popupContainer')
    },
    Tooltip: {
        zIndex: 2001,
        // getPopupContainer: () => document.querySelector('#popupContainer'),
        trigger:"click"
    },
};

export const DefaultPropsDemo = () => {
    return (
        <div>
            <ConfigProvider>
                <div style={{ position: 'relative'}} id='popupContainer'></div>
                <Tooltip content="zindex 2001">
                    <Button>test</Button>
                </Tooltip>
                <Select
                    optionList={[
                        { value: 1, label: 1 },
                        { value: 2, label: 2 },
                    ]}
                ></Select>
            </ConfigProvider>
        </div>
    );
};
