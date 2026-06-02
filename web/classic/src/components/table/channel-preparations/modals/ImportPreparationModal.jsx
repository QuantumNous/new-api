import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Input,
  InputNumber,
  Modal,
  Progress,
  Select,
  Table,
  TextArea,
  Typography,
} from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import {
  API,
  buildGroupOptions,
  getChannelModels,
  loadChannelModels,
  showError,
} from '../../../../helpers';

const DEFAULT_GROUP = 'default';
const ANTHROPIC_CHANNEL_TYPE = 14;

const generateTimestamp = () => {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`;
};

const generateChannelName = (balance, suffix, timestamp) => {
  return `${timestamp}-${balance}-${suffix}`;
};

const parseBatchInput = (text, suffix, timestamp) => {
  const entries = [];
  const errors = [];
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line, index) => {
      const parts = line
        .split(/\t+|\s{2,}/)
        .map((item) => item.trim())
        .filter(Boolean);
      if (parts.length < 2) {
        errors.push({ line: index + 1, message: '格式应为：余额<Tab>Key' });
        return;
      }
      const balance = Number(parts[0]);
      const key = parts.slice(1).join('').trim();
      if (!key) {
        errors.push({ line: index + 1, message: 'Key 不能为空' });
        return;
      }
      entries.push({
        name: generateChannelName(
          Number.isFinite(balance) ? balance : 0,
          suffix,
          timestamp,
        ),
        balance: Number.isFinite(balance) ? balance : 0,
        key,
      });
    });
  return { entries, errors };
};

const ImportPreparationModal = ({ visible, onCancel, onSubmit }) => {
  const { t } = useTranslation();
  const [inputText, setInputText] = useState('');
  const [nameSuffix, setNameSuffix] = useState('');
  const [models, setModels] = useState('');
  const [group, setGroup] = useState(DEFAULT_GROUP);
  const [priority, setPriority] = useState(0);
  const [weight, setWeight] = useState(0);
  const [groupOptions, setGroupOptions] = useState([
    { label: DEFAULT_GROUP, value: DEFAULT_GROUP },
  ]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState([]);
  const timestamp = useMemo(() => generateTimestamp(), [visible]);

  useEffect(() => {
    if (!visible) return;
    loadChannelModels().catch(() => {});
    API.get('/api/group/')
      .then((res) => {
        setGroupOptions(buildGroupOptions(res?.data?.data, DEFAULT_GROUP));
      })
      .catch((error) => showError(error.message));
  }, [visible]);

  const defaultModels = useMemo(
    () => getChannelModels(ANTHROPIC_CHANNEL_TYPE).join(','),
    [],
  );
  const parsed = useMemo(
    () => parseBatchInput(inputText, nameSuffix, timestamp),
    [inputText, nameSuffix, timestamp],
  );
  const progress =
    parsed.entries.length === 0
      ? 0
      : Math.round(
          (results.filter((item) => item.ok).length / parsed.entries.length) *
            100,
        );

  const reset = () => {
    setInputText('');
    setNameSuffix('');
    setModels('');
    setGroup(DEFAULT_GROUP);
    setPriority(0);
    setWeight(0);
    setResults([]);
    setImporting(false);
  };

  const handleCancel = () => {
    reset();
    onCancel();
  };

  const handleImport = async () => {
    if (parsed.entries.length === 0) return;
    setImporting(true);
    setResults([]);
    try {
      const finalModels = models.trim();
      const items = parsed.entries.map((entry) => ({
        name: entry.name,
        type: ANTHROPIC_CHANNEL_TYPE,
        key: entry.key,
        models: finalModels,
        group,
        balance: entry.balance,
        priority: Number(priority) || 0,
        weight: Number(weight) || 0,
        auto_ban: 1,
        source: 'batch_import',
      }));
      const importResults = await onSubmit(items);
      setResults(importResults);
    } catch (error) {
      showError(error.message || t('导入失败'));
    } finally {
      setImporting(false);
    }
  };

  const previewColumns = [
    { title: t('名称'), dataIndex: 'name', key: 'name' },
    { title: t('余额'), dataIndex: 'balance', key: 'balance', width: 100 },
    {
      title: 'Key',
      dataIndex: 'key',
      key: 'key',
      render: (value) => `${value.slice(0, 8)}...${value.slice(-4)}`,
    },
  ];

  return (
    <Modal
      title={t('导入候选渠道')}
      visible={visible}
      onCancel={handleCancel}
      footer={
        <div className='flex justify-end gap-2'>
          <Button onClick={handleCancel}>{t('关闭')}</Button>
          <Button
            type='primary'
            loading={importing}
            disabled={parsed.entries.length === 0 || parsed.errors.length > 0}
            onClick={handleImport}
          >
            {t('导入到备货池')}
          </Button>
        </div>
      }
      style={{ width: 860 }}
    >
      <div className='space-y-3'>
        <Typography.Text type='secondary'>
          {t('每行格式：余额<Tab>Key。导入后只进入备货池，不会创建正式渠道。')}
        </Typography.Text>
        <TextArea
          value={inputText}
          onChange={setInputText}
          rows={8}
          placeholder={'12.5\tsk-ant-...'}
        />
        <div className='grid grid-cols-1 md:grid-cols-4 gap-3'>
          <div>
            <div className='mb-1 font-semibold'>{t('名称后缀')}</div>
            <Input value={nameSuffix} onChange={setNameSuffix} />
          </div>
          <div>
            <div className='mb-1 font-semibold'>{t('分组')}</div>
            <Select
              value={group}
              optionList={groupOptions}
              onChange={(value) => setGroup(value || DEFAULT_GROUP)}
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <div className='mb-1 font-semibold'>{t('优先级')}</div>
            <InputNumber
              value={priority}
              onChange={(value) => setPriority(value ?? 0)}
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <div className='mb-1 font-semibold'>{t('权重')}</div>
            <InputNumber
              value={weight}
              min={0}
              onChange={(value) => setWeight(value ?? 0)}
              style={{ width: '100%' }}
            />
          </div>
        </div>
        <div>
          <div className='mb-1 font-semibold'>{t('模型')}</div>
          <TextArea
            value={models}
            onChange={setModels}
            rows={2}
            placeholder={defaultModels || t('不填则使用 Claude 默认模型')}
          />
        </div>
        {parsed.errors.length > 0 ? (
          <div className='text-red-500 text-sm'>
            {parsed.errors
              .map((error) => `#${error.line}: ${error.message}`)
              .join('；')}
          </div>
        ) : null}
        <Progress
          percent={progress}
          showInfo
          style={{ display: results.length > 0 ? 'block' : 'none' }}
        />
        <Table
          columns={previewColumns}
          dataSource={parsed.entries}
          pagination={false}
          size='small'
        />
      </div>
    </Modal>
  );
};

export default ImportPreparationModal;
