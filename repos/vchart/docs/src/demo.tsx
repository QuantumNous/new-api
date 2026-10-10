import { Layout, Menu } from '@arco-design/web-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Header } from './header';
import { useContext, useEffect, useState } from 'react';
import { LanguageContext, LanguageEnum } from './i18n';
import menu from '../menu.json';

const MenuItem = Menu.Item;

interface IMenuItem {
  path: string;
  title: { [language: string]: string };
}

interface IOutlineProps {
  menuItems: IMenuItem[];
  assetDirectory: string;
}

interface IContentProps {
  content: string | null;
}

function generateMenuItem(node: IMenuItem, assetDirectory: string, language: LanguageEnum, navigate: any) {
  return (
    <MenuItem
      key={node.path}
      onClick={() => {
        document.getElementById('markdownDocumentContainer')?.scrollTo?.({
          top: 0
          // behavior: 'smooth',
        });
        navigate(`/vchart/${assetDirectory}?path=${node.path}`, { replace: true });
      }}
    >
      {node.title[language]}
    </MenuItem>
  );
}

function Outline(props: IOutlineProps) {
  const { language, setLanguage } = useContext(LanguageContext);

  const navigate = useNavigate();
  const location = useLocation();
  const demoPath = location.search.split('?path=')[1];

  return (
    <div
      className="menu-demo-round"
      style={{
        paddingTop: 20,
        paddingBottom: 20
      }}
    >
      <Menu selectedKeys={[demoPath]}>
        {(props.menuItems ?? []).map((node: any) => generateMenuItem(node, props.assetDirectory, language, navigate))}
      </Menu>
    </div>
  );
}

function Content(props: IContentProps) {
  const location = useLocation();
  const { pathname: pathName } = location;
  const assetDirectory = pathName.split('/')[2];

  return (
    <div className="demo-container" style={{ width: '100%', height: '100%' }}>
      {props.content ? (
        <iframe
          src={`/assets/${assetDirectory}/${props.content}`}
          style={{ width: '100%', height: '100%', border: 'none' }}
        ></iframe>
      ) : null}
    </div>
  );
}

export function Demo() {
  const { language, setLanguage } = useContext(LanguageContext);

  const location = useLocation();
  const { pathname: pathName } = location;
  const assetDirectory = pathName.split('/')[2];

  const [outline, setOutline] = useState<any>([]);
  const [content, setContent] = useState<string | null>(null);

  const [siderWidth, setSiderWidth] = useState<number>(280);

  const handleMoving = (event: any, { width }: any) => {
    setSiderWidth(Math.max(width, 120));
  };

  useEffect(() => {
    const menuItem = menu.find(menuItem => menuItem.menu === assetDirectory);
    setOutline(menuItem?.demos ?? []);
  }, [language, assetDirectory]);

  useEffect(() => {
    const demoPath = location.search.split('?path=')[1];
    setContent(demoPath === '' ? null : demoPath);
  }, [language, pathName, assetDirectory, location.search]);

  return (
    <Layout>
      <Layout.Header>
        <Header />
      </Layout.Header>
      <Layout style={{ marginTop: 48 }}>
        <Layout.Sider
          style={{ height: 'calc(100vh - 48px)', width: siderWidth }}
          resizeBoxProps={{
            directions: ['right'],
            onMoving: handleMoving
          }}
        >
          <Outline menuItems={outline} assetDirectory={assetDirectory} />
        </Layout.Sider>
        <Layout.Content style={{ height: 'calc(100vh - 48px)' }}>
          <Content content={content} />
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
