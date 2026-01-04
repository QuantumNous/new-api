import React from 'react';

import BackTop from '../index';
import { IconArrowUp } from '@douyinfe/semi-icons';

export default {
  title: 'BackTop',
}

export const Default = () => (
  <div>
    <div style={{ height: 1600, width: 300, background: 'grey' }}></div>
    <BackTop visibilityHeight={-1} />
  </div>
);

export const Custom = () => (
  <div>
    <div
      style={{
        height: 1600,
        width: 300,
        background: 'grey',
      }}
    ></div>
    <BackTop
      style={{
        height: 40,
        width: 40,
        backgroundColor: '#ddd',
        paddingTop: 12,
      }}
    >
      <IconArrowUp />
    </BackTop>
  </div>
);