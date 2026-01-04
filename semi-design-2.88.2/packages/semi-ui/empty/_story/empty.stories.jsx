import React from 'react';

import Empty from '../index';
import Button from '../../button';
import { IllustrationSuccess } from '@douyinfe/semi-illustrations';

export default {
  title: 'Empty',
}

export const EmptySimple = () => (
  <div>
    <Empty image={<IllustrationSuccess />} description={'功能建设中'} />
    <br />
    <Empty image={<IllustrationSuccess />} description={'功能建设中'}>
      该模块功能建设中，敬请期待。该模块功能建设中，敬请期待。
    </Empty>
    <br />
    <Empty image={<IllustrationSuccess />}>
      该模块功能建设中，敬请期待。该模块功能建设中，敬请期待。
    </Empty>
    <br />
    <Empty description={'功能建设中'}>
      该模块功能建设中，敬请期待。该模块功能建设中，敬请期待。
    </Empty>
  </div>
);

export const EmptyCta = () => (
  <div>
    <Empty description={'功能建设中'} image={<IllustrationSuccess />}>
      <div style={{ textAlign: 'center' }}>
        <p>该模块功能建设中，敬请期待。该模块功能建设中，敬请期待。</p>
        <Button type="primary" style={{ marginTop: 24 }}>
          建设中
        </Button>
      </div>
    </Empty>
  </div>
);

export const EmptyLayout = () => (
  <div>
    <Empty description={'功能建设中'} image={<IllustrationSuccess />} layout="horizontal">
      <div>
        <p>该模块功能建设中，敬请期待。该模块功能建设中，敬请期待。</p>
        <Button type="primary" style={{ marginTop: 24 }}>
          建设中
        </Button>
      </div>
    </Empty>
  </div>
);
