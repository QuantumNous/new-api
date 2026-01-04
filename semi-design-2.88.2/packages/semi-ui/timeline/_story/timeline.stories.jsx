import React, { useState } from 'react';

import Timeline from '../index';
import { Icon } from '../../index';
import { IconAlertTriangle } from '@douyinfe/semi-icons';

export default {
  title: 'Timeline'
}

export const DefaultTimeline = () => (
  <div>
    <Timeline aria-label="xx事故处理过程时间线">
      <Timeline.Item time="2015-09-01">创建服务现场</Timeline.Item>
      <Timeline.Item time="2015-09-01">初步排除网络异常</Timeline.Item>
      <Timeline.Item time="2015-09-01">技术测试异常</Timeline.Item>
      <Timeline.Item time="2015-09-01">网络异常正在修复</Timeline.Item>
    </Timeline>
  </div>
);

DefaultTimeline.story = {
  name: 'default Timeline',
};

export const Color = () => (
  <div>
    <Timeline>
      <Timeline.Item time="2015-09-01" type="success">
        创建服务现场
      </Timeline.Item>
      <Timeline.Item time="2015-09-01">初步排除网络异常</Timeline.Item>
      <Timeline.Item time="2015-09-01" type="warning">
        技术测试异常
      </Timeline.Item>
      <Timeline.Item time="2015-09-01" type="error">
        网络异常正在修复
      </Timeline.Item>
    </Timeline>
  </div>
);

Color.story = {
  name: 'color',
};

export const Custom = () => (
  <div>
    <Timeline>
      <Timeline.Item time="2015-09-01" color="pink">
        创建服务现场
      </Timeline.Item>
      <Timeline.Item time="2015-09-01" color="pink">
        <span
          style={{
            fontSize: '18px',
          }}
        >
          初步排除网络异常
        </span>
      </Timeline.Item>
      <Timeline.Item time="2015-09-01" dot={<IconAlertTriangle />} type="warning">
        技术测试异常
      </Timeline.Item>
      <Timeline.Item time="2015-09-01" extra="节点辅助说明信息">
        初步排除网络异常
      </Timeline.Item>
    </Timeline>
  </div>
);

Custom.story = {
  name: 'custom',
};

export const Mode = () => (
  <div>
    <div
      style={{
        width: '300px',
      }}
    >
      <Timeline mode="alternate">
        <Timeline.Item time="2015-09-01" dot={<IconAlertTriangle />}>创建服务现场</Timeline.Item>
        <Timeline.Item time="2015-09-01" dot={<IconAlertTriangle />}>初步排除网络异常</Timeline.Item>
        <Timeline.Item time="2015-09-01" dot={<IconAlertTriangle />}>技术测试异常</Timeline.Item>
        <Timeline.Item time="2015-09-01" dot={<IconAlertTriangle />}>网络异常正在修复</Timeline.Item>
      </Timeline>
    </div>
    <br />
    <div
      style={{
        width: '300px',
      }}
    >
      <Timeline mode="right">
        <Timeline.Item time="2015-09-01" dot={<IconAlertTriangle />}>创建服务现场</Timeline.Item>
        <Timeline.Item time="2015-09-01" dot={<IconAlertTriangle />}>初步排除网络异常</Timeline.Item>
        <Timeline.Item time="2015-09-01">技术测试异常</Timeline.Item>
        <Timeline.Item time="2015-09-01">网络异常正在修复</Timeline.Item>
      </Timeline>
    </div>
    <br />
    <div
      style={{
        width: '300px',
      }}
    >
      <Timeline mode="left">
        <Timeline.Item time="2015-09-01" dot={<IconAlertTriangle />}>创建服务现场</Timeline.Item>
        <Timeline.Item time="2015-09-01" dot={<IconAlertTriangle />}>初步排除网络异常</Timeline.Item>
        <Timeline.Item time="2015-09-01">技术测试异常</Timeline.Item>
        <Timeline.Item time="2015-09-01">网络异常正在修复</Timeline.Item>
      </Timeline>
    </div>
    <br />
    <div
      style={{
        width: '300px',
      }}
    >
      <Timeline mode="center">
        <Timeline.Item time="2015-09-01">创建服务现场</Timeline.Item>
        <Timeline.Item time="2015-09-01" dot={<IconAlertTriangle />}>初步排除网络异常</Timeline.Item>
        <Timeline.Item time="2015-09-01">技术测试异常</Timeline.Item>
        <Timeline.Item time="2015-09-01">网络异常正在修复</Timeline.Item>
      </Timeline>
    </div>
  </div>
);

Mode.story = {
  name: 'mode',
};

const data = [
  {
    time: '2019-07-14 10:35',
    extra: '节点辅助说明信息',
    content: '创建服务现场',
    type: 'ongoing',
  },
  {
    time: '2019-06-13 16:17',
    extra: '节点辅助说明信息',
    content: (
      <span
        style={{
          fontSize: '18px',
        }}
      >
        初步排除网络异常
      </span>
    ),
    color: 'pink',
  },
  {
    time: '2019-05-14 18:34',
    extra: '节点辅助说明信息',
    dot: <IconAlertTriangle />,
    content: '技术测试异常',
    type: 'warning',
  },
  {
    time: '2019-05-09 09:12',
    extra: '节点辅助说明信息',
    content: '网络异常正在修复',
    dot: <IconAlertTriangle />,
    type: 'success',
  },
];

export const DataSource = () => (
  <div
    style={{
      width: '400px',
    }}
  >
    <Timeline mode="alternate" dataSource={data} />
  </div>
);

DataSource.story = {
  name: 'dataSource',
};

const dataWithOnClick = [
  {
      time: '2019-07-14 10:35',
      extra: '节点辅助说明信息',
      content: '创建服务现场',
      type: 'ongoing',
      onClick: e => console.log(e, '创建服务现场'),
  },
  {
      time: '2019-06-13 16:17',
      extra: '节点辅助说明信息',
      content: <span style={{ fontSize: '18px' }}>初步排除网络异常</span>,
      color: 'pink',
      onClick: e => console.log(e, '初步排除网络异常'),
  },
  {
      time: '2019-05-14 18:34',
      extra: '节点辅助说明信息',
      dot: <Icon type="alert_triangle" />,
      content: '技术测试异常',
      type: 'warning',
      onClick: e => console.log(e, '技术测试异常'),
  },
  {
      time: '2019-05-09 09:12',
      extra: '节点辅助说明信息',
      content: '网络异常正在修复',
      type: 'success',
      onClick: e => console.log(e, '网络异常正在修复'),
  }
];

export const OnClickDemo = () => (
  <div style={{ width: '400px' }}>
    <div style={{ width: '300px' }}>
        <Timeline mode='center'>
            <Timeline.Item time='2015-09-01' onClick={e=>console.log(e, '创建服务现场')}>创建服务现场</Timeline.Item>
            <Timeline.Item time='2015-09-01' onClick={e=>console.log(e, '初步排除网络异常')}>初步排除网络异常</Timeline.Item>
            <Timeline.Item time='2015-09-01' onClick={e=>console.log(e, '技术测试异常')}>技术测试异常</Timeline.Item>
            <Timeline.Item time='2015-09-01' onClick={e=>console.log(e, '网络异常正在修复')}>网络异常正在修复</Timeline.Item>
        </Timeline>
        <Timeline mode='alternate' dataSource={dataWithOnClick} />
    </div>
  </div>
);

OnClickDemo.story = {
  name: 'onClick',
};
