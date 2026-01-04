import React, { useState } from 'react';
import Button from '../../button/index';
import Spin from '../index';

export default {
  title: 'Spin'
}

const Example1 = () => (
  <div style={{ marginLeft: 30 }}>
    <div style={{ marginTop: 20 }}>size:small</div>
    <Spin size="small" />
    <div style={{ marginTop: 20 }}>size:middle</div>
    <Spin size="middle" />
    <div style={{ marginTop: 20 }}>size:large</div>
    <Spin size="large" />
  </div>
);

export const SpinDefault = () => <Example1 />;

SpinDefault.story = {
  name: 'spin default',
};

const Example2 = () => {
  const [visible, setVisible] = useState(true);
  return (
    <div>
      <Spin spinning={visible} tip="loading">
        <div style={{ 'background-color': '#e6f7ff', border: '1px solid #91d5ff' }}>
          <p>yoyoyoyoyo</p>
          <p>yoyoyoyoyo</p>
          <p>yoyoyoyoyo</p>
        </div>
      </Spin>
      <div style={{ marginTop: 30 }}>
        <Button
          onClick={() => {
            setVisible(!visible);
          }}
          style={{ marginRight: 20 }}
        >
          受控
        </Button>
      </div>
    </div>
  );
};

export const SpinHasText = () => <Example2 />;

SpinHasText.story = {
  name: 'spin has text',
};

const Example3 = () => {
  const [visible1, setVisible1] = useState(false);
  const [visible2, setVisible2] = useState(false);
  return (
    <div style={{ marginLeft: 30 }}>
      <div style={{ marginTop: 30 }}>
        <Button
          onClick={() => {
            setVisible1(!visible1);
          }}
          style={{ marginRight: 20 }}
        >
          延迟显示spin
        </Button>
        <Spin delay={1000} spinning={visible1}></Spin>
      </div>
      <div style={{ marginTop: 30 }}>
        <Button
          onClick={() => {
            setVisible2(!visible2);
          }}
          style={{ marginRight: 20 }}
        >
          受控显示spin
        </Button>
        <Spin spinning={visible2}></Spin>
      </div>
    </div>
  );
};

export const SpinHasDelay = () => <Example3 />;

SpinHasDelay.story = {
  name: 'spin has delay',
};
