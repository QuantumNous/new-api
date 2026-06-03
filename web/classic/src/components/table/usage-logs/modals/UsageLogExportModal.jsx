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

import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Button, Checkbox, Spin, Typography } from '@douyinfe/semi-ui';
import { IconDownload } from '@douyinfe/semi-icons';
import { API, showError, showSuccess } from '../../../../helpers';

const { Text } = Typography;

// Localized labels keyed by the backend group key. Falls back to the
// English label returned by the backend when a key is not mapped here.
const GROUP_LABEL_KEYS = {
  basic: '基础字段',
  cache: '缓存字段',
  advanced: '高级字段',
};

// Localized labels keyed by the backend field key.
const FIELD_LABEL_KEYS = {
  created_at: '创建时间',
  type: '类型',
  channel: '渠道',
  user: '用户',
  token_name: '令牌',
  model_name: '模型',
  group: '分组',
  use_time: '用时',
  prompt_tokens: '输入 Tokens',
  completion_tokens: '输出 Tokens',
  quota: '费用',
  details_summary: '详情',
  cache_read_tokens: '缓存读取 Tokens',
  cache_creation_tokens: '缓存创建 Tokens',
  cache_creation_tokens_5m: '5m 缓存创建 Tokens',
  cache_creation_tokens_1h: '1h 缓存创建 Tokens',
  record_id: '记录 ID',
  request_id: 'Request ID',
  upstream_request_id: '上游 Request ID',
  created_at_unix: '创建时间（Unix）',
  ip: 'IP',
  other_json: '其他 JSON',
};

const getBrowserTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch (e) {
    return '';
  }
};

const parseFilename = (disposition, fallback) => {
  if (!disposition) return fallback;
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (encoded && encoded[1]) {
    try {
      return decodeURIComponent(encoded[1]);
    } catch (e) {
      return encoded[1];
    }
  }
  const quoted = disposition.match(/filename="?([^";]+)"?/i);
  return (quoted && quoted[1]) || fallback;
};

// Reads an error message out of an axios error whose response body is a Blob
// (the backend returns JSON errors even for blob requests).
const extractBlobErrorMessage = async (error) => {
  const data = error?.response?.data;
  if (data instanceof Blob) {
    const text = await data.text();
    if (text) {
      try {
        return JSON.parse(text).message || text;
      } catch (e) {
        return text;
      }
    }
  }
  return null;
};

const UsageLogExportModal = ({
  showExportModal,
  setShowExportModal,
  isAdminUser,
  getFormValues,
  t,
}) => {
  const [loadingFields, setLoadingFields] = useState(false);
  const [groups, setGroups] = useState([]);
  const [selectedFields, setSelectedFields] = useState(() => new Set());
  const [exporting, setExporting] = useState(false);

  const allFields = useMemo(
    () => groups.flatMap((group) => group.fields || []),
    [groups],
  );

  const selectedKeys = useMemo(
    () => allFields.map((f) => f.key).filter((key) => selectedFields.has(key)),
    [allFields, selectedFields],
  );

  const labelForField = (field) => {
    const key = FIELD_LABEL_KEYS[field.key];
    return key ? t(key) : field.label || field.key;
  };

  const labelForGroup = (group) => {
    const key = GROUP_LABEL_KEYS[group.key];
    return key ? t(key) : group.label || group.key;
  };

  const loadFields = async () => {
    setLoadingFields(true);
    try {
      const path = isAdminUser
        ? '/api/log/export_fields'
        : '/api/log/self/export_fields';
      const res = await API.get(path);
      const { success, message, data } = res.data;
      if (!success) {
        showError(message || t('加载导出字段失败'));
        setGroups([]);
        return;
      }
      const nextGroups = Array.isArray(data) ? data : [];
      setGroups(nextGroups);
      const defaults = new Set();
      nextGroups.forEach((group) => {
        (group.fields || []).forEach((field) => {
          if (field.default) {
            defaults.add(field.key);
          }
        });
      });
      setSelectedFields(defaults);
    } catch (error) {
      showError(error);
      setGroups([]);
    } finally {
      setLoadingFields(false);
    }
  };

  useEffect(() => {
    if (showExportModal) {
      loadFields();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showExportModal]);

  const toggleField = (key, checked) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  };

  const toggleGroup = (group, checked) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      (group.fields || []).forEach((field) => {
        if (checked) {
          next.add(field.key);
        } else {
          next.delete(field.key);
        }
      });
      return next;
    });
  };

  const selectAll = () => {
    setSelectedFields(new Set(allFields.map((field) => field.key)));
  };

  const clearAll = () => {
    setSelectedFields(new Set());
  };

  const handleExport = async () => {
    if (selectedKeys.length === 0) {
      showError(t('请至少选择一个导出字段'));
      return;
    }
    setExporting(true);
    try {
      const formValues = getFormValues ? getFormValues() : {};
      const params = new URLSearchParams();
      params.set('type', String(formValues.logType ?? 0));

      const startTimestamp = Date.parse(formValues.start_timestamp) / 1000;
      const endTimestamp = Date.parse(formValues.end_timestamp) / 1000;
      if (!Number.isNaN(startTimestamp)) {
        params.set('start_timestamp', String(Math.floor(startTimestamp)));
      }
      if (!Number.isNaN(endTimestamp)) {
        params.set('end_timestamp', String(Math.floor(endTimestamp)));
      }
      if (formValues.model_name)
        params.set('model_name', formValues.model_name);
      if (formValues.token_name)
        params.set('token_name', formValues.token_name);
      if (formValues.group) params.set('group', formValues.group);
      if (formValues.request_id)
        params.set('request_id', formValues.request_id);
      if (isAdminUser) {
        if (formValues.username) params.set('username', formValues.username);
        if (formValues.channel)
          params.set('channel', String(formValues.channel));
      }
      params.set('fields', selectedKeys.join(','));
      const timezone = getBrowserTimezone();
      if (timezone) params.set('timezone', timezone);

      const path = isAdminUser ? '/api/log/export' : '/api/log/self/export';
      const res = await API.get(`${path}?${params.toString()}`, {
        responseType: 'blob',
        disableDuplicate: true,
        skipErrorHandler: true,
      });

      const blob = res.data;
      const contentType = res.headers?.['content-type'] || blob.type || '';
      if (contentType.includes('application/json')) {
        const text = await blob.text();
        let message = text || t('导出失败');
        try {
          message = JSON.parse(text).message || message;
        } catch (e) {
          // keep raw text when it is not valid JSON
        }
        throw new Error(message);
      }

      const filename = parseFilename(
        res.headers?.['content-disposition'] || '',
        'usage-logs.xlsx',
      );
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      showSuccess(t('导出已开始'));
      setShowExportModal(false);
    } catch (error) {
      const blobMessage = await extractBlobErrorMessage(error);
      if (blobMessage) {
        showError(blobMessage);
      } else {
        showError(error);
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal
      title={t('导出使用日志')}
      visible={showExportModal}
      onCancel={() => setShowExportModal(false)}
      maskClosable={!exporting}
      width={640}
      footer={
        <div className='flex justify-end gap-2'>
          <Button
            onClick={() => setShowExportModal(false)}
            disabled={exporting}
          >
            {t('取消')}
          </Button>
          <Button
            theme='solid'
            type='primary'
            icon={<IconDownload />}
            loading={exporting}
            disabled={loadingFields || selectedKeys.length === 0}
            onClick={handleExport}
          >
            {t('导出 Excel')}
          </Button>
        </div>
      }
    >
      <div className='mb-3'>
        <Text type='tertiary'>{t('选择需要导出到 Excel 的字段')}</Text>
      </div>

      <div className='flex items-center justify-between mb-3'>
        <Text type='tertiary'>
          {t('已选择 {{num}} 个字段', { num: selectedKeys.length })}
        </Text>
        <div className='flex gap-2'>
          <Button
            size='small'
            theme='borderless'
            onClick={selectAll}
            disabled={allFields.length === 0}
          >
            {t('全选')}
          </Button>
          <Button
            size='small'
            theme='borderless'
            onClick={clearAll}
            disabled={selectedKeys.length === 0}
          >
            {t('清空')}
          </Button>
        </div>
      </div>

      {loadingFields ? (
        <div className='flex justify-center items-center py-10'>
          <Spin />
        </div>
      ) : (
        <div className='flex flex-col gap-3 max-h-96 overflow-y-auto'>
          {groups.map((group) => {
            const fields = group.fields || [];
            const groupSelectedCount = fields.filter((field) =>
              selectedFields.has(field.key),
            ).length;
            const groupChecked =
              fields.length > 0 && groupSelectedCount === fields.length;
            const groupIndeterminate = groupSelectedCount > 0 && !groupChecked;

            return (
              <section
                key={group.key}
                className='rounded-lg p-3'
                style={{ border: '1px solid var(--semi-color-border)' }}
              >
                <div className='flex items-center justify-between mb-3'>
                  <div className='flex items-center gap-2'>
                    <span style={{ fontWeight: 600 }}>
                      {labelForGroup(group)}
                    </span>
                    <Text type='tertiary' size='small'>
                      {groupSelectedCount}/{fields.length}
                    </Text>
                  </div>
                  <Checkbox
                    checked={groupChecked}
                    indeterminate={groupIndeterminate}
                    onChange={(e) => toggleGroup(group, e.target.checked)}
                  >
                    {t('选择本组')}
                  </Checkbox>
                </div>
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
                  {fields.map((field) => (
                    <Checkbox
                      key={field.key}
                      checked={selectedFields.has(field.key)}
                      onChange={(e) => toggleField(field.key, e.target.checked)}
                    >
                      {labelForField(field)}
                    </Checkbox>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </Modal>
  );
};

export default UsageLogExportModal;
