import React, { useState } from 'react';
import { Picker } from 'antd-mobile';
import { DownOutline } from 'antd-mobile-icons';

// 生成页顶部的参数胶囊条：每个字段一个可点 Tag，点开 antd-mobile Picker 单列选择。
// options 支持字符串数组或 {label, value} 数组。
const normalizeOptions = (options = []) =>
  options.map((o) =>
    typeof o === 'object' && o !== null
      ? { label: String(o.label ?? o.value), value: o.value }
      : { label: String(o), value: o },
  );

const ConfigBar = ({ fields, disabled = false }) => {
  const [openKey, setOpenKey] = useState('');

  return (
    <div className='m-config-bar'>
      {fields
        .filter((f) => (f.options || []).length > 0)
        .map((f) => {
          const opts = normalizeOptions(f.options);
          const current = opts.find((o) => o.value === f.value);
          return (
            <React.Fragment key={f.key}>
              <div
                className={`m-config-chip${current ? ' active' : ''}`}
                onClick={() => !disabled && setOpenKey(f.key)}
              >
                {f.label}
                {current ? `：${current.label}` : ''}{' '}
                <DownOutline fontSize={9} />
              </div>
              <Picker
                columns={[opts]}
                visible={openKey === f.key}
                value={[f.value]}
                onClose={() => setOpenKey('')}
                onConfirm={(v) => f.onChange(v[0])}
              />
            </React.Fragment>
          );
        })}
    </div>
  );
};

export default ConfigBar;
