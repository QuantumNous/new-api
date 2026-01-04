import React from 'react';
import { Avatar, Badge } from '../../index';
import { IconLock } from '@douyinfe/semi-icons';

export default {
  title: 'Badge',
}

const style = {
  width: '42px',
  height: '42px',
  borderRadius: '4px',
  background: '#eee',
  display: 'inline-block',
  verticalAlign: 'middle',
};

export const Default = () => (
  <div>
    <Badge count={5}>
      <a style={style}></a>
    </Badge>
    <Badge dot>
      <a style={style}></a>
    </Badge>
    <Badge count={5} />
    <Badge dot />
  </div>
);

export const MaxCount = () => (
  <div>
    <Badge count={99}>
      <a style={style}></a>
    </Badge>
    <Badge count={100}>
      <a style={style}></a>
    </Badge>
    <Badge count={99} overflowCount={10}>
      <a style={style}></a>
    </Badge>
    <Badge count={1000} overflowCount={999}>
      <a style={style}></a>
    </Badge>
  </div>
);

export const Type = () => (
  <div style={{ marginTop: 20}}>
    <Badge count={5} type="primary">
      <a style={style}></a>
    </Badge>
    <Badge count={5} type="secondary">
      <a style={style}></a>
    </Badge>
    <Badge count={5} type="tertiary">
      <a style={style}></a>
    </Badge>
    <Badge count={5} type="warning">
      <a style={style}></a>
    </Badge>
    <Badge count={5} type="danger">
      <a style={style}></a>
    </Badge>
    <Badge dot type="primary">
      <a style={style}></a>
    </Badge>
    <Badge dot type="success">
      <a style={style}></a>
    </Badge>
  </div>
);

export const Theme = () => (
  <div>
    <Badge count={5} theme="solid">
      <a style={style}></a>
    </Badge>
    <Badge count={5} theme="light">
      <a style={style}></a>
    </Badge>
    <Badge count={5} theme="inverted">
      <a style={style}></a>
    </Badge>
    <Badge dot theme="solid">
      <a style={style}></a>
    </Badge>
    <Badge dot theme="light">
      <a style={style}></a>
    </Badge>
    <Badge dot theme="inverted">
      <a style={style}></a>
    </Badge>
  </div>
);

export const AvatarBadge = () => {
  const style = {
      width: '42px',
      height: '42px',
      borderRadius: '4px',
  };
  return (
      <div>
          <Badge count={5}>
              <Avatar color='blue' shape='square' style={style}>BM</Avatar>
          </Badge>
          <br/>
          <br/>
          <Badge dot>
              <Avatar color='blue' shape='square' style={style}>YL</Avatar>
          </Badge>
          <br/>
          <br/>
          <Badge count={<IconLock style={{color:'var(--semi-color-primary)'}}/>}>
              <Avatar color='light-blue' shape='square' style={style}>XZ</Avatar>
          </Badge>
          <br/>
          <br/>
          <Badge count='NEW' >
              <Avatar color='light-blue' shape='square' style={style}>WF</Avatar>
          </Badge>
      </div>
  );  
};
AvatarBadge.storyName = '头像 badge';

export const SingleUsage = () => {
  return (
    <div>
      <Badge count={5} theme='light' type='primary' countStyle={{ backgroundColor: 'lightPink' }}/>
    </div>
  );
};
SingleUsage.storyName = '单个使用';