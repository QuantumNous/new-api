import React from 'react';

// 审批列表顶部的状态筛选胶囊。options: [{value, label}]
const StatusFilter = ({ value, onChange, options }) => (
  <div className='m-config-bar'>
    {options.map((o) => (
      <div
        key={o.value}
        className={`m-config-chip${value === o.value ? ' active' : ''}`}
        onClick={() => onChange(o.value)}
      >
        {o.label}
      </div>
    ))}
  </div>
);

export default StatusFilter;
