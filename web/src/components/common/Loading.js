import React from 'react';
import { Spin } from '@douyinfe/semi-ui';

const Loading = ({ size = 'small' }) => {

  return (
    <div className="fixed inset-0 w-screen h-screen flex items-center justify-center">
      <Spin
        size={size}
        spinning={true}
      />
    </div>
  );
};

export default Loading;
