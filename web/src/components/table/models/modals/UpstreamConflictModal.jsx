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

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Modal,
  Table,
  Checkbox,
  Typography,
  Empty,
  Tag,
  Popover,
  Input,
} from '@douyinfe/semi-ui';
import { MousePointerClick } from 'lucide-react';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import { MODEL_TABLE_PAGE_SIZE } from '../../../../constants';
import { IconSearch } from '@douyinfe/semi-icons';

const { Text } = Typography;

const FIELD_LABELS = {
  description: '描述',
  icon: '图标',
  tags: '标签',
  vendor: '供应商',
  name_rule: '命名规则',
  status: '状态',
};
const FIELD_KEYS = Object.keys(FIELD_LABELS);

const UpstreamConflictModal = ({
  visible,
  onClose,
  conflicts = [],
  onSubmit,
  t,
  loading = false,
}) => {
  const [selections, setSelections] = useState({});
  const isMobile = useIsMobile();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchKeyword, setSearchKeyword] = useState('');

  const formatValue = (v) => {
    if (v === null || v === undefined) return '-';
    if (typeof v === 'string') return v || '-';
    try {
      return JSON.stringify(v, null, 2);
    } catch (_) {
      return String(v);
    }
  };

  useEffect(() => {
    if (visible) {
      const init = {};
      conflicts.forEach((item) => {
        init[item.model_name] = new Set();
      });
      setSelections(init);
      setCurrentPage(1);
      setSearchKeyword('');
    } else {
      setSelections({});
    }
  }, [visible, conflicts]);

  const toggleField = useCallback((modelName, field, checked) => {
    setSelections((prev) => {
      const next = { ...prev };
      const set = new Set(next[modelName] || []);
      if (checked) set.add(field);
      else set.delete(field);
      next[modelName] = set;
      return next;
    });
  }, []);

  // 构造数据源与过滤后的数据源
  const dataSource = useMemo(
    () =>
      (conflicts || []).map((c) => ({
        key: c.model_name,
        model_name: c.model_name,
        fields: c.fields || [],
      })),
    [conflicts],
  );

  const filteredDataSource = useMemo(() => {
    const kw = (searchKeyword || '').toLowerCase();
    if (!kw) return dataSource;
    return dataSource.filter((item) =>
      (item.model_name || '').toLowerCase().includes(kw),
    );
  }, [dataSource, searchKeyword]);

  // 列头工具：当前过滤范围内可操作的行集合/勾选状态/批量设置
  const getPresentRowsForField = useCallback(
    (fieldKey) =>
      (filteredDataSource || []).filter((row) =>
        (row.fields || []).some((f) => f.field === fieldKey),
      ),
    [filteredDataSource],
  );

  const getHeaderState = useCallback(
    (fieldKey) => {
      const presentRows = getPresentRowsForField(fieldKey);
      const selectedCount = presentRows.filter((row) =>
        selections[row.model_name]?.has(fieldKey),
      ).length;
      const allCount = presentRows.length;
      return {
        headerChecked: allCount > 0 && selectedCount === allCount,
        headerIndeterminate: selectedCount > 0 && selectedCount < allCount,
        hasAny: allCount > 0,
      };
    },
    [getPresentRowsForField, selections],
  );

  const applyHeaderChange = useCallback(
    (fieldKey, checked) => {
      setSelections((prev) => {
        const next = { ...prev };
        getPresentRowsForField(fieldKey).forEach((row) => {
          const set = new Set(next[row.model_name] || []);
          if (checked) set.add(fieldKey);
          else set.delete(fieldKey);
          next[row.model_name] = set;
        });
        return next;
      });
    },
    [getPresentRowsForField],
  );

  const columns = useMemo(() => {
    const base = [
      {
        title: t('模型'),
        dataIndex: 'model_name',
        fixed: 'left',
        render: (text) => <Text strong>{text}</Text>,
      },
    ];

    const cols = FIELD_KEYS.map((fieldKey) => {
      const rawLabel = FIELD_LABELS[fieldKey] || fieldKey;
      const label = t(rawLabel);

      const { headerChecked, headerIndeterminate, hasAny } =
        getHeaderState(fieldKey);
      if (!hasAny) return null;
      const onHeaderChange = (e) =>
        applyHeaderChange(fieldKey, e?.target?.checked);

      return {
        title: (
          <div className='flex items-center gap-2'>
            <Checkbox
              checked={headerChecked}
              indeterminate={headerIndeterminate}
              onChange={onHeaderChange}
            />
            <Text>{label}</Text>
          </div>
        ),
        dataIndex: fieldKey,
        render: (_, record) => {
          const f = (record.fields || []).find((x) => x.field === fieldKey);
          if (!f) return <Text type='tertiary'>-</Text>;
          const checked = selections[record.model_name]?.has(fieldKey) || false;
          return (
            <Checkbox
              checked={checked}
              onChange={(e) =>
                toggleField(record.model_name, fieldKey, e?.target?.checked)
              }
            >
              <Popover
                trigger='hover'
                position='top'
                content={
                  <div className='p-2 max-w-[520px]'>
                    <div className='mb-2'>
                      <Text type='tertiary' size='small'>
                        {t('本地')}
                      </Text>
                      <pre className='whitespace-pre-wrap m-0'>
                        {formatValue(f.local)}
                      </pre>
                    </div>
                    <div>
                      <Text type='tertiary' size='small'>
                        {t('官方')}
                      </Text>
                      <pre className='whitespace-pre-wrap m-0'>
                        {formatValue(f.upstream)}
                      </pre>
                    </div>
                  </div>
                }
              >
                <Tag
                  color='white'
                  size='small'
                  prefixIcon={<MousePointerClick size={14} />}
                >
                  {t('点击查看差异')}
                </Tag>
              </Popover>
            </Checkbox>
          );
        },
      };
    });

    return [...base, ...cols.filter(Boolean)];
  }, [
    t,
    selections,
    filteredDataSource,
    getHeaderState,
    applyHeaderChange,
    toggleField,
  ]);

  const pagedDataSource = useMemo(() => {
    const start = (currentPage - 1) * MODEL_TABLE_PAGE_SIZE;
    const end = start + MODEL_TABLE_PAGE_SIZE;
    return filteredDataSource.slice(start, end);
  }, [filteredDataSource, currentPage]);

  const handleOk = async () => {
    const payload = Object.entries(selections)
      .map(([modelName, set]) => ({
        model_name: modelName,
        fields: Array.from(set || []),
      }))
      .filter((x) => x.fields.length > 0);

    const ok = await onSubmit?.(payload);
    if (ok) onClose?.();
  };

  return (
    <Modal
      title={t('选择要覆盖的冲突项')}
      visible={visible}
      onCancel={onClose}
      onOk={handleOk}
      confirmLoading={loading}
      okText={t('应用覆盖')}
      cancelText={t('取消')}
      width={isMobile ? '100%' : 1000}
    >
      {dataSource.length === 0 ? (
        <Empty description={t('无冲突项')} className='p-6' />
      ) : (
        <>
          <div className='mb-3 text-[var(--semi-color-text-2)]'>
            {t('仅会覆盖你勾选的字段，未勾选的字段保持本地不变。')}
          </div>
          {/* 搜索框 */}
          <div className='flex items-center justify-end gap-2 w-full mb-4'>
            <Input
              placeholder={t('搜索模型...')}
              value={searchKeyword}
              onChange={(v) => {
                setSearchKeyword(v);
                setCurrentPage(1);
              }}
              className='!w-full'
              prefix={<IconSearch />}
              showClear
            />
          </div>
          {filteredDataSource.length > 0 ? (
            <Table
              columns={columns}
              dataSource={pagedDataSource}
              pagination={{
                currentPage: currentPage,
                pageSize: MODEL_TABLE_PAGE_SIZE,
                total: filteredDataSource.length,
                showSizeChanger: false,
                onPageChange: (page) => setCurrentPage(page),
              }}
              scroll={{ x: 'max-content' }}
            />
          ) : (
            <Empty
              description={
                searchKeyword ? t('未找到匹配的模型') : t('无冲突项')
              }
              className='p-6'
            />
          )}
        </>
      )}
    </Modal>
  );
};

export default UpstreamConflictModal;
