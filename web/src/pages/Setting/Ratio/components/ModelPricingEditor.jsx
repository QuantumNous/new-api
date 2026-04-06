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

import React, { useMemo, useState } from 'react';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  Empty,
  Input,
  Modal,
  Radio,
  RadioGroup,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IconDelete,
  IconPlus,
  IconSave,
  IconSearch,
} from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import {
  PAGE_SIZE,
  PRICE_SUFFIX,
  buildSummaryText,
  breakpointsFromTiers,
  hasValue,
  useModelPricingEditorState,
} from '../hooks/useModelPricingEditorState';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import { showError } from '../../../../helpers';

const { Text } = Typography;
const EMPTY_CANDIDATE_MODEL_NAMES = [];
const EMPTY_TIER_DRAFT = {
  inputPrice: '',
  completionPrice: '',
  cacheReadPrice: '',
};
const NUMERIC_INPUT_REGEX = /^(\d+(\.\d*)?|\.\d*)?$/;
const TOKEN_BOUNDARY_INPUT_REGEX = /^\d*$/;

const hasTierReferenceInputPrice = (model) =>
  hasValue(model?.tierPricingTiers?.[0]?.inputPrice);

const formatCompactTokenValue = (value) => {
  if (!hasValue(value)) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return value;
  if (num >= 1000 && num % 1000 === 0) {
    return `${num / 1000}k`;
  }
  return String(num);
};

const buildTierRangeText = (tier) => {
  const minLabel = formatCompactTokenValue(tier?.minTokens) || '0';
  const maxLabel = formatCompactTokenValue(tier?.maxTokens);
  if (!maxLabel) {
    return `>= ${minLabel}`;
  }
  return `${minLabel} <= x < ${maxLabel}`;
};

const buildInitialTierDraft = (model, index) => {
  const targetTier =
    index !== null && index !== undefined ? model?.tierPricingTiers?.[index] : null;
  if (targetTier) {
    return {
      inputPrice: targetTier.inputPrice || '',
      completionPrice: targetTier.completionPrice || '',
      cacheReadPrice: targetTier.cacheReadPrice || '',
    };
  }
  return {
    ...EMPTY_TIER_DRAFT,
    inputPrice: model?.inputPrice || '',
    completionPrice: model?.completionPrice || '',
    cacheReadPrice: model?.cachePrice || '',
  };
};

const PriceInput = ({
  label,
  value,
  placeholder,
  onChange,
  suffix = PRICE_SUFFIX,
  disabled = false,
  extraText = '',
  headerAction = null,
  hidden = false,
}) => (
  <div style={{ marginBottom: 16 }}>
    <div className='mb-1 font-medium text-gray-700 flex items-center justify-between gap-3'>
      <span>{label}</span>
      {headerAction}
    </div>
    {!hidden ? (
      <Input
        value={value}
        placeholder={placeholder}
        onChange={onChange}
        suffix={suffix}
        disabled={disabled}
      />
    ) : null}
    {extraText ? (
      <div className='mt-1 text-xs text-gray-500'>{extraText}</div>
    ) : null}
  </div>
);

const TierInputField = ({
  label,
  hint = '',
  value,
  placeholder,
  unitText = '',
  onChange,
}) => (
  <div>
    <div className='mb-1'>
      <div className='text-sm font-medium text-gray-700'>{label}</div>
      {hint ? <div className='text-xs text-gray-500 mt-0.5'>{hint}</div> : null}
    </div>
    <Input
      value={value}
      placeholder={placeholder}
      onChange={onChange}
    />
    {unitText ? (
      <div className='text-xs text-gray-400 mt-1'>{unitText}</div>
    ) : null}
  </div>
);

export default function ModelPricingEditor({
  options,
  refresh,
  candidateModelNames = EMPTY_CANDIDATE_MODEL_NAMES,
  filterMode = 'all',
  allowAddModel = true,
  allowDeleteModel = true,
  showConflictFilter = true,
  listDescription = '',
  emptyTitle = '',
  emptyDescription = '',
}) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [addVisible, setAddVisible] = useState(false);
  const [batchVisible, setBatchVisible] = useState(false);
  const [newModelName, setNewModelName] = useState('');
  const [tierEditorVisible, setTierEditorVisible] = useState(false);
  const [editingTierIndex, setEditingTierIndex] = useState(null);
  const [tierDraft, setTierDraft] = useState(EMPTY_TIER_DRAFT);
  const [breakpointInputVisible, setBreakpointInputVisible] = useState(false);
  const [breakpointInputValue, setBreakpointInputValue] = useState('');

  const {
    selectedModel,
    selectedModelName,
    selectedModelNames,
    setSelectedModelName,
    setSelectedModelNames,
    searchText,
    setSearchText,
    currentPage,
    setCurrentPage,
    loading,
    conflictOnly,
    setConflictOnly,
    filteredModels,
    pagedData,
    selectedWarnings,
    previewSections,
    isOptionalFieldEnabled,
    handleOptionalFieldToggle,
    handleTierPricingToggle,
    handleAddBreakpoint,
    handleRemoveBreakpoint,
    handleSaveTierRow,
    handleNumericFieldChange,
    handleBillingModeChange,
    handleSubmit,
    addModel,
    deleteModel,
    applySelectedModelPricing,
  } = useModelPricingEditorState({
    options,
    refresh,
    t,
    candidateModelNames,
    filterMode,
  });

  const columns = useMemo(
    () => [
      {
        title: t('模型名称'),
        dataIndex: 'name',
        key: 'name',
        render: (text, record) => (
          <Space>
            <Button
              theme='borderless'
              type='tertiary'
              onClick={() => setSelectedModelName(record.name)}
              style={{
                padding: 0,
                color:
                  record.name === selectedModelName
                    ? 'var(--semi-color-primary)'
                    : undefined,
              }}
            >
              {text}
            </Button>
            {selectedModelNames.includes(record.name) ? (
              <Tag color='green' shape='circle'>
                {t('已勾选')}
              </Tag>
            ) : null}
            {record.hasConflict ? (
              <Tag color='red' shape='circle'>
                {t('矛盾')}
              </Tag>
            ) : null}
            {record.tierPricingEnabled ? (
              <Tag color='blue' shape='circle'>
                {t('阶梯定价')}
              </Tag>
            ) : null}
          </Space>
        ),
      },
      {
        title: t('计费方式'),
        dataIndex: 'billingMode',
        key: 'billingMode',
        render: (_, record) => (
          <Tag color={record.billingMode === 'per-request' ? 'teal' : 'violet'}>
            {record.billingMode === 'per-request'
              ? t('按次计费')
              : t('按量计费')}
          </Tag>
        ),
      },
      {
        title: t('价格摘要'),
        dataIndex: 'summary',
        key: 'summary',
        render: (_, record) => buildSummaryText(record, t),
      },
      {
        title: t('操作'),
        key: 'action',
        render: (_, record) => (
          <Space>
            {allowDeleteModel ? (
              <Button
                size='small'
                type='danger'
                icon={<IconDelete />}
                onClick={() => deleteModel(record.name)}
              />
            ) : null}
          </Space>
        ),
      },
    ],
    [
      allowDeleteModel,
      deleteModel,
      selectedModelName,
      selectedModelNames,
      setSelectedModelName,
      t,
    ],
  );

  const handleAddModel = () => {
    if (addModel(newModelName)) {
      setNewModelName('');
      setAddVisible(false);
    }
  };

  const rowSelection = {
    selectedRowKeys: selectedModelNames,
    onChange: (selectedRowKeys) => setSelectedModelNames(selectedRowKeys),
  };

  const openTierEditor = (index) => {
    if (!selectedModel) return;
    setEditingTierIndex(index);
    setTierDraft(buildInitialTierDraft(selectedModel, index));
    setTierEditorVisible(true);
  };

  const handleTierDraftChange = (field, value) => {
    if (!NUMERIC_INPUT_REGEX.test(value)) {
      return;
    }
    setTierDraft((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const submitTierEditor = () => {
    if (!selectedModel || editingTierIndex === null) return;
    if (selectedModel.completionRatioLocked) {
      showError(t('该模型补全倍率由后端锁定，不支持阶梯定价'));
      return;
    }
    if (!hasValue(tierDraft.inputPrice)) {
      showError(t('请填写输入价格'));
      return;
    }
    if (!hasValue(tierDraft.completionPrice)) {
      showError(t('请填写输出价格'));
      return;
    }
    if (
      Number(tierDraft.inputPrice) === 0 &&
      ((hasValue(tierDraft.completionPrice) &&
        Number(tierDraft.completionPrice) !== 0) ||
        (hasValue(tierDraft.cacheReadPrice) &&
          Number(tierDraft.cacheReadPrice) !== 0))
    ) {
      showError(t('输入价格为 0 时，输出和缓存读取价格也必须为 0'));
      return;
    }
    handleSaveTierRow(editingTierIndex, tierDraft);
    setTierEditorVisible(false);
    setEditingTierIndex(null);
  };

  const submitBreakpoint = () => {
    if (!breakpointInputValue) return;
    const num = Number(breakpointInputValue);
    if (!Number.isInteger(num) || num <= 0) {
      showError(t('分界点必须是大于 0 的整数'));
      return;
    }
    const existing = breakpointsFromTiers(selectedModel?.tierPricingTiers);
    if (existing.includes(num)) {
      showError(t('分界点已存在'));
      return;
    }
    handleAddBreakpoint(num);
    setBreakpointInputValue('');
    setBreakpointInputVisible(false);
  };

  return (
    <>
      <Space vertical align='start' style={{ width: '100%' }}>
        <Space wrap className='mt-2'>
          {allowAddModel ? (
            <Button
              icon={<IconPlus />}
              onClick={() => setAddVisible(true)}
              style={isMobile ? { width: '100%' } : undefined}
            >
              {t('添加模型')}
            </Button>
          ) : null}
          <Button
            type='primary'
            icon={<IconSave />}
            loading={loading}
            onClick={handleSubmit}
            style={isMobile ? { width: '100%' } : undefined}
          >
            {t('应用更改')}
          </Button>
          <Button
            disabled={!selectedModel || selectedModelNames.length === 0}
            onClick={() => setBatchVisible(true)}
            style={isMobile ? { width: '100%' } : undefined}
          >
            {t('批量应用当前模型价格')}
            {selectedModelNames.length > 0 ? ` (${selectedModelNames.length})` : ''}
          </Button>
          <Input
            prefix={<IconSearch />}
            placeholder={t('搜索模型名称')}
            value={searchText}
            onChange={(value) => setSearchText(value)}
            style={{ width: isMobile ? '100%' : 220 }}
            showClear
          />
          {showConflictFilter ? (
            <Checkbox
              checked={conflictOnly}
              onChange={(event) => setConflictOnly(event.target.checked)}
            >
              {t('仅显示矛盾倍率')}
            </Checkbox>
          ) : null}
        </Space>

        {listDescription ? (
          <div className='text-sm text-gray-500'>{listDescription}</div>
        ) : null}
        {selectedModelNames.length > 0 ? (
          <div
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 8,
              background: 'var(--semi-color-primary-light-default)',
              border: '1px solid var(--semi-color-primary)',
              color: 'var(--semi-color-primary)',
              fontWeight: 600,
            }}
          >
            {t('已勾选 {{count}} 个模型', { count: selectedModelNames.length })}
          </div>
        ) : null}

        <div
          style={{
            width: '100%',
            display: 'grid',
            gap: 16,
            gridTemplateColumns: isMobile
              ? 'minmax(0, 1fr)'
              : 'minmax(360px, 1.1fr) minmax(420px, 1fr)',
          }}
        >
          <Card
            bodyStyle={{ padding: 0 }}
            style={isMobile ? { order: 2 } : undefined}
          >
            <div style={{ overflowX: 'auto' }}>
              <Table
                columns={columns}
                dataSource={pagedData}
                rowKey='name'
                rowSelection={rowSelection}
                pagination={{
                  currentPage,
                  pageSize: PAGE_SIZE,
                  total: filteredModels.length,
                  onPageChange: (page) => setCurrentPage(page),
                  showTotal: true,
                  showSizeChanger: false,
                }}
                empty={
                  <div style={{ textAlign: 'center', padding: '20px' }}>
                    {emptyTitle || t('暂无模型')}
                  </div>
                }
                onRow={(record) => ({
                  style: {
                    background: selectedModelNames.includes(record.name)
                      ? 'var(--semi-color-success-light-default)'
                      : record.name === selectedModelName
                        ? 'var(--semi-color-primary-light-default)'
                        : undefined,
                    boxShadow: selectedModelNames.includes(record.name)
                      ? 'inset 4px 0 0 var(--semi-color-success)'
                      : record.name === selectedModelName
                        ? 'inset 4px 0 0 var(--semi-color-primary)'
                        : undefined,
                    transition: 'background 0.2s ease, box-shadow 0.2s ease',
                  },
                  onClick: () => setSelectedModelName(record.name),
                })}
                scroll={isMobile ? { x: 720 } : undefined}
              />
            </div>
          </Card>

          <Card
            style={isMobile ? { order: 1 } : undefined}
            title={selectedModel ? selectedModel.name : t('模型计费编辑器')}
            headerExtraContent={
              selectedModel ? (
                <Tag color='blue'>
                  {selectedModel.billingMode === 'per-request'
                    ? t('按次计费')
                    : t('按量计费')}
                </Tag>
              ) : null
            }
          >
            {!selectedModel ? (
              <Empty
                title={emptyTitle || t('暂无模型')}
                description={
                  emptyDescription || t('请先新增模型或从左侧列表选择一个模型')
                }
              />
            ) : (
              <div>
                <div className='mb-4'>
                  <div className='mb-2 font-medium text-gray-700'>
                    {t('计费方式')}
                  </div>
                  <RadioGroup
                    type='button'
                    value={selectedModel.billingMode}
                    onChange={(event) => handleBillingModeChange(event.target.value)}
                  >
                    <Radio value='per-token'>{t('按量计费')}</Radio>
                    <Radio value='per-request'>{t('按次计费')}</Radio>
                  </RadioGroup>
                  <div className='mt-2 text-xs text-gray-500'>
                    {t(
                      '这个界面默认按价格填写，保存时会自动换算回后端需要的倍率 JSON。',
                    )}
                  </div>
                </div>

                {selectedWarnings.length > 0 ? (
                  <Card
                    bodyStyle={{ padding: 12 }}
                    style={{
                      marginBottom: 16,
                      background: 'var(--semi-color-warning-light-default)',
                    }}
                  >
                    <div className='font-medium mb-2'>{t('当前提示')}</div>
                    {selectedWarnings.map((warning) => (
                      <div key={warning} className='text-sm text-gray-700 mb-1'>
                        {warning}
                      </div>
                    ))}
                  </Card>
                ) : null}

                {selectedModel.billingMode === 'per-request' ? (
                  <PriceInput
                    label={t('固定价格')}
                    value={selectedModel.fixedPrice}
                    placeholder={t('输入每次调用价格')}
                    suffix={t('$/次')}
                    onChange={(value) => handleNumericFieldChange('fixedPrice', value)}
                    extraText={t('适合 MJ / 任务类等按次收费模型。')}
                  />
                ) : (
                  <>
                    <Card
                      bodyStyle={{ padding: 16 }}
                      style={{
                        marginBottom: 16,
                        background: 'var(--semi-color-fill-0)',
                      }}
                    >
                      <div className='flex items-start justify-between gap-4'>
                        <div>
                          <div className='font-medium'>{t('阶梯定价')}</div>
                          <div className='text-xs text-gray-500 mt-1'>
                            {selectedModel.completionRatioLocked
                              ? t(
                                  '该模型补全倍率由后端锁定，不支持阶梯定价。',
                                )
                              : t(
                                  '按输入 tokens 命中不同价格档位。开启后会自动把当前基础价格写入第 1 档，并改为写入 ModelTierPricing。',
                                )}
                          </div>
                        </div>
                        <Switch
                          checked={selectedModel.tierPricingEnabled}
                          disabled={
                            selectedModel.completionRatioLocked &&
                            !selectedModel.tierPricingEnabled
                          }
                          onChange={handleTierPricingToggle}
                        />
                      </div>
                    </Card>

                    <Card
                      bodyStyle={{ padding: 16 }}
                      style={{
                        marginBottom: 16,
                        background: 'var(--semi-color-fill-0)',
                      }}
                    >
                      {selectedModel.tierPricingEnabled ? (
                        <>
                          <div className='mb-3'>
                            <div className='font-medium'>{t('阶梯价格表')}</div>
                            <div className='text-xs text-gray-500 mt-1'>
                              {t(
                                '通过添加分界点来划分价格区间，每个区间可单独设置价格。',
                              )}
                            </div>
                          </div>
                          <div className='flex items-center flex-wrap gap-2 mb-3'>
                            <span className='text-sm text-gray-600'>{t('分界点')}:</span>
                            {breakpointsFromTiers(selectedModel.tierPricingTiers).map(
                              (bp, bpIndex) => (
                                <Tag
                                  key={bp}
                                  closable
                                  color='blue'
                                  size='large'
                                  onClose={() => handleRemoveBreakpoint(bpIndex)}
                                >
                                  {formatCompactTokenValue(bp)}
                                </Tag>
                              ),
                            )}
                            {breakpointInputVisible ? (
                              <Space>
                                <Input
                                  size='small'
                                  style={{ width: 120 }}
                                  value={breakpointInputValue}
                                  placeholder={t('例如 200000')}
                                  onChange={(value) => {
                                    if (TOKEN_BOUNDARY_INPUT_REGEX.test(value)) {
                                      setBreakpointInputValue(value);
                                    }
                                  }}
                                  onEnterPress={submitBreakpoint}
                                  autoFocus
                                />
                                <Button size='small' type='primary' onClick={submitBreakpoint}>
                                  {t('确认')}
                                </Button>
                                <Button
                                  size='small'
                                  onClick={() => {
                                    setBreakpointInputVisible(false);
                                    setBreakpointInputValue('');
                                  }}
                                >
                                  {t('取消')}
                                </Button>
                              </Space>
                            ) : (
                              <Button
                                icon={<IconPlus />}
                                size='small'
                                theme='borderless'
                                disabled={selectedModel.completionRatioLocked}
                                onClick={() => setBreakpointInputVisible(true)}
                              >
                                {t('添加分界点')}
                              </Button>
                            )}
                          </div>
                          <div className='flex flex-col gap-3'>
                            {selectedModel.tierPricingTiers.map((tier, index) => (
                              <Card
                                key={`tier-${selectedModel.name}-${index}`}
                                bodyStyle={{ padding: 12 }}
                                style={{
                                  border: '1px solid var(--semi-color-border)',
                                  background: 'var(--semi-color-bg-0)',
                                }}
                              >
                                <div className='flex items-start justify-between gap-3'>
                                  <div>
                                    <div className='font-medium'>
                                      {t('第 {{index}} 档', { index: index + 1 })}
                                    </div>
                                    <div className='text-sm text-gray-500 mt-1'>
                                      {t('命中区间')} {buildTierRangeText(tier)}
                                    </div>
                                  </div>
                                  <Button
                                    size='small'
                                    disabled={selectedModel.completionRatioLocked}
                                    onClick={() => openTierEditor(index)}
                                  >
                                    {t('编辑')}
                                  </Button>
                                </div>
                                <div
                                  style={{
                                    display: 'grid',
                                    gap: 12,
                                    marginTop: 12,
                                    gridTemplateColumns: isMobile
                                      ? 'repeat(2, minmax(0, 1fr))'
                                      : 'repeat(3, minmax(0, 1fr))',
                                  }}
                                >
                                  <div>
                                    <div className='text-xs text-gray-500 mb-1'>
                                      {t('输入价格')}
                                    </div>
                                    <div className='font-medium'>
                                      {hasValue(tier.inputPrice) ? `$${tier.inputPrice}` : '-'}
                                    </div>
                                  </div>
                                  <div>
                                    <div className='text-xs text-gray-500 mb-1'>
                                      {t('输出价格')}
                                    </div>
                                    <div className='font-medium'>
                                      {hasValue(tier.completionPrice) ? `$${tier.completionPrice}` : '-'}
                                    </div>
                                  </div>
                                  <div>
                                    <div className='text-xs text-gray-500 mb-1'>
                                      {t('缓存读取价格')}
                                    </div>
                                    <div className='font-medium'>
                                      {hasValue(tier.cacheReadPrice)
                                        ? `$${tier.cacheReadPrice}`
                                        : t('未设置')}
                                    </div>
                                  </div>
                                </div>
                              </Card>
                            ))}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className='font-medium mb-3'>{t('基础价格')}</div>
                          <PriceInput
                            label={t('输入价格')}
                            value={selectedModel.inputPrice}
                            placeholder={t('输入 $/1M tokens')}
                            onChange={(value) =>
                              handleNumericFieldChange('inputPrice', value)
                            }
                          />
                          {selectedModel.completionRatioLocked ? (
                            <Banner
                              type='warning'
                              bordered
                              fullMode={false}
                              closeIcon={null}
                              style={{ marginBottom: 12 }}
                              title={t('补全价格已锁定')}
                              description={t(
                                '该模型补全倍率由后端固定为 {{ratio}}。补全价格不能在这里修改。',
                                {
                                  ratio: selectedModel.lockedCompletionRatio || '-',
                                },
                              )}
                            />
                          ) : null}
                          <PriceInput
                            label={t('补全价格')}
                            value={selectedModel.completionPrice}
                            placeholder={t('输入 $/1M tokens')}
                            onChange={(value) =>
                              handleNumericFieldChange('completionPrice', value)
                            }
                            headerAction={
                              <Switch
                                size='small'
                                checked={isOptionalFieldEnabled(
                                  selectedModel,
                                  'completionPrice',
                                )}
                                disabled={selectedModel.completionRatioLocked}
                                onChange={(checked) =>
                                  handleOptionalFieldToggle('completionPrice', checked)
                                }
                              />
                            }
                            hidden={
                              !isOptionalFieldEnabled(
                                selectedModel,
                                'completionPrice',
                              )
                            }
                            disabled={
                              !hasValue(selectedModel.inputPrice) ||
                              selectedModel.completionRatioLocked
                            }
                            extraText={
                              selectedModel.completionRatioLocked
                                ? t(
                                    '后端固定倍率：{{ratio}}。该字段仅展示换算后的价格。',
                                    {
                                      ratio:
                                        selectedModel.lockedCompletionRatio || '-',
                                    },
                                  )
                                : !isOptionalFieldEnabled(
                                      selectedModel,
                                      'completionPrice',
                                    )
                                  ? t('当前未启用，需要时再打开即可。')
                                  : ''
                            }
                          />
                          <PriceInput
                            label={t('缓存读取价格')}
                            value={selectedModel.cachePrice}
                            placeholder={t('输入 $/1M tokens')}
                            onChange={(value) =>
                              handleNumericFieldChange('cachePrice', value)
                            }
                            headerAction={
                              <Switch
                                size='small'
                                checked={isOptionalFieldEnabled(
                                  selectedModel,
                                  'cachePrice',
                                )}
                                onChange={(checked) =>
                                  handleOptionalFieldToggle('cachePrice', checked)
                                }
                              />
                            }
                            hidden={!isOptionalFieldEnabled(selectedModel, 'cachePrice')}
                            disabled={!hasValue(selectedModel.inputPrice)}
                            extraText={
                              !isOptionalFieldEnabled(selectedModel, 'cachePrice')
                                ? t('当前未启用，需要时再打开即可。')
                                : ''
                            }
                          />
                        </>
                      )}
                    </Card>

                    <Card
                      bodyStyle={{ padding: 16 }}
                      style={{
                        marginBottom: 16,
                        background: 'var(--semi-color-fill-0)',
                      }}
                    >
                      <div className='mb-3'>
                        <div className='font-medium'>
                          {selectedModel.tierPricingEnabled
                            ? t('非阶梯扩展价格')
                            : t('扩展价格')}
                        </div>
                        <div className='text-xs text-gray-500 mt-1'>
                          {selectedModel.tierPricingEnabled
                            ? t(
                                '这些字段继续写入旧的全局倍率配置，不参与阶梯。它们会以第一档输入价格作为参考换算倍率。',
                              )
                            : t('这些价格都是可选项，不填也可以。')}
                        </div>
                      </div>
                      <PriceInput
                        label={t('缓存创建价格')}
                        value={selectedModel.createCachePrice}
                        placeholder={t('输入 $/1M tokens')}
                        onChange={(value) =>
                          handleNumericFieldChange('createCachePrice', value)
                        }
                        headerAction={
                          <Switch
                            size='small'
                            checked={isOptionalFieldEnabled(
                              selectedModel,
                              'createCachePrice',
                            )}
                            onChange={(checked) =>
                              handleOptionalFieldToggle('createCachePrice', checked)
                            }
                          />
                        }
                        hidden={
                          !isOptionalFieldEnabled(selectedModel, 'createCachePrice')
                        }
                        disabled={
                          selectedModel.tierPricingEnabled
                            ? !hasTierReferenceInputPrice(selectedModel)
                            : !hasValue(selectedModel.inputPrice)
                        }
                        extraText={
                          !isOptionalFieldEnabled(
                            selectedModel,
                            'createCachePrice',
                          )
                            ? t('当前未启用，需要时再打开即可。')
                            : selectedModel.tierPricingEnabled &&
                                !hasTierReferenceInputPrice(selectedModel)
                              ? t('请先填写第一档输入价格。')
                              : ''
                        }
                      />
                      <PriceInput
                        label={t('图片输入价格')}
                        value={selectedModel.imagePrice}
                        placeholder={t('输入 $/1M tokens')}
                        onChange={(value) => handleNumericFieldChange('imagePrice', value)}
                        headerAction={
                          <Switch
                            size='small'
                            checked={isOptionalFieldEnabled(selectedModel, 'imagePrice')}
                            onChange={(checked) =>
                              handleOptionalFieldToggle('imagePrice', checked)
                            }
                          />
                        }
                        hidden={!isOptionalFieldEnabled(selectedModel, 'imagePrice')}
                        disabled={
                          selectedModel.tierPricingEnabled
                            ? !hasTierReferenceInputPrice(selectedModel)
                            : !hasValue(selectedModel.inputPrice)
                        }
                        extraText={
                          !isOptionalFieldEnabled(selectedModel, 'imagePrice')
                            ? t('当前未启用，需要时再打开即可。')
                            : selectedModel.tierPricingEnabled &&
                                !hasTierReferenceInputPrice(selectedModel)
                              ? t('请先填写第一档输入价格。')
                            : ''
                        }
                      />
                      <PriceInput
                        label={t('音频输入价格')}
                        value={selectedModel.audioInputPrice}
                        placeholder={t('输入 $/1M tokens')}
                        onChange={(value) =>
                          handleNumericFieldChange('audioInputPrice', value)
                        }
                        headerAction={
                          <Switch
                            size='small'
                            checked={isOptionalFieldEnabled(
                              selectedModel,
                              'audioInputPrice',
                            )}
                            onChange={(checked) =>
                              handleOptionalFieldToggle('audioInputPrice', checked)
                            }
                          />
                        }
                        hidden={!isOptionalFieldEnabled(selectedModel, 'audioInputPrice')}
                        disabled={
                          selectedModel.tierPricingEnabled
                            ? !hasTierReferenceInputPrice(selectedModel)
                            : !hasValue(selectedModel.inputPrice)
                        }
                        extraText={
                          !isOptionalFieldEnabled(
                            selectedModel,
                            'audioInputPrice',
                          )
                            ? t('当前未启用，需要时再打开即可。')
                            : selectedModel.tierPricingEnabled &&
                                !hasTierReferenceInputPrice(selectedModel)
                              ? t('请先填写第一档输入价格。')
                            : ''
                        }
                      />
                      <PriceInput
                        label={t('音频补全价格')}
                        value={selectedModel.audioOutputPrice}
                        placeholder={t('输入 $/1M tokens')}
                        onChange={(value) =>
                          handleNumericFieldChange('audioOutputPrice', value)
                        }
                        headerAction={
                          <Switch
                            size='small'
                            checked={isOptionalFieldEnabled(
                              selectedModel,
                              'audioOutputPrice',
                            )}
                            disabled={!isOptionalFieldEnabled(
                              selectedModel,
                              'audioInputPrice',
                            )}
                            onChange={(checked) =>
                              handleOptionalFieldToggle('audioOutputPrice', checked)
                            }
                          />
                        }
                        hidden={
                          !isOptionalFieldEnabled(selectedModel, 'audioOutputPrice')
                        }
                        disabled={!hasValue(selectedModel.audioInputPrice)}
                        extraText={
                          !isOptionalFieldEnabled(
                            selectedModel,
                            'audioInputPrice',
                          )
                            ? t('请先开启并填写音频输入价格。')
                            : !isOptionalFieldEnabled(
                                  selectedModel,
                                  'audioOutputPrice',
                                )
                              ? t('当前未启用，需要时再打开即可。')
                              : ''
                        }
                      />
                    </Card>
                  </>
                )}

                <Card
                  bodyStyle={{ padding: 16 }}
                  style={{ background: 'var(--semi-color-fill-0)' }}
                >
                  <div className='font-medium mb-3'>{t('保存预览')}</div>
                  <div className='text-xs text-gray-500 mb-3'>
                    {t(
                      '下面展示这个模型保存后会写入哪些后端字段，便于和原始 JSON 编辑框保持一致。',
                    )}
                  </div>
                  <Space vertical align='stretch' style={{ width: '100%' }}>
                    {previewSections.map((section) => (
                      <Card
                        key={section.key}
                        bodyStyle={{ padding: 12 }}
                        style={{ background: 'var(--semi-color-bg-0)' }}
                      >
                        <div className='font-medium mb-3'>{section.title}</div>
                        {section.code ? (
                          <pre
                            style={{
                              margin: 0,
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              fontSize: 12,
                              lineHeight: 1.6,
                            }}
                          >
                            {section.code}
                          </pre>
                        ) : (
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'minmax(140px, 180px) 1fr',
                              gap: 8,
                            }}
                          >
                            {section.rows.map((row) => (
                              <React.Fragment key={row.key}>
                                <Text strong>{row.label}</Text>
                                <Text>{row.value}</Text>
                              </React.Fragment>
                            ))}
                          </div>
                        )}
                      </Card>
                    ))}
                  </Space>
                </Card>
              </div>
            )}
          </Card>
        </div>
      </Space>

      {allowAddModel ? (
        <Modal
          title={t('添加模型')}
          visible={addVisible}
          onCancel={() => {
            setAddVisible(false);
            setNewModelName('');
          }}
          onOk={handleAddModel}
        >
          <Input
            value={newModelName}
            placeholder={t('输入模型名称，例如 gpt-4.1')}
            onChange={(value) => setNewModelName(value)}
          />
        </Modal>
      ) : null}

      <Modal
        title={
          editingTierIndex !== null && selectedModel?.tierPricingTiers?.[editingTierIndex]
            ? `${t('编辑第 {{index}} 档', { index: editingTierIndex + 1 })} (${buildTierRangeText(selectedModel.tierPricingTiers[editingTierIndex])})`
            : t('编辑阶梯')
        }
        visible={tierEditorVisible}
        onCancel={() => {
          setTierEditorVisible(false);
          setEditingTierIndex(null);
        }}
        onOk={submitTierEditor}
      >
        <Card bodyStyle={{ padding: 12 }} style={{ background: 'var(--semi-color-fill-0)' }}>
          <div className='font-medium mb-3'>{t('价格')}</div>
          <div className='text-xs text-gray-500 mb-3'>
            {t('输入与输出价格必填。缓存读取价格可留空，表示不单独配置。')}
          </div>
          <div
            style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns: isMobile
                ? 'minmax(0, 1fr)'
                : 'repeat(3, minmax(0, 1fr))',
            }}
          >
            <TierInputField
              label={t('输入价格')}
              hint={t('必填')}
              value={tierDraft.inputPrice}
              placeholder={t('例如 2')}
              unitText={PRICE_SUFFIX}
              onChange={(value) => handleTierDraftChange('inputPrice', value)}
            />
            <TierInputField
              label={t('输出价格')}
              hint={t('必填')}
              value={tierDraft.completionPrice}
              placeholder={t('例如 12')}
              unitText={PRICE_SUFFIX}
              onChange={(value) =>
                handleTierDraftChange('completionPrice', value)
              }
            />
            <TierInputField
              label={t('缓存读取价格')}
              hint={t('可选')}
              value={tierDraft.cacheReadPrice}
              placeholder={t('例如 0.2')}
              unitText={PRICE_SUFFIX}
              onChange={(value) =>
                handleTierDraftChange('cacheReadPrice', value)
              }
            />
          </div>
        </Card>
      </Modal>

      <Modal
        title={t('批量应用当前模型价格')}
        visible={batchVisible}
        onCancel={() => setBatchVisible(false)}
        onOk={() => {
          if (applySelectedModelPricing()) {
            setBatchVisible(false);
          }
        }}
      >
        <div className='text-sm text-gray-600'>
          {selectedModel
            ? t(
                '将把当前编辑中的模型 {{name}} 的价格配置，批量应用到已勾选的 {{count}} 个模型。',
                {
                  name: selectedModel.name,
                  count: selectedModelNames.length,
                },
              )
            : t('请先选择一个作为模板的模型')}
        </div>
        {selectedModel ? (
          <div className='text-xs text-gray-500 mt-3'>
            {t(
              '适合同系列模型一起定价，例如把 gpt-5.1 的价格批量同步到 gpt-5.1-high、gpt-5.1-low 等模型。',
            )}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
