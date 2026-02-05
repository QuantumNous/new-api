import React, { useMemo } from 'react';
import {
  Table,
  Select,
  Typography,
  Button,
  Tooltip,
  Empty,
} from '@douyinfe/semi-ui';
import { IconDelete } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

const ModelGroupMappingEditor = ({
  models = [],
  value = { specificRules: {} },
  onChange,
  allGroups = [],
  channelGroups = [],
  disabled = false,
}) => {
  const { t } = useTranslation();

  // 缓存 optionList 避免重复渲染
  const groupOptions = useMemo(
    () => allGroups.map((g) => ({ label: g, value: g })),
    [allGroups],
  );

  // 已配置自定义分组的模型列表
  const configuredModels = useMemo(() => {
    return Object.keys(value.specificRules || {}).filter(
      (model) => models.includes(model),
    );
  }, [value.specificRules, models]);

  // 可添加的模型列表（排除已配置的）
  const availableModels = useMemo(() => {
    const configured = new Set(Object.keys(value.specificRules || {}));
    return models.filter((m) => !configured.has(m));
  }, [models, value.specificRules]);

  const handleAddModel = (model) => {
    if (!model) return;
    onChange({
      ...value,
      specificRules: {
        ...value.specificRules,
        [model]: channelGroups.length > 0 ? channelGroups : ['default'],
      },
    });
  };

  const handleSpecificChange = (model, groups) => {
    onChange({
      ...value,
      specificRules: { ...value.specificRules, [model]: groups },
    });
  };

  const handleRemove = (model) => {
    const newRules = { ...value.specificRules };
    delete newRules[model];
    onChange({ ...value, specificRules: newRules });
  };

  const columns = [
    {
      title: t('模型名称'),
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (text) => (
        <Text strong ellipsis={{ showTooltip: true }}>
          {text}
        </Text>
      ),
    },
    {
      title: t('分组配置'),
      dataIndex: 'groups',
      key: 'groups',
      render: (_, record) => {
        const currentGroups = value.specificRules[record.name] || [];
        return (
          <Select
            multiple
            value={currentGroups}
            onChange={(v) => handleSpecificChange(record.name, v)}
            optionList={groupOptions}
            placeholder={t('请选择分组')}
            disabled={disabled}
            filter
            maxTagCount={3}
            style={{ width: '100%' }}
            emptyContent={t('无可用分组')}
          />
        );
      },
    },
    {
      title: '',
      key: 'action',
      width: 60,
      render: (_, record) => (
        <Tooltip content={t('删除')}>
          <Button
            icon={<IconDelete />}
            type='danger'
            theme='borderless'
            size='small'
            onClick={() => handleRemove(record.name)}
            disabled={disabled}
          />
        </Tooltip>
      ),
    },
  ];

  const dataSource = configuredModels.map((m) => ({ key: m, name: m }));

  return (
    <div className='model-group-config'>
      <div style={{ marginBottom: 16 }}>
        <Select
          placeholder={t('选择模型添加单独配置')}
          optionList={availableModels.map((m) => ({ label: m, value: m }))}
          onChange={handleAddModel}
          value={undefined}
          disabled={disabled || availableModels.length === 0}
          filter
          style={{ width: '100%' }}
          emptyContent={t('无可添加的模型')}
        />
      </div>

      {/* 已配置的模型列表 */}
      {configuredModels.length > 0 ? (
        <Table
          columns={columns}
          dataSource={dataSource}
          pagination={configuredModels.length > 10 ? { pageSize: 10 } : false}
          size='small'
        />
      ) : (
        <Empty
          description={t('暂无单独配置的模型')}
          style={{ padding: '20px 0' }}
        />
      )}
    </div>
  );
};

export default ModelGroupMappingEditor;
