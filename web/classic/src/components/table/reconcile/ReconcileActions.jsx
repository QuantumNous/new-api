/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import React from 'react';
import { Space, Tag, Typography } from '@douyinfe/semi-ui';
import { BookOpenCheck } from 'lucide-react';
import CompactModeToggle from '../../common/ui/CompactModeToggle';

const { Text } = Typography;

const formatCny = (n) => `¥${Number(n || 0).toFixed(2)}`;

// statsArea for CardPro type2 — left side shows the page identity (icon +
// title) plus the filtered amount total tag, right side has the compact-mode
// toggle. The export button lives alongside 查询/重置 in ReconcileFilters,
// mirroring usage-logs.
const ReconcileActions = ({ compactMode, setCompactMode, stat, t }) => {
  const tagStyle = {
    fontWeight: 500,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    padding: 13,
  };

  return (
    <div className='flex flex-col md:flex-row justify-between items-start md:items-center gap-2 w-full'>
      <Space wrap>
        <div className='flex items-center text-blue-500'>
          <BookOpenCheck size={16} className='mr-2' />
          <Text>{t('对账管理')}</Text>
        </div>
        <Tag color='blue' style={tagStyle} className='!rounded-lg'>
          {t('消耗额度合计')}: {formatCny(stat?.filtered_amount_cny)}
        </Tag>
      </Space>

      <CompactModeToggle
        compactMode={compactMode}
        setCompactMode={setCompactMode}
        t={t}
      />
    </div>
  );
};

export default ReconcileActions;
