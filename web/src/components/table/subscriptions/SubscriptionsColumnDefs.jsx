/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React from 'react';
import { Button, Modal, Space, Tag } from '@douyinfe/semi-ui';

const quotaTypeLabel = (quotaType) => (quotaType === 1 ? '按次' : '按量');

function formatDuration(plan, t) {
  if (!plan) return '';
  const u = plan.duration_unit || 'month';
  if (u === 'custom') {
    return `${t('自定义')} ${plan.custom_seconds || 0}s`;
  }
  const unitMap = {
    year: t('年'),
    month: t('月'),
    day: t('日'),
    hour: t('小时'),
  };
  return `${plan.duration_value || 0}${unitMap[u] || u}`;
}

const renderPlanTitle = (text, record) => {
  return (
    <div>
      <div className='font-medium'>{text}</div>
      {record?.plan?.subtitle ? (
        <div className='text-xs text-gray-500'>{record.plan.subtitle}</div>
      ) : null}
    </div>
  );
};

const renderPrice = (text, record) => {
  return `${record?.plan?.currency || 'USD'} ${Number(text || 0).toFixed(2)}`;
};

const renderDuration = (text, record, t) => {
  return formatDuration(record?.plan, t);
};

const renderEnabled = (text, record) => {
  return text ? (
    <Tag color='green' shape='circle'>
      启用
    </Tag>
  ) : (
    <Tag color='grey' shape='circle'>
      禁用
    </Tag>
  );
};

const renderModels = (text, record, t) => {
  const items = record?.items || [];
  if (items.length === 0) {
    return <div className='text-xs text-gray-500'>{t('无模型')}</div>;
  }
  return (
    <div className='text-xs space-y-1'>
      {items.slice(0, 3).map((it, idx) => (
        <div key={idx}>
          {it.model_name} ({quotaTypeLabel(it.quota_type)}: {it.amount_total})
        </div>
      ))}
      {items.length > 3 && (
        <div className='text-gray-500'>...{t('共')} {items.length} {t('个模型')}</div>
      )}
    </div>
  );
};

const renderOperations = (text, record, { openEdit, disablePlan, t }) => {
  const handleDisable = () => {
    Modal.confirm({
      title: t('确认禁用'),
      content: t('禁用后用户端不再展示，但历史订单不受影响。是否继续？'),
      centered: true,
      onOk: () => disablePlan(record?.plan?.id),
    });
  };

  return (
    <Space>
      <Button
        type='tertiary'
        size='small'
        onClick={() => {
          openEdit(record);
        }}
      >
        {t('编辑')}
      </Button>
      <Button type='danger' size='small' onClick={handleDisable}>
        {t('禁用')}
      </Button>
    </Space>
  );
};

export const getSubscriptionsColumns = ({ t, openEdit, disablePlan }) => {
  return [
    {
      title: 'ID',
      dataIndex: ['plan', 'id'],
      width: 80,
    },
    {
      title: t('标题'),
      dataIndex: ['plan', 'title'],
      render: (text, record) => renderPlanTitle(text, record),
    },
    {
      title: t('价格'),
      dataIndex: ['plan', 'price_amount'],
      width: 140,
      render: (text, record) => renderPrice(text, record),
    },
    {
      title: t('有效期'),
      width: 140,
      render: (text, record) => renderDuration(text, record, t),
    },
    {
      title: t('状态'),
      dataIndex: ['plan', 'enabled'],
      width: 90,
      render: (text, record) => renderEnabled(text, record),
    },
    {
      title: t('模型权益'),
      width: 200,
      render: (text, record) => renderModels(text, record, t),
    },
    {
      title: '',
      dataIndex: 'operate',
      fixed: 'right',
      width: 180,
      render: (text, record) =>
        renderOperations(text, record, { openEdit, disablePlan, t }),
    },
  ];
};
