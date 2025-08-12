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
import { Button, Space, Tag, Typography, Modal, Tooltip } from '@douyinfe/semi-ui';
import {
  timestamp2string,
  getLobeHubIcon,
  stringToColor
} from '../../../helpers';
import { renderLimitedItems, renderDescription } from '../../common/ui/RenderUtils';

const { Text } = Typography;

// Render timestamp
function renderTimestamp(timestamp) {
  return <>{timestamp2string(timestamp)}</>;
}

// Render model icon column: prefer model.icon, then fallback to vendor icon
const renderModelIconCol = (record, vendorMap) => {
  const iconKey = record?.icon || vendorMap[record?.vendor_id]?.icon;
  if (!iconKey) return '-';
  return (
    <div className="flex items-center justify-center">
      {getLobeHubIcon(iconKey, 20)}
    </div>
  );
};

// Render vendor column with icon
const renderVendorTag = (vendorId, vendorMap, t) => {
  if (!vendorId || !vendorMap[vendorId]) return '-';
  const v = vendorMap[vendorId];
  return (
    <Tag
      color='white'
      shape='circle'
      prefixIcon={getLobeHubIcon(v.icon || 'Layers', 14)}
    >
      {v.name}
    </Tag>
  );
};

// Render groups (enable_groups)
const renderGroups = (groups) => {
  if (!groups || groups.length === 0) return '-';
  return renderLimitedItems({
    items: groups,
    renderItem: (g, idx) => (
      <Tag key={idx} size="small" shape='circle' color={stringToColor(g)}>
        {g}
      </Tag>
    ),
  });
};

// Render tags
const renderTags = (text) => {
  if (!text) return '-';
  const tagsArr = text.split(',').filter(Boolean);
  return renderLimitedItems({
    items: tagsArr,
    renderItem: (tag, idx) => (
      <Tag key={idx} size="small" shape='circle' color={stringToColor(tag)}>
        {tag}
      </Tag>
    ),
  });
};

// Render endpoints (supports object map or legacy array)
const renderEndpoints = (value) => {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const keys = Object.keys(parsed || {});
      if (keys.length === 0) return '-';
      return renderLimitedItems({
        items: keys,
        renderItem: (key, idx) => (
          <Tag key={idx} size="small" shape='circle' color={stringToColor(key)}>
            {key}
          </Tag>
        ),
        maxDisplay: 3,
      });
    }
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) return '-';
      return renderLimitedItems({
        items: parsed,
        renderItem: (ep, idx) => (
          <Tag key={idx} color="white" size="small" shape='circle'>
            {ep}
          </Tag>
        ),
        maxDisplay: 3,
      });
    }
    return value || '-';
  } catch (_) {
    return value || '-';
  }
};

// Render quota types (array) using common limited items renderer
const renderQuotaTypes = (arr, t) => {
  if (!Array.isArray(arr) || arr.length === 0) return '-';
  return renderLimitedItems({
    items: arr,
    renderItem: (qt, idx) => {
      if (qt === 1) {
        return (
          <Tag key={`${qt}-${idx}`} color='teal' size='small' shape='circle'>
            {t('按次计费')}
          </Tag>
        );
      }
      if (qt === 0) {
        return (
          <Tag key={`${qt}-${idx}`} color='violet' size='small' shape='circle'>
            {t('按量计费')}
          </Tag>
        );
      }
      return (
        <Tag key={`${qt}-${idx}`} color='white' size='small' shape='circle'>
          {qt}
        </Tag>
      );
    },
    maxDisplay: 3,
  });
};

// Render bound channels
const renderBoundChannels = (channels) => {
  if (!channels || channels.length === 0) return '-';
  return renderLimitedItems({
    items: channels,
    renderItem: (c, idx) => (
      <Tag key={idx} color="white" size="small" shape='circle'>
        {c.name}({c.type})
      </Tag>
    ),
  });
};

// Render operations column
const renderOperations = (text, record, setEditingModel, setShowEdit, manageModel, refresh, t) => {
  return (
    <Space wrap>
      {record.status === 1 ? (
        <Button
          type='danger'
          size="small"
          onClick={() => manageModel(record.id, 'disable', record)}
        >
          {t('禁用')}
        </Button>
      ) : (
        <Button
          size="small"
          onClick={() => manageModel(record.id, 'enable', record)}
        >
          {t('启用')}
        </Button>
      )}

      <Button
        type='tertiary'
        size="small"
        onClick={() => {
          setEditingModel(record);
          setShowEdit(true);
        }}
      >
        {t('编辑')}
      </Button>

      <Button
        type='danger'
        size="small"
        onClick={() => {
          Modal.confirm({
            title: t('确定是否要删除此模型？'),
            content: t('此修改将不可逆'),
            onOk: () => {
              (async () => {
                await manageModel(record.id, 'delete', record);
                await refresh();
              })();
            },
          });
        }}
      >
        {t('删除')}
      </Button>
    </Space>
  );
};

// 名称匹配类型渲染（带匹配数量 Tooltip）
const renderNameRule = (rule, record, t) => {
  const map = {
    0: { color: 'green', label: t('精确') },
    1: { color: 'blue', label: t('前缀') },
    2: { color: 'orange', label: t('包含') },
    3: { color: 'purple', label: t('后缀') },
  };
  const cfg = map[rule];
  if (!cfg) return '-';

  let label = cfg.label;
  if (rule !== 0 && record.matched_count) {
    label = `${cfg.label} ${record.matched_count}${t('个模型')}`;
  }

  const tagElement = (
    <Tag color={cfg.color} size="small" shape='circle'>
      {label}
    </Tag>
  );

  if (rule === 0 || !record.matched_models || record.matched_models.length === 0) {
    return tagElement;
  }

  return (
    <Tooltip content={record.matched_models.join(', ')} showArrow>
      {tagElement}
    </Tooltip>
  );
};

export const getModelsColumns = ({
  t,
  manageModel,
  setEditingModel,
  setShowEdit,
  refresh,
  vendorMap,
}) => {
  return [
    {
      title: t('图标'),
      dataIndex: 'icon',
      width: 70,
      align: 'center',
      render: (text, record) => renderModelIconCol(record, vendorMap),
    },
    {
      title: t('模型名称'),
      dataIndex: 'model_name',
      render: (text) => (
        <Text copyable onClick={(e) => e.stopPropagation()}>
          {text}
        </Text>
      ),
    },
    {
      title: t('匹配类型'),
      dataIndex: 'name_rule',
      render: (val, record) => renderNameRule(val, record, t),
    },
    {
      title: t('描述'),
      dataIndex: 'description',
      render: (text) => renderDescription(text, 200),
    },
    {
      title: t('供应商'),
      dataIndex: 'vendor_id',
      render: (vendorId, record) => renderVendorTag(vendorId, vendorMap, t),
    },
    {
      title: t('标签'),
      dataIndex: 'tags',
      render: renderTags,
    },
    {
      title: t('端点'),
      dataIndex: 'endpoints',
      render: renderEndpoints,
    },
    {
      title: t('已绑定渠道'),
      dataIndex: 'bound_channels',
      render: renderBoundChannels,
    },
    {
      title: t('可用分组'),
      dataIndex: 'enable_groups',
      render: renderGroups,
    },
    {
      title: t('计费类型'),
      dataIndex: 'quota_types',
      render: (qts) => renderQuotaTypes(qts, t),
    },
    {
      title: t('创建时间'),
      dataIndex: 'created_time',
      render: (text, record, index) => {
        return <div>{renderTimestamp(text)}</div>;
      },
    },
    {
      title: t('更新时间'),
      dataIndex: 'updated_time',
      render: (text, record, index) => {
        return <div>{renderTimestamp(text)}</div>;
      },
    },
    {
      title: '',
      dataIndex: 'operate',
      fixed: 'right',
      render: (text, record, index) => renderOperations(
        text,
        record,
        setEditingModel,
        setShowEdit,
        manageModel,
        refresh,
        t
      ),
    },
  ];
};