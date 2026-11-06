import { IconMinus, IconPlus } from '@arco-design/web-react/icon';
import { Button } from '@arco-design/web-react';
import { array } from '@visactor/vutils';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { IOptionOutlineNode } from './outline';

export interface IOptionDescriptionNode {
  desc: string;
  fullPath: string;
  prop: string;
  path: string[];
  children: IOptionDescriptionNode[];
}

export function parseDescription(description: any, basePath: string = '') {
  const descriptionMap: Record<string, IOptionDescriptionNode> = {};
  const descriptionNodes = Object.keys(description).map(path => {
    const fullPath = basePath === '' ? path : `${basePath}.${path}`;
    const allPath = fullPath.split('.');
    const node: IOptionDescriptionNode = {
      desc: description[path].desc,
      fullPath,
      prop: allPath[allPath.length - 1],
      path: allPath,
      children: []
    };
    descriptionMap[fullPath] = node;
    return node;
  });
  descriptionNodes.forEach(node => {
    const parentPath = node.path.slice(0, -1).join('.');
    const parentNode = descriptionMap[parentPath];
    if (parentNode) {
      parentNode.children.push(node);
    }
  });
  return descriptionNodes.filter(node => node.path.length === 1 || node.path.length === 2);
}

interface IDescriptionNodeProps {
  baseUrl: string;
  description: IOptionDescriptionNode;
  recordedOutline: Record<string, IOptionOutlineNode>;
  connectLine?: boolean;
  style?: React.CSSProperties;
}

function DescriptionLeaf(props: IDescriptionNodeProps) {
  const { description, recordedOutline } = props;
  const outline = recordedOutline[description.fullPath];
  const descKey = description.fullPath?.replaceAll?.('"', '');
  const nodeText =
    description.path.length <= 1
      ? ''
      : description.path
          .slice(0, -1)
          // .map((str) => str.replaceAll('"', ''))
          .join('.') + '.';
  const leafText = description.path[description.path.length - 1];

  return (
    <div
      style={{
        borderBottom: '1px solid #ccc',
        paddingBottom: 40,
        marginLeft: 20,
        position: 'relative',
        width: 'calc(100% - 32px)'
      }}
    >
      {props.connectLine ? (
        <div
          style={{
            position: 'absolute',
            width: 40,
            top: 15,
            left: -48,
            borderTop: '1px solid rgb(224, 230, 241)'
          }}
        ></div>
      ) : null}
      <h2 id={descKey} style={{ fontSize: 21, marginBottom: 5, wordBreak: 'break-word' }}>
        <span style={{ color: 'rgb(134, 144, 156)' }}>{nodeText}</span>
        {leafText}
        <span style={{ color: 'rgb(134, 144, 156)' }}>{outline.default ? ` = ${outline.default}` : ''}</span>
      </h2>
      {outline.type && outline.type !== ''
        ? array(outline.type).map(type => (
            <div
              style={{
                background: 'rgb(232, 243, 255)',
                width: 'fit-content',
                padding: '0px 10px',
                marginBottom: 10,
                marginRight: 6,
                color: 'rgb(22, 93, 255)',
                borderRadius: 2,
                display: 'inline-block'
              }}
            >
              {type}
            </div>
          ))
        : null}
      <div dangerouslySetInnerHTML={{ __html: description.desc }}></div>
    </div>
  );
}

function DescriptionNode(props: IDescriptionNodeProps) {
  const { description, recordedOutline } = props;
  const outline = recordedOutline[description.fullPath];

  const [open, setOpen] = useState<boolean>(false);

  const location = useLocation();
  const { pathname: pathName, hash } = location;
  // TODO: default path
  const basePath = decodeURI(pathName.split(`${props.baseUrl}/`)[1] ?? 'barChart');
  const optionPath = decodeURI(hash ? `${basePath}.${hash.substring(1)}` : basePath);
  const selectedPath = optionPath.split('.');
  const selected = outline.fullPath
    .replaceAll('"', '')
    .split('.')
    .every((prop, index) => prop === selectedPath[index]);

  const showChildren = selected || open;

  const descKey = description.fullPath.replaceAll('"', '');
  const nodeText =
    description.path
      .slice(0, -1)
      // .map((str) => str.replaceAll('"', ''))
      .join('.') + '.';
  const leafText = description.path[description.path.length - 1];

  if (!outline) {
    return null;
  }

  return (
    <div
      style={{
        borderBottom: '1px solid #ccc',
        paddingBottom: 40,
        marginLeft: 20,
        position: 'relative',
        width: 'calc(100% - 20px)'
      }}
    >
      {props.connectLine ? (
        <div
          style={{
            position: 'absolute',
            width: 20,
            top: 15,
            left: -48,
            borderTop: '1px solid rgb(224, 230, 241)'
          }}
        ></div>
      ) : null}
      <div
        style={{
          visibility: showChildren ? 'visible' : 'hidden',
          position: 'absolute',
          width: 11,
          height: 'calc(100% - 40px)',
          top: 15,
          left: -17,
          borderLeft: '1px solid rgb(224, 230, 241)',
          borderBottom: '1px solid rgb(224, 230, 241)'
        }}
      ></div>
      <Button
        type="secondary"
        icon={showChildren ? <IconMinus /> : <IconPlus />}
        style={{
          position: 'absolute',
          left: -24,
          top: 8,
          width: 15,
          height: 15,
          lineHeight: '12px',
          fontSize: 12,
          borderRadius: '50%',
          color: 'white',
          background: 'rgb(154, 173, 209)'
        }}
        onClick={() => setOpen(!open)}
      />
      <h2 id={descKey} style={{ fontSize: 21, marginBottom: 5, wordBreak: 'break-word' }}>
        <span style={{ color: 'rgb(134, 144, 156)' }}>{nodeText}</span>
        {leafText}
        <span style={{ color: 'rgb(134, 144, 156)' }}>{outline.default ? ` = ${outline.default}` : ''}</span>
      </h2>
      {outline.type && outline.type !== ''
        ? array(outline.type).map(type => (
            <div
              style={{
                background: 'rgb(232, 243, 255)',
                width: 'fit-content',
                padding: '0px 10px',
                marginBottom: 10,
                marginRight: 6,
                color: 'rgb(22, 93, 255)',
                borderRadius: 2,
                display: 'inline-block'
              }}
            >
              {type}
            </div>
          ))
        : null}
      <div dangerouslySetInnerHTML={{ __html: description.desc }}></div>
      <div style={{ marginLeft: 12 }}>
        {showChildren
          ? description.children.map(subDescription => {
              return subDescription.children.length > 0 ? (
                <DescriptionNode
                  baseUrl={props.baseUrl}
                  key={subDescription.fullPath}
                  description={subDescription}
                  recordedOutline={recordedOutline}
                  connectLine
                />
              ) : (
                <DescriptionLeaf
                  baseUrl={props.baseUrl}
                  key={subDescription.fullPath}
                  description={subDescription}
                  recordedOutline={recordedOutline}
                  connectLine
                />
              );
            })
          : null}
      </div>
    </div>
  );
}

interface IDescriptionProps {
  baseUrl: string;
  descriptions: IOptionDescriptionNode[];
  recordedOutline: Record<string, IOptionOutlineNode>;
  outlineWidth?: number;
  style?: React.CSSProperties;
  // className?: string;
  [foo: string]: any;
}

export function Description(props: IDescriptionProps) {
  if (
    !props.descriptions ||
    props.descriptions.length === 0 ||
    !props.recordedOutline ||
    Object.keys(props.recordedOutline).length === 0
  ) {
    return <></>;
  }

  return (
    <div
      style={{
        padding: '20px 20px 60px 40px',
        width: `calc(100vw - ${60 + (props.outlineWidth ?? 280)}px)`,
        ...(props.style ?? {})
      }}
    >
      {props.descriptions.map(desc => {
        const descKey = desc.fullPath.replaceAll('"', '');
        return desc.children.length > 0 ? (
          <DescriptionNode
            baseUrl={props.baseUrl}
            key={descKey}
            description={desc}
            recordedOutline={props.recordedOutline}
          />
        ) : (
          <DescriptionLeaf
            baseUrl={props.baseUrl}
            key={descKey}
            description={desc}
            recordedOutline={props.recordedOutline}
          />
        );
      })}
    </div>
  );
}
