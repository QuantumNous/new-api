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

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Input,
  InputNumber,
  Select,
  Button,
  Table,
  Typography,
  Banner,
  Progress,
  Tag,
  Space,
  TextArea,
} from '@douyinfe/semi-ui';
import { IconUpload } from '@douyinfe/semi-icons';
import {
  API,
  buildGroupOptions,
  showSuccess,
  showError,
} from '../../../../helpers';
import { getChannelModels } from '../../../../helpers';

const { Text } = Typography;

// ============================================================================
// Constants
// ============================================================================

const ANTHROPIC_CHANNEL_TYPE = 14;
const DEFAULT_GROUP = 'default';

// ============================================================================
// Helpers
// ============================================================================

function pad(n) {
  return n.toString().padStart(2, '0');
}

function generateTimestamp() {
  const now = new Date();
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`;
}

function generateChannelName(balance, suffix, timestamp) {
  return `${timestamp}-${balance}-${suffix}`;
}

function parseBatchInput(text, suffix, timestamp) {
  const lines = text.split('\n');
  const entries = [];
  const errors = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Support both tab and multi-space separation
    const parts = line.split(/\t+|\s{2,}/);
    if (parts.length < 2) {
      errors.push(`${i + 1}: 格式错误，需要 "余额<Tab>密钥"`);
      continue;
    }

    const balanceStr = parts[0].trim();
    const key = parts.slice(1).join('').trim();

    const balance = Number(balanceStr);
    if (isNaN(balance)) {
      errors.push(`${i + 1}: 余额无效 "${balanceStr}"`);
      continue;
    }

    if (!key) {
      errors.push(`${i + 1}: 密钥为空`);
      continue;
    }

    entries.push({
      balance,
      key,
      name: generateChannelName(balance, suffix, timestamp),
      lineNumber: i + 1,
    });
  }

  return { entries, errors };
}

// ============================================================================
// Component
// ============================================================================

const BatchImportModal = ({ visible, onCancel, onSuccess }) => {
  const { t } = useTranslation();

  // Form state
  const [inputText, setInputText] = useState('');
  const [nameSuffix, setNameSuffix] = useState('');
  const [models, setModels] = useState('');
  const [group, setGroup] = useState(DEFAULT_GROUP);
  const [priority, setPriority] = useState(0);
  const [weight, setWeight] = useState(0);
  const [groupOptions, setGroupOptions] = useState([
    { label: DEFAULT_GROUP, value: DEFAULT_GROUP },
  ]);

  // Import state
  const [importState, setImportState] = useState('idle'); // idle | importing | done
  const [results, setResults] = useState([]);
  const [progress, setProgress] = useState(0);

  // Generate timestamp once per modal open
  const timestamp = useMemo(() => generateTimestamp(), [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Get default models for Anthropic
  const defaultModels = useMemo(() => {
    return getChannelModels(ANTHROPIC_CHANNEL_TYPE).join(',');
  }, []);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await API.get('/api/group/');
      setGroupOptions(buildGroupOptions(res?.data?.data, DEFAULT_GROUP));
    } catch (error) {
      showError(error.message);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      fetchGroups();
    }
  }, [visible, fetchGroups]);

  // Parse input for preview
  const parsed = useMemo(() => {
    if (!inputText.trim() || !nameSuffix.trim()) {
      return { entries: [], errors: [] };
    }
    return parseBatchInput(inputText, nameSuffix.trim(), timestamp);
  }, [inputText, nameSuffix, timestamp]);

  // Reset all state
  const resetState = useCallback(() => {
    setInputText('');
    setNameSuffix('');
    setModels('');
    setGroup(DEFAULT_GROUP);
    setPriority(0);
    setWeight(0);
    setImportState('idle');
    setResults([]);
    setProgress(0);
  }, []);

  // Handle cancel
  const handleCancel = useCallback(() => {
    if (importState === 'importing') return;
    resetState();
    onCancel();
  }, [importState, resetState, onCancel]);

  // Execute import
  const handleImport = useCallback(async () => {
    if (parsed.entries.length === 0) return;

    setImportState('importing');
    setResults([]);
    setProgress(0);

    const finalModels = models.trim() || defaultModels;
    const importResults = [];
    const total = parsed.entries.length;

    for (let i = 0; i < total; i++) {
      const entry = parsed.entries[i];
      try {
        const res = await API.post('/api/channel/', {
          mode: 'single',
          channel: {
            name: entry.name,
            type: ANTHROPIC_CHANNEL_TYPE,
            key: entry.key,
            models: finalModels,
            group: group,
            balance: entry.balance,
            status: 1,
            auto_ban: 1,
            weight: Number(weight) || 0,
            priority: Number(priority) || 0,
          },
        });

        if (res.data.success) {
          importResults.push({ entry, success: true });
        } else {
          importResults.push({
            entry,
            success: false,
            error: res.data.message || '未知错误',
          });
        }
      } catch (err) {
        importResults.push({
          entry,
          success: false,
          error: err?.response?.data?.message || err.message || '网络错误',
        });
      }

      setProgress(i + 1);
      setResults([...importResults]);
    }

    setImportState('done');

    const successCount = importResults.filter((r) => r.success).length;
    const failCount = importResults.filter((r) => !r.success).length;

    if (failCount === 0) {
      showSuccess(
        t('成功导入 {{count}} 个渠道').replace('{{count}}', successCount),
      );
    } else {
      showError(
        t('导入完成：成功 {{success}} 个，失败 {{fail}} 个')
          .replace('{{success}}', successCount)
          .replace('{{fail}}', failCount),
      );
    }

    if (onSuccess) onSuccess();
  }, [
    parsed.entries,
    models,
    defaultModels,
    group,
    weight,
    priority,
    onSuccess,
    t,
  ]);

  const canImport =
    importState === 'idle' &&
    parsed.entries.length > 0 &&
    parsed.errors.length === 0 &&
    nameSuffix.trim().length > 0;

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  // Table columns for preview
  const columns = [
    {
      title: '#',
      dataIndex: 'index',
      width: 50,
      render: (_, record, index) => index + 1,
    },
    {
      title: t('渠道名称'),
      dataIndex: 'name',
      width: 220,
      render: (text) => (
        <Text copyable style={{ fontFamily: 'monospace', fontSize: 12 }}>
          {text}
        </Text>
      ),
    },
    {
      title: t('余额'),
      dataIndex: 'balance',
      width: 80,
      align: 'right',
      render: (val) => `$${val}`,
    },
    {
      title: t('密钥前缀'),
      dataIndex: 'key',
      render: (text) => (
        <Text
          style={{
            fontFamily: 'monospace',
            fontSize: 12,
            color: 'var(--semi-color-text-2)',
          }}
        >
          {text.substring(0, 20)}...
        </Text>
      ),
    },
  ];

  // Add status column during import
  if (importState !== 'idle') {
    columns.push({
      title: t('状态'),
      dataIndex: 'status',
      width: 80,
      align: 'center',
      render: (_, record, index) => {
        const result = results[index];
        if (!result) {
          return index < progress ? (
            <Tag color='blue' size='small'>
              {t('进行中')}
            </Tag>
          ) : (
            <Tag color='grey' size='small'>
              {t('等待')}
            </Tag>
          );
        }
        return result.success ? (
          <Tag color='green' size='small'>
            {t('成功')}
          </Tag>
        ) : (
          <Tag
            color='red'
            size='small'
            style={{ cursor: 'pointer' }}
            onClick={() => showError(result.error)}
          >
            {t('失败')}
          </Tag>
        );
      },
    });
  }

  return (
    <Modal
      title={
        <span>
          <IconUpload style={{ marginRight: 8 }} />
          {t('批量导入 Claude 渠道')}
        </span>
      }
      visible={visible}
      onCancel={handleCancel}
      maskClosable={importState !== 'importing'}
      closable={importState !== 'importing'}
      width={700}
      footer={
        <Space>
          <Button onClick={handleCancel} disabled={importState === 'importing'}>
            {importState === 'done' ? t('关闭') : t('取消')}
          </Button>
          {importState !== 'done' && (
            <Button
              theme='solid'
              type='primary'
              onClick={handleImport}
              disabled={!canImport}
              loading={importState === 'importing'}
            >
              {importState === 'importing'
                ? t('导入中...')
                : t('导入 ({{count}} 条)').replace(
                    '{{count}}',
                    parsed.entries.length,
                  )}
            </Button>
          )}
        </Space>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Name Tag */}
        <div>
          <div style={{ marginBottom: 4, fontWeight: 600, fontSize: 14 }}>
            {t('名称标签')}
          </div>
          <Input
            placeholder={t('例如：liz')}
            value={nameSuffix}
            onChange={setNameSuffix}
            disabled={importState !== 'idle'}
          />
          <div
            style={{
              fontSize: 12,
              color: 'var(--semi-color-text-2)',
              marginTop: 4,
            }}
          >
            {t('渠道命名格式：{{format}}').replace(
              '{{format}}',
              `${timestamp}-{余额}-{标签}`,
            )}
          </div>
        </div>

        {/* Group */}
        <div>
          <div style={{ marginBottom: 4, fontWeight: 600, fontSize: 14 }}>
            {t('分组')}
          </div>
          <Select
            placeholder='default'
            value={group}
            optionList={groupOptions}
            onChange={(value) => setGroup(value || DEFAULT_GROUP)}
            disabled={importState !== 'idle'}
            style={{ width: '100%' }}
          />
        </div>

        {/* Priority and Weight */}
        <div
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
        >
          <div>
            <div style={{ marginBottom: 4, fontWeight: 600, fontSize: 14 }}>
              {t('优先级')}
            </div>
            <InputNumber
              value={priority}
              onChange={(value) => setPriority(value ?? 0)}
              disabled={importState !== 'idle'}
              min={-999}
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <div style={{ marginBottom: 4, fontWeight: 600, fontSize: 14 }}>
              {t('权重')}
            </div>
            <InputNumber
              value={weight}
              onChange={(value) => setWeight(value ?? 0)}
              disabled={importState !== 'idle'}
              min={0}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        {/* Input Data */}
        <div>
          <div style={{ marginBottom: 4, fontWeight: 600, fontSize: 14 }}>
            {t('导入数据')}{' '}
            <Text type='tertiary' size='small'>
              ({t('余额<Tab>密钥，每行一条')})
            </Text>
          </div>
          <TextArea
            placeholder={`139\tsk-ant-api03-xxxxx...\n114\tsk-ant-api03-yyyyy...`}
            value={inputText}
            onChange={setInputText}
            disabled={importState !== 'idle'}
            autosize={{ minRows: 4, maxRows: 8 }}
            style={{ fontFamily: 'monospace', fontSize: 12 }}
          />
        </div>

        {/* Parse Errors */}
        {parsed.errors.length > 0 && (
          <Banner
            type='danger'
            description={
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  {t('解析错误')}
                </div>
                {parsed.errors.map((err, i) => (
                  <div key={i} style={{ fontSize: 12 }}>
                    {t('第 {{line}} 行', { line: '' })}
                    {err}
                  </div>
                ))}
              </div>
            }
          />
        )}

        {/* Preview Table */}
        {parsed.entries.length > 0 && (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <Text strong>{t('预览')}</Text>
              <Text type='tertiary' size='small'>
                {t('共 {{count}} 条').replace(
                  '{{count}}',
                  parsed.entries.length,
                )}
              </Text>
            </div>
            <Table
              columns={columns}
              dataSource={parsed.entries}
              pagination={false}
              size='small'
              bordered
              style={{ maxHeight: 250, overflow: 'auto' }}
              rowKey='lineNumber'
            />
          </div>
        )}

        {/* Progress during import */}
        {importState === 'importing' && (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 4,
              }}
            >
              <Text size='small' type='tertiary'>
                {t('导入中...')} {progress}/{parsed.entries.length}
              </Text>
              <Text size='small' type='tertiary'>
                {Math.round((progress / parsed.entries.length) * 100)}%
              </Text>
            </div>
            <Progress
              percent={Math.round((progress / parsed.entries.length) * 100)}
              showInfo={false}
            />
          </div>
        )}

        {/* Results summary */}
        {importState === 'done' && (
          <Banner
            type={failCount === 0 ? 'success' : 'warning'}
            description={
              <Space>
                <span>
                  <Tag color='green' size='small' style={{ marginRight: 4 }}>
                    {t('✓')}
                  </Tag>
                  {t('成功 {{count}} 个').replace('{{count}}', successCount)}
                </span>
                {failCount > 0 && (
                  <span>
                    <Tag color='red' size='small' style={{ marginRight: 4 }}>
                      {t('✗')}
                    </Tag>
                    {t('失败 {{count}} 个').replace('{{count}}', failCount)}
                  </span>
                )}
              </Space>
            }
          />
        )}
      </div>
    </Modal>
  );
};

export default BatchImportModal;
