import { Menu } from '@arco-design/web-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const SubMenu = Menu.SubMenu;
const MenuItem = Menu.Item;

export interface IOptionOutlineNode {
  basePath: string;
  fullPath: string;
  allPath: string[];
  prop: string;
  default: any;
  type: string;
  isObject: boolean;
  isArray: boolean;
  parent: IOptionOutlineNode | null;
  children: IOptionOutlineNode[] | null;
}

export function parseOutline(
  outline: any,
  sectionMap: { [key: string]: string } = {},
  sectionMatch: { from: string; to: string }[] = [],
  path?: string,
  parent?: IOptionOutlineNode
) {
  if (!outline) {
    return null;
  }

  const fullPath = path
    ? outline.arrayItemType
      ? `${path}-${outline.arrayItemType}`
      : `${path}.${outline.prop}`
    : outline.prop ?? '';

  if (parent?.fullPath) {
    let basePath: string | undefined = undefined;

    if (Object.keys(sectionMap).includes(parent?.fullPath)) {
      basePath = `${sectionMap[parent.fullPath]}-${outline.arrayItemType}`;
    } else {
      const match = sectionMatch.find(match => parent?.fullPath.match(match.from));
      if (match) {
        const matchedPath = parent.fullPath.replace(match.from, match.to);
        basePath = `${matchedPath}-${outline.arrayItemType}`;
      }
    }

    if (basePath !== undefined) {
      const outlineNode: IOptionOutlineNode = {
        basePath: basePath,
        fullPath: fullPath,
        allPath: [basePath],
        prop: outline.prop,
        default: outline.default,
        type: outline.type ?? '',
        isObject: outline.isObject ?? false,
        isArray: outline.isArray ?? false,
        parent: parent ?? null,
        children: null
      };
      outlineNode.children = outline.children
        ? outline.children.map((subOutline: any) =>
            parseOutline(subOutline, sectionMap, sectionMatch, basePath, outlineNode)
          )
        : null;
      return outlineNode;
    }
  }

  const outlineNode: IOptionOutlineNode = {
    basePath: fullPath.split('.')[0],
    fullPath: fullPath,
    allPath: fullPath.split('.'),
    prop: outline.prop,
    default: outline.default,
    type: outline.type ?? '',
    isObject: outline.isObject ?? false,
    isArray: outline.isArray ?? false,
    parent: parent ?? null,
    children: null
  };
  outlineNode.children = outline.children
    ? outline.children.map((subOutline: any) =>
        parseOutline(subOutline, sectionMap, sectionMatch, fullPath, outlineNode)
      )
    : null;
  return outlineNode;
}

export function recordOutline(node: IOptionOutlineNode | null, map: Record<string, IOptionOutlineNode> = {}) {
  if (!node) {
    return {};
  }
  map[node.fullPath] = node;
  (node.children ?? []).forEach(subNode => {
    recordOutline(subNode, map);
  });
  return map;
}

function getOutlineTextNode(node: IOptionOutlineNode) {
  if (node.prop) {
    if (node.isArray) {
      return `${node.prop}: [...]`;
    }
    return node.children ? `${node.prop}: {...}` : `${node.prop}${node.default != null ? `: ${node.default}` : ''}`;
  } else {
    return node.children ? `${node.children[0].prop}=${node.children[0].default}` : '{...}';
  }
}

function generateOutlineNode(
  node: IOptionOutlineNode,
  openKeys: string[],
  onMenuItemClick: (node: IOptionOutlineNode) => () => void
) {
  const title = getOutlineTextNode(node);
  const nodeKey = node.fullPath.replaceAll('"', '');
  return node.children ? (
    <SubMenu
      className="option-outline-submenu"
      key={nodeKey}
      title={<>{title}</>}
      style={{ lineHeight: '24px' }}
      // selectable
      // onClick={onMenuItemClick(node)}
    >
      {openKeys.includes(nodeKey) ? (
        <div style={{ marginLeft: 10 }}>
          {node.children.map(subNode => {
            return generateOutlineNode(subNode, openKeys, onMenuItemClick);
          })}
        </div>
      ) : null}
    </SubMenu>
  ) : (
    <MenuItem style={{ height: 24, lineHeight: '20px' }} key={nodeKey} onClick={onMenuItemClick(node)}>
      {title}
    </MenuItem>
  );
}

interface IOutlineProps {
  baseUrl: string;
  outline: IOptionOutlineNode | null;
  style?: React.CSSProperties;
  onOutlineItemClick?: () => void;
  // className?: string;
  [foo: string]: any;
}

const getPathKeys = (path: string) => {
  const splitPath = path.split('.');
  const keys: string[] = [];
  splitPath.forEach((key, index) => {
    // split for array outline node
    if (key.indexOf('-') > -1) {
      keys.push(splitPath.slice(0, index).concat(key.split('-')[0]).join('.'));
    }
    keys.push(splitPath.slice(0, index + 1).join('.'));
  });
  return keys;
};

export function Outline(props: IOutlineProps) {
  const location = useLocation();
  const pathName = decodeURI(location.pathname);
  const hash = decodeURI(location.hash);
  // TODO: default path
  const basePath = pathName.split(`${props.baseUrl}/`)[1] ?? 'barChart';
  const optionPath = hash ? (basePath !== '' ? `${basePath}.${hash.substring(1)}` : hash.substring(1)) : basePath;
  const optionKeys = getPathKeys(optionPath);

  const [openKeys, setOpenKeys] = useState<string[]>(optionKeys);
  const navigate = useNavigate();

  useEffect(() => {
    setTimeout(() => {
      document.getElementById(optionPath)?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, []);

  const onMenuItemClick = (targetNode: IOptionOutlineNode) => {
    return () => {
      const id = targetNode.fullPath.replaceAll('"', '');
      const path = id.split('.');
      const hash = path.slice(1).join('.');
      const navPath =
        (!targetNode.children || targetNode.children.length === 0) && targetNode.parent?.fullPath === ''
          ? `#${path}`
          : `${path[0]}#${hash}`;
      props.onOutlineItemClick?.();
      navigate(encodeURI(`${props.baseUrl}/${navPath}`), {
        replace: true
      });
      if (targetNode.basePath === basePath) {
        setTimeout(() => {
          document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      } else {
        setTimeout(() => {
          document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
        }, 500);
      }
    };
  };

  return (
    <div
      style={{
        paddingTop: 20,
        paddingBottom: 20,
        ...(props.style ?? {})
      }}
    >
      <Menu
        selectedKeys={[optionPath]}
        openKeys={openKeys}
        onClickSubMenu={key => {
          const nextOpenKeys = openKeys.includes(key) ? openKeys.filter(k => k !== key) : [key, ...openKeys];
          setOpenKeys(nextOpenKeys);
        }}
      >
        {(props.outline?.children ?? []).map(node => {
          return generateOutlineNode(node, openKeys, onMenuItemClick);
        })}
      </Menu>
    </div>
  );
}
