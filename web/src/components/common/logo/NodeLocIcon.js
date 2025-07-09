import React from 'react';
import { Icon } from '@douyinfe/semi-ui';

const NodeLocIcon = (props) => {
  function CustomIcon() {
    return (
      <svg
        className='icon'
        viewBox='0 0 16 16'
        version='1.1'
        xmlns='http://www.w3.org/2000/svg'
        width='1em'
        height='1em'
        {...props}
      >
        <g id='nodeloc_icon' data-name='nodeloc_icon'>
          <path
            d='m8,0c4.42,0,8,3.58,8,8s-3.58,8-8,8-8-3.58-8-8,3.58-8,8-8Z'
            fill='#EFEFEF'
          />
          <path
            d='m1.27,11.33h13.45c-.94,1.89-2.51,3.21-4.51,3.88-1.99.59-3.96.37-5.8-.57-1.25-.7-2.67-1.9-3.14-3.3Z'
            fill='#FEB005'
          />
          <path
            d='m12.54,1.99c.87.7,1.82,1.59,2.18,2.68H1.27c.87-1.74,2.33-3.13,4.2-3.78,2.44-.79,5-.47,7.07,1.1Z'
            fill='#1D1D1F'
          />
        </g>
      </svg>
    );
  }

  return <Icon svg={<CustomIcon />} />;
};

export default NodeLocIcon;
