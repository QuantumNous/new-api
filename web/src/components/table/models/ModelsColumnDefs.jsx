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

import React, { useState } from 'react';
import { Button, Tooltip } from '@heroui/react';
import { Copy } from 'lucide-react';
import {
  timestamp2string,
  getLobeHubIcon,
  stringToColor,
  copy,
  showSuccess,
} from '../../../helpers';
import {
  renderLimitedItems,
  renderDescription,
} from '../../common/ui/RenderUtils';
import ConfirmDialog from '@/components/common/ui/ConfirmDialog';

function StringTag({ children, color, tone }) {
  if (tone === 'teal') {
    return (
      <span className='inline-flex items-center rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-700 dark:bg-teal-950/40 dark:text-teal-300'>
        {children}
      </span>
    );
  }
  if (tone === 'violet') {
    return (
      <span className='inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-950/40 dark:text-violet-300'>
        {children}
      </span>
    );
  }
  if (tone === 'green') {
    return (
      <span className='inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'>
        {children}
      </span>
    );
  }
  if (tone === 'orange') {
    return (
      <span className='inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-950/40 dark:text-orange-300'>
        {children}
      </span>
    );
  }
  if (tone === 'blue') {
    return (
      <span className='inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'>
        {children}
      </span>
    );
  }
  if (tone === 'purple') {
    return (
      <span className='inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-950/40 dark:text-purple-300'>
        {children}
      </span>
    );
  }
  if (color === 'white') {
    return (
      <span className='inline-flex items-center gap-1 rounded-full border border-[color:var(--app-border)] bg-white px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-900 dark:text-slate-200'>
        {children}
      </span>
    );
  }
  // Use stringToColor → palette already returns Tailwind-friendly hex via the
  // helpers/render.jsx SEMI_TAG_PALETTE map. Render as light-tinted chip.
  return (
    <span
      className='inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium'
      style={{
        backgroundColor: `${color}1A`,
        color,
      }}
    >
      {children}
    </span>
  );
}

function CopyableText({ children, value }) {
  const handleCopy = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (await copy(value || '')) showSuccess('已复制');
  };
  return (
    <div className='group inline-flex items-center gap-1'>
      <span>{children}</span>
      <button
        type='button'
        onClick={handleCopy}
        aria-label='copy'
        className='inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted opacity-0 transition group-hover:opacity-100 hover:bg-[color:var(--app-background)] hover:text-foreground'
      >
        <Copy size={11} />
      </button>
    </div>
  );
}

function renderTimestamp(timestamp) {
  return <>{timestamp2string(timestamp)}</>;
}

const renderModelIconCol = (record, vendorMap) => {
  const iconKey = record?.icon || vendorMap[record?.vendor_id]?.icon;
  if (!iconKey) return '-';
  return (
    <div className='flex items-center justify-center'>
      {getLobeHubIcon(iconKey, 20)}
    </div>
  );
};

const renderVendorTag = (vendorId, vendorMap, t) => {
  if (!vendorId || !vendorMap[vendorId]) return '-';
  const v = vendorMap[vendorId];
  return (
    <span className='inline-flex items-center gap-1 rounded-full border border-[color:var(--app-border)] bg-white px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-900 dark:text-slate-200'>
      {getLobeHubIcon(v.icon || 'Layers', 14)}
      {v.name}
    </span>
  );
};

const renderGroups = (groups) => {
  if (!groups || groups.length === 0) return '-';
  return renderLimitedItems({
    items: groups,
    renderItem: (g, idx) => (
      <StringTag key={idx} color={stringToColor(g)}>
        {g}
      </StringTag>
    ),
  });
};

const renderTags = (text) => {
  if (!text) return '-';
  const tagsArr = text.split(',').filter(Boolean);
  return renderLimitedItems({
    items: tagsArr,
    renderItem: (tag, idx) => (
      <StringTag key={idx} color={stringToColor(tag)}>
        {tag}
      </StringTag>
    ),
  });
};

const renderEndpoints = (value) => {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const keys = Object.keys(parsed || {});
      if (keys.length === 0) return '-';
      return renderLimitedItems({
        items: keys,
        renderItem: (key, idx) => (
          <StringTag key={idx} color={stringToColor(key)}>
            {key}
          </StringTag>
        ),
        maxDisplay: 3,
      });
    }
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) return '-';
      return renderLimitedItems({
        items: parsed,
        renderItem: (ep, idx) => (
          <StringTag key={idx} color='white'>
            {ep}
          </StringTag>
        ),
        maxDisplay: 3,
      });
    }
    return value || '-';
  } catch (_) {
    return value || '-';
  }
};

const renderQuotaTypes = (arr, t) => {
  if (!Array.isArray(arr) || arr.length === 0) return '-';
  return renderLimitedItems({
    items: arr,
    renderItem: (qt, idx) => {
      if (qt === 1) {
        return (
          <StringTag key={`${qt}-${idx}`} tone='teal'>
            {t('按次计费')}
          </StringTag>
        );
      }
      if (qt === 0) {
        return (
          <StringTag key={`${qt}-${idx}`} tone='violet'>
            {t('按量计费')}
          </StringTag>
        );
      }
      return (
        <StringTag key={`${qt}-${idx}`} color='white'>
          {qt}
        </StringTag>
      );
    },
    maxDisplay: 3,
  });
};

const renderBoundChannels = (channels) => {
  if (!channels || channels.length === 0) return '-';
  return renderLimitedItems({
    items: channels,
    renderItem: (c, idx) => (
      <StringTag key={idx} color='white'>
        {c.name}({c.type})
      </StringTag>
    ),
  });
};

function OperationsCell({
  record,
  setEditingModel,
  setShowEdit,
  manageModel,
  refresh,
  t,
}) {
  const [showDelete, setShowDelete] = useState(false);

  return (
    <div className='flex flex-wrap items-center gap-1.5'>
      {record.status === 1 ? (
        <Button
          color='danger'
          variant='flat'
          size='sm'
          onPress={() => manageModel(record.id, 'disable', record)}
        >
          {t('禁用')}
        </Button>
      ) : (
        <Button
          variant='flat'
          size='sm'
          onPress={() => manageModel(record.id, 'enable', record)}
        >
          {t('启用')}
        </Button>
      )}

      <Button
        variant='light'
        size='sm'
        onPress={() => {
          setEditingModel(record);
          setShowEdit(true);
        }}
      >
        {t('编辑')}
      </Button>

      <Button
        color='danger'
        variant='flat'
        size='sm'
        onPress={() => setShowDelete(true)}
      >
        {t('删除')}
      </Button>

      <ConfirmDialog
        visible={showDelete}
        title={t('确定是否要删除此模型？')}
        cancelText={t('取消')}
        confirmText={t('删除')}
        danger
        onCancel={() => setShowDelete(false)}
        onConfirm={async () => {
          setShowDelete(false);
          await manageModel(record.id, 'delete', record);
          await refresh?.();
        }}
      >
        {t('此修改将不可逆')}
      </ConfirmDialog>
    </div>
  );
}

const renderOperations = (
  text,
  record,
  setEditingModel,
  setShowEdit,
  manageModel,
  refresh,
  t,
) => (
  <OperationsCell
    record={record}
    setEditingModel={setEditingModel}
    setShowEdit={setShowEdit}
    manageModel={manageModel}
    refresh={refresh}
    t={t}
  />
);

const renderNameRule = (rule, record, t) => {
  const map = {
    0: { tone: 'green', label: t('精确') },
    1: { tone: 'blue', label: t('前缀') },
    2: { tone: 'orange', label: t('包含') },
    3: { tone: 'purple', label: t('后缀') },
  };
  const cfg = map[rule];
  if (!cfg) return '-';

  let label = cfg.label;
  if (rule !== 0 && record.matched_count) {
    label = `${cfg.label} ${record.matched_count}${t('个模型')}`;
  }

  const tagElement = <StringTag tone={cfg.tone}>{label}</StringTag>;

  if (
    rule === 0 ||
    !record.matched_models ||
    record.matched_models.length === 0
  ) {
    return tagElement;
  }

  return (
    <Tooltip content={record.matched_models.join(', ')} placement='top'>
      <span>{tagElement}</span>
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
      render: (text) => <CopyableText value={text}>{text}</CopyableText>,
    },
    {
      title: t('匹配类型'),
      dataIndex: 'name_rule',
      render: (val, record) => renderNameRule(val, record, t),
    },
    {
      title: t('参与官方同步'),
      dataIndex: 'sync_official',
      render: (val) => (
        <StringTag tone={val === 1 ? 'green' : 'orange'}>
          {val === 1 ? t('是') : t('否')}
        </StringTag>
      ),
    },
    {
      title: t('描述'),
      dataIndex: 'description',
      render: (text) => renderDescription(text, 200),
    },
    {
      title: t('供应商'),
      dataIndex: 'vendor_id',
      render: (vendorId) => renderVendorTag(vendorId, vendorMap, t),
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
      render: (text) => <div>{renderTimestamp(text)}</div>,
    },
    {
      title: t('更新时间'),
      dataIndex: 'updated_time',
      render: (text) => <div>{renderTimestamp(text)}</div>,
    },
    {
      title: '',
      dataIndex: 'operate',
      fixed: 'right',
      render: (text, record) =>
        renderOperations(
          text,
          record,
          setEditingModel,
          setShowEdit,
          manageModel,
          refresh,
          t,
        ),
    },
  ];
};
