import React, { useMemo } from 'react';
// import { withKnobs, text, boolean } from '@storybook/addon-knobs';
import withPropsCombinations from 'react-storybook-addon-props-combinations';

import { Table } from '@douyinfe/semi-ui/';

import Skeleton from '../index';
import Avatar from '../../avatar';

export default {
  title: 'Skeleton'
}

export const _Skeleton = () => (
  <div>
    <Skeleton placeholder={<Skeleton.Avatar />} loading={true}>
      <Avatar>U</Avatar>
    </Skeleton>
    <Skeleton placeholder={<Skeleton.Image />} loading={true}>
      <Avatar>U</Avatar>
    </Skeleton>
    <Skeleton placeholder={<Skeleton.Paragraph row={6} />} loading={true}>
      <Avatar>U</Avatar>
    </Skeleton>
    <Skeleton placeholder={<Skeleton.Button />} loading={true}>
      <Avatar>U</Avatar>
    </Skeleton>
    <Skeleton placeholder={<Skeleton.Title />} loading={true}>
      <Avatar>U</Avatar>
    </Skeleton>
  </div>
);

export const _Table = () => {
  const Demo = () => {
    const phArray = [1, 2, 1, 1, 1, 1, 2, 1];
    const columns = useMemo(
      () =>
        phArray.map((key, idx) => {
          const item = {};
          item.title = <Skeleton.Title style={{ width: '0' }} />;
          item.dataIndex = key;
          item.key = idx;
          return item;
        }),
      phArray
    );
    const dataSource = useMemo(
      () =>
        [1, 2, 3, 4, 5].map(key => {
          const item = {};
          item.key = key;
          phArray.forEach(i => {
            const width = 50 * i;
            item[i] = <Skeleton.Paragraph style={{ width }} rows={1} />;
          });
          return item;
        }),
      []
    );

    const placeholder = (
      <div style={{ position: 'relative' }}>
        <Table
          style={{ backgroundColor: 'var(--semi-color-bg-1)' }}
          columns={columns}
          dataSource={dataSource}
          pagination={false}
        />
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
      </div>
    );

    return <Skeleton placeholder={placeholder} loading={true} />;
  };

  return <Demo />;
};

_Table.story = {
  name: 'table',
};
