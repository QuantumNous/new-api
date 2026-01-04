import React from 'react';

import { Layout } from '../index';
import Nav from '../../navigation';
import { Button } from '../../index';
import {
  IconBytedanceLogo,
  IconVigoLogo,
  IconDescend,
  IconList,
  IconEdit,
  IconCamera,
  IconFile,
  IconGlobe,
} from '@douyinfe/semi-icons';

export default {
  title: 'Layout'
}

const { Header, Footer, Sider, Content } = Layout;
const style = {
  textAlign: 'center',
  margin: 60,
};
const contentStyle = {
  height: 300,
  backgroundColor: '#ddd',
};
const siderStyle = {
  width: 100,
  backgroundColor: '#ccc',
};
const headerStyle = {
  height: 64,
  paddingLeft: 50,
  paddingRight: 50,
  color: '#333',
  background: '#f0f2f5',
};
const footerStyle = {
  height: 64,
  paddingLeft: 50,
  paddingRight: 50,
  color: '#333',
  background: '#f0f2f5',
};

export const LayoutDefault = () => (
  <div>
    <Layout style={style}>
      <Header style={headerStyle}>Header</Header>
      <Content style={contentStyle}>Content</Content>
      <Footer style={footerStyle}>Footer</Footer>
    </Layout>

    <Layout style={style}>
      <Header style={headerStyle}>Header</Header>
      <Layout>
        <Sider style={siderStyle}>Sider</Sider>
        <Content style={contentStyle}>Content</Content>
      </Layout>
      <Footer style={footerStyle}>Footer</Footer>
    </Layout>

    <Layout style={style}>
      <Header style={headerStyle}>Header</Header>
      <Layout>
        <Content style={contentStyle}>Content</Content>
        <Sider style={siderStyle}>Sider</Sider>
      </Layout>
      <Footer style={footerStyle}>Footer</Footer>
    </Layout>

    <Layout style={style}>
      <Sider style={siderStyle}>Sider</Sider>
      <Layout>
        <Header style={headerStyle}>Header</Header>
        <Content style={contentStyle}>Content</Content>
        <Footer style={footerStyle}>Footer</Footer>
      </Layout>
    </Layout>
  </div>
);

LayoutDefault.story = {
  name: 'Layout default',
};

export const LayoutDemo = () => (
  <div>
    <Layout style={style}>
      <Sider>
        <Nav
          style={{
            width: 200,
          }}
          items={[
            {
              itemKey: '1',
              text: 'Option 1',
              icon: <IconEdit />,
            },
            {
              itemKey: '2',
              text: 'Option 2',
              icon: <IconCamera />,
            },
            {
              text: 'Group 3',
              icon: <IconFile />,
              itemKey: '3',
              items: ['3-1', '3-2'],
            },
            {
              text: 'Group 4',
              icon: <IconGlobe />,
              itemKey: '4',
              items: ['4-1', '4-2'],
            },
          ]}
        />
      </Sider>
      <Layout>
        <Header style={headerStyle}>Header</Header>
        <Content style={contentStyle}>Content</Content>
        <Footer style={footerStyle}>Footer</Footer>
      </Layout>
    </Layout>
  </div>
);

LayoutDemo.story = {
  name: 'Layout demo',
};

class NavApp extends React.Component {
  constructor() {
    super();
    this.state = {
      isCollapsed: true,
      defaultOpenKeys: [],
      mode: 'vertical',
      navHeight: 480,
      selectedKeys: [],
      openKeys: [],
    };

    this.onSelect = (data = {}) => {
      console.log('trigger onSelect: ', data);
      let selectedKeys = Array.from(data.selectedKeys);
      this.setState({
        selectedKeys,
      });
    };

    this.onOpenChange = (data = {}) => {
      console.log('trigger onOpenChange: ', data);
      let openKeys = Array.from(data.openKeys);
      this.setState({
        openKeys,
      });
    };
  }

  updateCollapsed(isCollapsed) {
    this.setState({
      isCollapsed,
    });
  }

  toggleMode() {
    let { mode, navHeight } = this.state;

    if (mode === 'vertical') {
      mode = 'horizontal';
      navHeight = 60;
    } else {
      mode = 'vertical';
      navHeight = 480;
    }

    this.setState({
      mode,
      navHeight,
    });
  }

  render() {
    let { isCollapsed, defaultOpenKeys, mode, navHeight, selectedKeys, openKeys } = this.state;
    return (
      <div>
        <Nav
          isCollapsed={isCollapsed}
          defaultOpenKeys={defaultOpenKeys}
          style={{
            height: navHeight,
          }}
          mode={mode}
          selectedKeys={selectedKeys}
          openKeys={openKeys}
          onSelect={this.onSelect}
          onOpenChange={this.onOpenChange}
        >
          <Nav.Header logo={<IconBytedanceLogo size="extra-large" />} text="互娱运营" />
          <Nav.Item itemKey={'1'} text={<strong>火山运营</strong>} icon={<IconVigoLogo />} />
          <Nav.Sub itemKey={'2'} text={<strong>运营</strong>} icon={<IconVigoLogo />}>
            {['2-1', '2-2'].map(k => (
              <Nav.Item key={k} itemKey={String(k)} text={'Option ' + k} />
            ))}
            <Nav.Sub text={'Group 2-3'} icon={<IconDescend />} itemKey="2-3">
              <Nav.Item itemKey={'2-3-1'} text={'Option 2-3-1'} />
              <Nav.Item itemKey={'2-3-2'} text={'Option 2-3-2'} />
            </Nav.Sub>
          </Nav.Sub>
          <Nav.Footer>
            <Button
              title="展开/收起切换"
              icon={<IconList />}
              onClick={() => this.updateCollapsed(!isCollapsed)}
            />
          </Nav.Footer>
        </Nav>
      </div>
    );
  }
}

export const CollapseNavDemo = () => (
  <div>
    <Layout style={style}>
      <Sider>
        <NavApp />
      </Sider>
      <Layout>
        <Header style={headerStyle}>Header</Header>
        <Content style={contentStyle}>Content</Content>
        <Footer style={footerStyle}>Footer</Footer>
      </Layout>
    </Layout>
  </div>
);

CollapseNavDemo.story = {
  name: 'collapse nav demo',
};

class SimpleNav extends React.Component {
  constructor() {
    super();
    this.state = {
      isCollapsed: true,
      mode: 'vertical',
      navHeight: 480,
    };
  }

  updateCollapsed(isCollapsed) {
    this.setState({
      isCollapsed,
    });
  }

  render() {
    let { isCollapsed, mode, navHeight } = this.state;
    return (
      <div>
        <Nav
          isCollapsed={isCollapsed}
          style={{
            height: navHeight,
          }}
          mode={mode}
        >
          <Button icon={<IconList />} onClick={() => this.updateCollapsed(!isCollapsed)}>
            展开/收起切换
          </Button>
        </Nav>
      </div>
    );
  }
}

const onbreakpoint = (screen, bool) => {
  console.log(screen, bool);
};

export const CollapseSimpleNavDemo = () => (
  <div>
    <Layout style={style}>
      <Sider breakpoint={['md']} onBreakpoint={onbreakpoint}>
        <SimpleNav />
      </Sider>
      <Layout>
        <Header style={headerStyle}>Header</Header>
        <Content style={contentStyle}>Content</Content>
        <Footer style={footerStyle}>Footer</Footer>
      </Layout>
    </Layout>
  </div>
);

CollapseSimpleNavDemo.story = {
  name: 'collapse SimpleNav demo',
};
