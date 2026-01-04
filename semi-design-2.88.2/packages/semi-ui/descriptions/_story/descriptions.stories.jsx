import React from 'react';
import Descriptions from '../index';
import Tag from '../../tag';

export default {
  title: 'Descriptions',
}

let data = [
    // ShortId: '火山号',
    // UID: 'UID',
    { key: '火山号', value: 12000 },
    { key: <span>1232</span>, value: 12000 },
    { key: '粉丝', value: 3112 },
    { key: '火力', value: 3000 },
    { key: '剩余钻石', value: 3000 },
    { key: '消费', value: 3000 },
    { key: '关注', value: 3000 },
];

let data2 = [
    // ShortId: '火山号',
    // UID: 'UID',
    { key: '主播类型(签约)', value: '自由（普通）主播' },
    { key: '安全等级', value: '3级' },
    { key: '垂类标签', value: undefined },
    { key: '认证状态', value: '未认证' },
    { key: '作者来源', value: '' },
    { key: '经纪人', value: '' }
];

let data3 = [
    // ShortId: '火山号',
    // UID: 'UID',
    { key: '主播类型(签约)', value: '自由（普通）主播' },
    { key: '安全等级', value: '3级' },
    { key: '垂类标签', value: undefined },
    { key: '认证状态', value: '这是一个很长很长很长很长很长很长很长很长很长的值，需要自动换行显示' },
];

let data4 = [
    // ShortId: '火山号',
    // UID: 'UID',
    { key: '实际用户数量', value: '1,480,000' },
    { key: '7天留存', value: '98%' },
    { key: '7天留存', value: '103.4M' },
];

let data5 = [
    { key: '火山号', value: '123456789' },
    { key: '主播类型(签约)', value: '自由（普通）主播' },
    { key: '安全等级', value: '3级' },
    { key: '垂类标签', value: '新闻博主' },
    { key: '认证状态', value: '这是一个很长很长很长很长很长很长很长很长很长的值，需要自动换行显示', span: 3 },
];

export const DescriptionsDefault = () => (
  <div>
    <Descriptions data={data} />
    <Descriptions align="justify" data={data2} />
    <Descriptions align="left" data={data3} />
    <Descriptions align="plain" data={data2} />
  </div>
);

export const DescriptionsDoubleRow = () => (
  <div>
    <Descriptions data={data4} row size="small" />
    <Descriptions data={data4} row />
    <Descriptions data={data4} row size="large" />
  </div>
);

export const DescriptionsItem = () => (
  <div>
    <Descriptions>
      <Descriptions.Item itemKey="实际用户数量">1,480,000</Descriptions.Item>
      <Descriptions.Item itemKey="7天留存">98%</Descriptions.Item>
      <Descriptions.Item itemKey="安全等级">3级</Descriptions.Item>
      <Descriptions.Item itemKey="垂类标签">电商</Descriptions.Item>
      <Descriptions.Item itemKey="认证状态">未认证</Descriptions.Item>
    </Descriptions>
    <br />
    <Descriptions row size="small">
      <Descriptions.Item itemKey="实际用户数量">1,480,000</Descriptions.Item>
      <Descriptions.Item itemKey="7天留存">98%</Descriptions.Item>
      <Descriptions.Item itemKey="安全等级">3级</Descriptions.Item>
      <Descriptions.Item itemKey="垂类标签">电商</Descriptions.Item>
      <Descriptions.Item itemKey="认证状态">未认证</Descriptions.Item>
    </Descriptions>
    <br />
    <Descriptions align="justify">
      <Descriptions.Item>1,480,000</Descriptions.Item>
      <Descriptions.Item itemKey="7天留存">98%</Descriptions.Item>
      <Descriptions.Item itemKey="安全等级">3级</Descriptions.Item>
      <Descriptions.Item itemKey="垂类标签">电商</Descriptions.Item>
      <Descriptions.Item itemKey="认证状态">未认证</Descriptions.Item>
    </Descriptions>
    <br />
  </div>
);

export const DescriptionsKeyIsNode = () => {
  const data = [
      { key: <strong style={{color: 'red'}}>实际用户数量</strong>, value: '1,480,000' },
      { key: '7天留存', value: '98%' },
      { key: '安全等级', value: '3级' },
      { key: '垂类标签', value: <Tag style={{ margin: 0 }}>电商</Tag> },
      { key: '认证状态', value: '未认证' },
  ];
  const style = {
      boxShadow: 'var(--shadow-elevated)',
      backgroundColor: 'var(--color-bg-2)',
      borderRadius: '4px',
      padding: '10px',
      margin: '10px',
      width: '200px',
  };
  return (
    <>
      <div>data 传入的写法</div>
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        <Descriptions align="center" data={data} style={style} />
        <Descriptions align="justify" data={data} style={style} />
        <Descriptions align="left" data={data} style={style} />
        <Descriptions align="plain" data={data} style={style} />
      </div>
      <div>JSX 写法</div>
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        <Descriptions style={style} align="center" >
          <Descriptions.Item itemKey={<strong style={{ color: 'red' }}>实际用户数量</strong>}>1,480,000</Descriptions.Item>
          <Descriptions.Item itemKey="7天留存">98%</Descriptions.Item>
          <Descriptions.Item itemKey="认证状态">未认证</Descriptions.Item>
        </Descriptions>
        <Descriptions style={style} align="justify">
          <Descriptions.Item itemKey={<strong style={{ color: 'red' }}>实际用户数量</strong>}>1,480,000</Descriptions.Item>
          <Descriptions.Item itemKey="7天留存">98%</Descriptions.Item>
          <Descriptions.Item itemKey="认证状态">未认证</Descriptions.Item>
        </Descriptions>
        <Descriptions style={style} align="left">
          <Descriptions.Item itemKey={<strong style={{ color: 'red' }}>实际用户数量</strong>}>1,480,000</Descriptions.Item>
          <Descriptions.Item itemKey="7天留存">98%</Descriptions.Item>
          <Descriptions.Item itemKey="认证状态">未认证</Descriptions.Item>
        </Descriptions>
        <Descriptions style={style} align="plain">
          <Descriptions.Item itemKey={<strong style={{ color: 'red' }}>实际用户数量</strong>}>1,480,000</Descriptions.Item>
          <Descriptions.Item itemKey="7天留存">98%</Descriptions.Item>
          <Descriptions.Item itemKey="认证状态">未认证</Descriptions.Item>
        </Descriptions>
      </div>
    </>
  );
};

export const DescriptionsLayout = () => {
    return <>
        <div>data 传入的写法</div>
        <Descriptions layout='horizontal' row size='large' data={data} />
        <Descriptions layout='horizontal' align='left' data={data5} />
        <div>jsx 传入的写法</div>
        <Descriptions layout='horizontal' align='left'>
            <Descriptions.Item itemKey={<strong style={{ color: 'red' }}>实际用户数量</strong>}>1,480,000</Descriptions.Item>
            <Descriptions.Item itemKey="7天留存">98%</Descriptions.Item>
            <Descriptions.Item itemKey="认证状态">未认证</Descriptions.Item>
        </Descriptions>
        <Descriptions layout='horizontal' align='plain'>
            <Descriptions.Item itemKey={<strong style={{ color: 'red' }}>实际用户数量</strong>}>1,480,000</Descriptions.Item>
            <Descriptions.Item itemKey="7天留存">98%</Descriptions.Item>
            <Descriptions.Item itemKey="认证状态">未认证</Descriptions.Item>
        </Descriptions>
    </>
};
