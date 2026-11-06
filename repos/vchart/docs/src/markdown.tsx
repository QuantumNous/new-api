import { Layout, Menu } from '@arco-design/web-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Header } from './header';
import { useContext, useEffect, useState } from 'react';
import { LanguageContext, LanguageEnum } from './i18n';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import { transform as bubleTransform } from 'buble';

import 'highlight.js/styles/atom-one-light.css';

const markdownParser = MarkdownIt({
  html: true,
  highlight: function (str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang }).value;
      } catch (__) {}
    }
    return ''; // use external default escaping
  }
});

const SubMenu = Menu.SubMenu;
const MenuItem = Menu.Item;

let globalContainerId = 0;

interface IMenuItem {
  path: string;
  fullPath: string;
  title: { [language: string]: string };
  children?: IMenuItem[];
}

interface IOutlineProps {
  menuItems: IMenuItem[];
  assetDirectory: string;
}

interface IOutlineNodeProps {
  menuItem: IMenuItem;
  assetDirectory: string;
}

interface IContentProps {
  content: string;
}

function htmlRestore(str: string) {
  let result = '';
  result = str.replace(/&amp;/g, '&');
  result = result.replace(/&lt;/g, '<');
  result = result.replace(/&gt;/g, '>');
  result = result.replace(/&nbsp;/g, ' ');
  result = result.replace(/&#39;/g, "'");
  result = result.replace(/&quot;/g, '"');
  return result;
}

const jsxMap: Record<string, string> = {
  react: 'React.createElement',
  openinula: 'Inula.createElement',
  vrender: 'VRender.jsx'
};
function transformCode(str: string, template: string) {
  let transformedCode = str;
  try {
    transformedCode =
      bubleTransform(transformedCode, {
        transforms: { templateString: false, asyncAwait: false },
        jsx: jsxMap[template] ?? jsxMap.react
      }).code ?? '';
  } catch (e) {
    transformedCode = str;
  }
  return transformedCode;
}

function generateMenuItem(node: IMenuItem, assetDirectory: string, language: LanguageEnum, navigate: any) {
  return node.children ? (
    <SubMenu key={node.fullPath} title={<>{node.title[language]}</>}>
      <div style={{ marginLeft: 10 }}>
        {node.children.map((subNode: any) => generateMenuItem(subNode, assetDirectory, language, navigate))}
      </div>
    </SubMenu>
  ) : (
    <MenuItem
      key={node.fullPath}
      onClick={() => {
        document.getElementById('markdownDocumentContainer')?.scrollTo?.({
          top: 0
          // behavior: 'smooth',
        });
        navigate(`/vchart/${assetDirectory}${node.fullPath}`, { replace: true });
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
  const { pathname: pathName } = location;
  const fullPath = '/' + pathName.split(`/`).slice(3).join('/');

  return (
    <div
      className="menu-demo-round"
      style={{
        paddingTop: 20,
        paddingBottom: 20
      }}
    >
      <Menu selectedKeys={[fullPath]} autoOpen>
        {(props.menuItems ?? []).map((node: any) => generateMenuItem(node, props.assetDirectory, language, navigate))}
      </Menu>
    </div>
  );
}

function Content(props: IContentProps) {
  const demos = [...props.content.matchAll(/<pre><code class="language-livedemo">((.|\n)*?)<\/code><\/pre>/g)];
  const openinulaDemos = [
    ...props.content.matchAll(/<pre><code class="language-openinula-livedemo">((.|\n)*?)<\/code><\/pre>/g)
  ];

  const allDemos = ([] as any[])
    .concat(demos.map(demo => ({ reg: demo, template: 'react' })))
    .concat(openinulaDemos.map(demo => ({ reg: demo, template: 'openinula' })));

  let content = props.content;

  const runnings = allDemos.map(demo => {
    const pre = demo.reg[0];
    const code = demo.reg[1];
    const containerId = `markdown-demo-${globalContainerId++}`;
    content = content.replace(
      pre,
      `<div style="position: relative">
        <div id="${containerId}" class="markdown-demo"></div>
        <div id="live-demo-additional-container" style="position: absolute; left: 0; top: 0"></div>
      </div>`
    );
    const evaluateCode = code
      .replace('CONTAINER_ID', `"${containerId}"`)
      .concat(`window['${containerId}'] = (() => { try { return vchart; } catch(e) {  } })();`);
    return {
      // TODO: handle template
      code: transformCode(htmlRestore(evaluateCode), demo.template),
      id: containerId
    };
  });

  useEffect(() => {
    runnings.forEach(async running => {
      try {
        // console.log(running.code);
        // Function(running.code)(window);
        await Object.getPrototypeOf(async function () {}).constructor(running.code)();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
      }
    });
    return () => {
      runnings.forEach(running => {
        (window as any)[running.id]?.release?.();
      });
    };
  }, [runnings]);

  return (
    <div
      className="markdown-container"
      style={{ padding: '20px 40px' }}
      dangerouslySetInnerHTML={{ __html: content }}
    ></div>
  );
}

export function Markdown() {
  const { language, setLanguage } = useContext(LanguageContext);

  const location = useLocation();
  const { pathname: pathName } = location;
  const assetDirectory = pathName.split('/')[2];

  const [outline, setOutline] = useState<any>([]);
  const [content, setContent] = useState<string>('');

  const [siderWidth, setSiderWidth] = useState<number>(280);

  const handleMoving = (event: any, { width }: any) => {
    setSiderWidth(Math.max(width, 120));
  };

  useEffect(() => {
    const menuPath = `/assets/${assetDirectory}/menu.json`;
    fetch(menuPath)
      .then(response => response.json())
      .then(menu => {
        const menuItems = menu.children as IMenuItem[];
        // parse menu full path
        function traverse(menuItem: IMenuItem, path: string) {
          menuItem.fullPath = `${path}/${menuItem.path}`;
          (menuItem.children ?? []).forEach(subItem => {
            traverse(subItem, menuItem.fullPath);
          });
        }
        menuItems.forEach(menuItem => traverse(menuItem, ''));
        setOutline(menu.children);
      });
  }, [language, assetDirectory]);

  useEffect(() => {
    const docFullPath = pathName.split(`/${assetDirectory}/`)[1];
    if (!docFullPath) {
      setContent('');
    } else {
      const docPath = `/assets/${assetDirectory}/${language}/${docFullPath}.md`;
      fetch(docPath)
        .then(response => response.text())
        .then(text => {
          let processedText = text;
          // remove meta info for examples
          if (assetDirectory.includes('examples')) {
            const coverLink = processedText.match(/cover:(.*)/)?.[1];
            processedText = processedText.replace(/---(.|\n)*---/, '').trim();
            if (coverLink) {
              processedText = processedText + `\n## Cover:\n![cover](${coverLink.trim()})`;
            }
          }
          // Hack: process all livedemo code to livedemo language and replace these after
          processedText = processedText.replaceAll(
            /\`\`\`(.*) livedemo template=openinula-vchart/g,
            '```openinula-livedemo'
          );
          processedText = processedText.replaceAll(/\`\`\`(.*) livedemo/g, '```livedemo');
          setContent(markdownParser.render(processedText));
        });
    }
  }, [language, pathName, assetDirectory]);

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
