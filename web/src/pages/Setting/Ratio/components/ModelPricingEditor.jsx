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
  Button,
  Card,
  Input,
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalFooter,
  ModalHeader,
  Switch,
  useOverlayState,
} from '@heroui/react';
import { AlertTriangle, Plus, Save, Search, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  PAGE_SIZE,
  PRICE_SUFFIX,
  buildSummaryText,
  hasValue,
  useModelPricingEditorState,
} from '../hooks/useModelPricingEditorState';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import TieredPricingEditor from './TieredPricingEditor';

const EMPTY_CANDIDATE_MODEL_NAMES = [];

const inputClass =
  'h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary disabled:cursor-not-allowed disabled:opacity-50';

const TAG_TONE = {
  green: 'bg-success/15 text-success',
  red: 'bg-danger/15 text-danger',
  blue: 'bg-primary/15 text-primary',
  teal: 'bg-[color-mix(in_oklab,var(--app-success)_18%,transparent)] text-success',
  violet:
    'bg-[color-mix(in_oklab,var(--app-primary)_18%,transparent)] text-primary',
};

function StatusChip({ tone = 'blue', children }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
        TAG_TONE[tone] || TAG_TONE.blue
      }`}
    >
      {children}
    </span>
  );
}

function InfoBanner({ tone = 'warning', title, description }) {
  const cls =
    tone === 'warning'
      ? 'border-warning/30 bg-warning/5'
      : 'border-primary/20 bg-primary/5';
  return (
    <div
      className={`mb-3 flex items-start gap-2 rounded-xl border ${cls} px-3 py-2 text-sm text-foreground`}
    >
      <AlertTriangle
        size={16}
        className={
          tone === 'warning'
            ? 'mt-0.5 shrink-0 text-warning'
            : 'mt-0.5 shrink-0 text-primary'
        }
      />
      <div className='flex-1'>
        {title ? (
          <div className='mb-0.5 font-semibold'>{title}</div>
        ) : null}
        {description ? <div className='text-xs'>{description}</div> : null}
      </div>
    </div>
  );
}

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
  <div className='mb-4'>
    <div className='mb-1 flex items-center justify-between gap-3 font-medium text-foreground'>
      <span>{label}</span>
      {headerAction}
    </div>
    {!hidden ? (
      <div className='relative'>
        <input
          type='text'
          value={value ?? ''}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(event) => onChange?.(event.target.value)}
          className={`${inputClass} pr-20`}
        />
        {suffix ? (
          <span className='pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted'>
            {suffix}
          </span>
        ) : null}
      </div>
    ) : null}
    {extraText ? (
      <div className='mt-1 text-xs text-muted'>{extraText}</div>
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
    previewRows,
    isOptionalFieldEnabled,
    handleOptionalFieldToggle,
    handleNumericFieldChange,
    handleBillingModeChange,
    handleBillingExprChange,
    handleRequestRuleExprChange,
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

  const addModalState = useOverlayState({
    isOpen: addVisible,
    onOpenChange: (isOpen) => {
      if (!isOpen) {
        setAddVisible(false);
        setNewModelName('');
      }
    },
  });
  const batchModalState = useOverlayState({
    isOpen: batchVisible,
    onOpenChange: (isOpen) => {
      if (!isOpen) setBatchVisible(false);
    },
  });

  const handleAddModel = () => {
    if (addModel(newModelName)) {
      setNewModelName('');
      setAddVisible(false);
    }
  };

  const totalPages = Math.max(
    1,
    Math.ceil(filteredModels.length / PAGE_SIZE),
  );
  const startIndex = (currentPage - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(
    currentPage * PAGE_SIZE,
    filteredModels.length,
  );

  const allOnPageSelected =
    pagedData.length > 0 &&
    pagedData.every((row) => selectedModelNames.includes(row.name));
  const someOnPageSelected =
    pagedData.some((row) => selectedModelNames.includes(row.name)) &&
    !allOnPageSelected;

  const togglePageSelection = (checked) => {
    const pageNames = pagedData.map((row) => row.name);
    if (checked) {
      const merged = [...new Set([...selectedModelNames, ...pageNames])];
      setSelectedModelNames(merged);
    } else {
      const next = selectedModelNames.filter(
        (name) => !pageNames.includes(name),
      );
      setSelectedModelNames(next);
    }
  };

  const toggleRow = (name, checked) => {
    if (checked) {
      if (selectedModelNames.includes(name)) return;
      setSelectedModelNames([...selectedModelNames, name]);
    } else {
      setSelectedModelNames(selectedModelNames.filter((n) => n !== name));
    }
  };

  const HeaderCheckbox = () => {
    const ref = React.useRef(null);
    React.useEffect(() => {
      if (ref.current) ref.current.indeterminate = someOnPageSelected;
    }, []);
    return (
      <input
        ref={ref}
        type='checkbox'
        checked={allOnPageSelected}
        onChange={(event) => togglePageSelection(event.target.checked)}
        aria-label={t('全选')}
        className='h-4 w-4 accent-primary'
      />
    );
  };

  return (
    <>
      <div className='flex w-full flex-col gap-3'>
        {/* Toolbar */}
        <div className='flex flex-wrap items-center gap-2'>
          {allowAddModel ? (
            <Button
              variant='flat'
              startContent={<Plus size={14} />}
              onPress={() => setAddVisible(true)}
              className={isMobile ? 'w-full' : ''}
            >
              {t('添加模型')}
            </Button>
          ) : null}
          <Button
            color='primary'
            isPending={loading}
            startContent={<Save size={14} />}
            onPress={handleSubmit}
            className={isMobile ? 'w-full' : ''}
          >
            {t('应用更改')}
          </Button>
          <Button
            variant='flat'
            isDisabled={
              !selectedModel || selectedModelNames.length === 0
            }
            onPress={() => setBatchVisible(true)}
            className={isMobile ? 'w-full' : ''}
          >
            {t('批量应用当前模型价格')}
            {selectedModelNames.length > 0
              ? ` (${selectedModelNames.length})`
              : ''}
          </Button>

          <div
            className='relative'
            style={{ width: isMobile ? '100%' : 220 }}
          >
            <Search
              size={14}
              className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted'
            />
            <input
              type='text'
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder={t('搜索模型名称')}
              className={`${inputClass} pl-8`}
            />
          </div>
          {showConflictFilter ? (
            <label className='flex items-center gap-2 text-sm text-foreground'>
              <input
                type='checkbox'
                checked={!!conflictOnly}
                onChange={(event) =>
                  setConflictOnly(event.target.checked)
                }
                className='h-4 w-4 accent-primary'
              />
              <span>{t('仅显示矛盾倍率')}</span>
            </label>
          ) : null}
        </div>

        {listDescription ? (
          <div className='text-sm text-muted'>{listDescription}</div>
        ) : null}

        {selectedModelNames.length > 0 ? (
          <div className='w-full rounded-xl border border-primary bg-primary/10 px-3 py-2 text-sm font-semibold text-primary'>
            {t('已勾选 {{count}} 个模型', {
              count: selectedModelNames.length,
            })}
          </div>
        ) : null}

        <div
          className={`grid w-full gap-4 ${
            isMobile
              ? 'grid-cols-1'
              : 'grid-cols-[minmax(360px,1.1fr)_minmax(420px,1fr)]'
          }`}
        >
          {/* Left: model list */}
          <div className={isMobile ? 'order-2' : ''}>
            <Card>
              <Card.Content className='p-0'>
                <div className='overflow-x-auto'>
                  <table className='w-full text-sm'>
                    <thead className='bg-surface-secondary text-xs uppercase tracking-wide text-muted'>
                      <tr>
                        <th className='w-12 px-3 py-2 text-left font-medium'>
                          <HeaderCheckbox />
                        </th>
                        <th className='px-3 py-2 text-left font-medium'>
                          {t('模型名称')}
                        </th>
                        <th className='px-3 py-2 text-left font-medium'>
                          {t('计费方式')}
                        </th>
                        <th className='px-3 py-2 text-left font-medium'>
                          {t('价格摘要')}
                        </th>
                        <th className='w-[80px] px-3 py-2 text-left font-medium'>
                          {t('操作')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className='divide-y divide-border'>
                      {pagedData.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className='px-4 py-10 text-center text-sm text-muted'
                          >
                            {emptyTitle || t('暂无模型')}
                          </td>
                        </tr>
                      ) : (
                        pagedData.map((record) => {
                          const isChecked = selectedModelNames.includes(
                            record.name,
                          );
                          const isFocused =
                            record.name === selectedModelName;
                          const rowBg = isChecked
                            ? 'bg-success/10'
                            : isFocused
                              ? 'bg-primary/10'
                              : 'bg-background hover:bg-surface-secondary/60';
                          const rowAccent = isChecked
                            ? 'shadow-[inset_4px_0_0_var(--app-success)]'
                            : isFocused
                              ? 'shadow-[inset_4px_0_0_var(--app-primary)]'
                              : '';
                          return (
                            <tr
                              key={record.name}
                              className={`cursor-pointer transition-colors ${rowBg} ${rowAccent}`}
                              onClick={() =>
                                setSelectedModelName(record.name)
                              }
                            >
                              <td
                                className='px-3 py-3 align-middle'
                                onClick={(event) => event.stopPropagation()}
                              >
                                <input
                                  type='checkbox'
                                  checked={isChecked}
                                  onChange={(event) =>
                                    toggleRow(
                                      record.name,
                                      event.target.checked,
                                    )
                                  }
                                  aria-label={record.name}
                                  className='h-4 w-4 accent-primary'
                                />
                              </td>
                              <td className='px-3 py-3 align-middle'>
                                <div className='flex flex-wrap items-center gap-2'>
                                  <button
                                    type='button'
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setSelectedModelName(record.name);
                                    }}
                                    className={`p-0 text-sm ${
                                      isFocused
                                        ? 'text-primary'
                                        : 'text-foreground hover:text-primary'
                                    }`}
                                  >
                                    {record.name}
                                  </button>
                                  {isChecked ? (
                                    <StatusChip tone='green'>
                                      {t('已勾选')}
                                    </StatusChip>
                                  ) : null}
                                  {record.hasConflict ? (
                                    <StatusChip tone='red'>
                                      {t('矛盾')}
                                    </StatusChip>
                                  ) : null}
                                </div>
                              </td>
                              <td className='px-3 py-3 align-middle'>
                                <StatusChip
                                  tone={
                                    record.billingMode === 'per-request'
                                      ? 'teal'
                                      : 'violet'
                                  }
                                >
                                  {record.billingMode === 'per-request'
                                    ? t('按次计费')
                                    : t('按量计费')}
                                </StatusChip>
                              </td>
                              <td className='px-3 py-3 align-middle text-foreground'>
                                {buildSummaryText(record, t)}
                              </td>
                              <td
                                className='px-3 py-3 align-middle'
                                onClick={(event) => event.stopPropagation()}
                              >
                                {allowDeleteModel ? (
                                  <Button
                                    isIconOnly
                                    size='sm'
                                    variant='light'
                                    color='danger'
                                    aria-label={t('删除')}
                                    onPress={() => deleteModel(record.name)}
                                  >
                                    <Trash2 size={14} />
                                  </Button>
                                ) : null}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {filteredModels.length > 0 && (
                  <div className='flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-2 text-xs text-muted'>
                    <span>
                      {t('共 {{total}} 项，当前显示 {{start}}-{{end}} 项', {
                        total: filteredModels.length,
                        start: filteredModels.length === 0 ? 0 : startIndex,
                        end: endIndex,
                      })}
                    </span>
                    <div className='flex items-center gap-2'>
                      <Button
                        size='sm'
                        variant='light'
                        isDisabled={currentPage <= 1}
                        onPress={() =>
                          setCurrentPage(Math.max(1, currentPage - 1))
                        }
                      >
                        {t('上一页')}
                      </Button>
                      <span>
                        {currentPage} / {totalPages}
                      </span>
                      <Button
                        size='sm'
                        variant='light'
                        isDisabled={currentPage >= totalPages}
                        onPress={() =>
                          setCurrentPage(
                            Math.min(totalPages, currentPage + 1),
                          )
                        }
                      >
                        {t('下一页')}
                      </Button>
                    </div>
                  </div>
                )}
              </Card.Content>
            </Card>
          </div>

          {/* Right: editor card */}
          <div className={isMobile ? 'order-1' : ''}>
            <Card>
              <Card.Content className='p-5'>
                <div className='mb-4 flex items-center justify-between gap-2'>
                  <div className='text-base font-semibold text-foreground'>
                    {selectedModel
                      ? selectedModel.name
                      : t('模型计费编辑器')}
                  </div>
                  {selectedModel ? (
                    <StatusChip tone='blue'>
                      {selectedModel.billingMode === 'per-request'
                        ? t('按次计费')
                        : t('按量计费')}
                    </StatusChip>
                  ) : null}
                </div>

                {!selectedModel ? (
                  <div className='flex flex-col items-center gap-2 px-4 py-10 text-center'>
                    <div className='text-sm font-semibold text-foreground'>
                      {emptyTitle || t('暂无模型')}
                    </div>
                    <div className='text-xs text-muted'>
                      {emptyDescription ||
                        t('请先新增模型或从左侧列表选择一个模型')}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className='mb-4'>
                      <div className='mb-2 font-medium text-foreground'>
                        {t('计费方式')}
                      </div>
                      <div className='inline-flex overflow-hidden rounded-xl border border-border'>
                        {[
                          { value: 'per-token', label: t('按量计费') },
                          { value: 'per-request', label: t('按次计费') },
                          { value: 'tiered_expr', label: t('表达式/阶梯计费') },
                        ].map((option) => {
                          const active =
                            option.value === selectedModel.billingMode;
                          return (
                            <button
                              key={option.value}
                              type='button'
                              onClick={() =>
                                handleBillingModeChange(option.value)
                              }
                              className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                                active
                                  ? 'bg-foreground text-background'
                                  : 'bg-background text-muted hover:bg-surface-secondary'
                              }`}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                      <div className='mt-2 text-xs text-muted'>
                        {t(
                          '这个界面默认按价格填写，保存时会自动换算回后端需要的倍率 JSON。',
                        )}
                      </div>
                    </div>

                    {selectedWarnings.length > 0 ? (
                      <div className='mb-4 rounded-xl bg-warning/10 p-3'>
                        <div className='mb-2 font-medium text-foreground'>
                          {t('当前提示')}
                        </div>
                        {selectedWarnings.map((warning) => (
                          <div
                            key={warning}
                            className='mb-1 text-sm text-foreground'
                          >
                            {warning}
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {selectedModel.billingMode === 'per-request' ? (
                      <PriceInput
                        label={t('固定价格')}
                        value={selectedModel.fixedPrice}
                        placeholder={t('输入每次调用价格')}
                        suffix={t('$/次')}
                        onChange={(value) =>
                          handleNumericFieldChange('fixedPrice', value)
                        }
                        extraText={t('适合 MJ / 任务类等按次收费模型。')}
                      />
                    ) : selectedModel.billingMode === 'tiered_expr' ? (
                      <TieredPricingEditor
                        value={selectedModel.billingExpr}
                        requestRuleExpr={selectedModel.requestRuleExpr}
                        onChange={handleBillingExprChange}
                        onRequestRuleChange={handleRequestRuleExprChange}
                      />
                    ) : (
                      <>
                        {/* 基础价格 */}
                        <div className='mb-4 rounded-xl bg-surface-secondary p-4'>
                          <div className='mb-3 font-medium text-foreground'>
                            {t('基础价格')}
                          </div>
                          <PriceInput
                            label={t('输入价格')}
                            value={selectedModel.inputPrice}
                            placeholder={t('输入 $/1M tokens')}
                            onChange={(value) =>
                              handleNumericFieldChange('inputPrice', value)
                            }
                          />
                          {selectedModel.completionRatioLocked ? (
                            <InfoBanner
                              tone='warning'
                              title={t('补全价格已锁定')}
                              description={t(
                                '该模型补全倍率由后端固定为 {{ratio}}。补全价格不能在这里修改。',
                                {
                                  ratio:
                                    selectedModel.lockedCompletionRatio || '-',
                                },
                              )}
                            />
                          ) : null}
                          <PriceInput
                            label={t('补全价格')}
                            value={selectedModel.completionPrice}
                            placeholder={t('输入 $/1M tokens')}
                            onChange={(value) =>
                              handleNumericFieldChange(
                                'completionPrice',
                                value,
                              )
                            }
                            headerAction={
                              <Switch
                                size='sm'
                                isSelected={isOptionalFieldEnabled(
                                  selectedModel,
                                  'completionPrice',
                                )}
                                isDisabled={
                                  selectedModel.completionRatioLocked
                                }
                                onValueChange={(checked) =>
                                  handleOptionalFieldToggle(
                                    'completionPrice',
                                    checked,
                                  )
                                }
                                aria-label={t('补全价格')}
                              >
                                <Switch.Control>
                                  <Switch.Thumb />
                                </Switch.Control>
                              </Switch>
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
                                        selectedModel.lockedCompletionRatio ||
                                        '-',
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
                                size='sm'
                                isSelected={isOptionalFieldEnabled(
                                  selectedModel,
                                  'cachePrice',
                                )}
                                onValueChange={(checked) =>
                                  handleOptionalFieldToggle(
                                    'cachePrice',
                                    checked,
                                  )
                                }
                                aria-label={t('缓存读取价格')}
                              >
                                <Switch.Control>
                                  <Switch.Thumb />
                                </Switch.Control>
                              </Switch>
                            }
                            hidden={
                              !isOptionalFieldEnabled(
                                selectedModel,
                                'cachePrice',
                              )
                            }
                            disabled={!hasValue(selectedModel.inputPrice)}
                            extraText={
                              !isOptionalFieldEnabled(
                                selectedModel,
                                'cachePrice',
                              )
                                ? t('当前未启用，需要时再打开即可。')
                                : ''
                            }
                          />
                          <PriceInput
                            label={t('缓存创建价格')}
                            value={selectedModel.createCachePrice}
                            placeholder={t('输入 $/1M tokens')}
                            onChange={(value) =>
                              handleNumericFieldChange(
                                'createCachePrice',
                                value,
                              )
                            }
                            headerAction={
                              <Switch
                                size='sm'
                                isSelected={isOptionalFieldEnabled(
                                  selectedModel,
                                  'createCachePrice',
                                )}
                                onValueChange={(checked) =>
                                  handleOptionalFieldToggle(
                                    'createCachePrice',
                                    checked,
                                  )
                                }
                                aria-label={t('缓存创建价格')}
                              >
                                <Switch.Control>
                                  <Switch.Thumb />
                                </Switch.Control>
                              </Switch>
                            }
                            hidden={
                              !isOptionalFieldEnabled(
                                selectedModel,
                                'createCachePrice',
                              )
                            }
                            disabled={!hasValue(selectedModel.inputPrice)}
                            extraText={
                              !isOptionalFieldEnabled(
                                selectedModel,
                                'createCachePrice',
                              )
                                ? t('当前未启用，需要时再打开即可。')
                                : ''
                            }
                          />
                        </div>

                        {/* 扩展价格 */}
                        <div className='mb-4 rounded-xl bg-surface-secondary p-4'>
                          <div className='mb-3'>
                            <div className='font-medium text-foreground'>
                              {t('扩展价格')}
                            </div>
                            <div className='mt-1 text-xs text-muted'>
                              {t('这些价格都是可选项，不填也可以。')}
                            </div>
                          </div>
                          <PriceInput
                            label={t('图片输入价格')}
                            value={selectedModel.imagePrice}
                            placeholder={t('输入 $/1M tokens')}
                            onChange={(value) =>
                              handleNumericFieldChange('imagePrice', value)
                            }
                            headerAction={
                              <Switch
                                size='sm'
                                isSelected={isOptionalFieldEnabled(
                                  selectedModel,
                                  'imagePrice',
                                )}
                                onValueChange={(checked) =>
                                  handleOptionalFieldToggle(
                                    'imagePrice',
                                    checked,
                                  )
                                }
                                aria-label={t('图片输入价格')}
                              >
                                <Switch.Control>
                                  <Switch.Thumb />
                                </Switch.Control>
                              </Switch>
                            }
                            hidden={
                              !isOptionalFieldEnabled(
                                selectedModel,
                                'imagePrice',
                              )
                            }
                            disabled={!hasValue(selectedModel.inputPrice)}
                            extraText={
                              !isOptionalFieldEnabled(
                                selectedModel,
                                'imagePrice',
                              )
                                ? t('当前未启用，需要时再打开即可。')
                                : ''
                            }
                          />
                          <PriceInput
                            label={t('音频输入价格')}
                            value={selectedModel.audioInputPrice}
                            placeholder={t('输入 $/1M tokens')}
                            onChange={(value) =>
                              handleNumericFieldChange(
                                'audioInputPrice',
                                value,
                              )
                            }
                            headerAction={
                              <Switch
                                size='sm'
                                isSelected={isOptionalFieldEnabled(
                                  selectedModel,
                                  'audioInputPrice',
                                )}
                                onValueChange={(checked) =>
                                  handleOptionalFieldToggle(
                                    'audioInputPrice',
                                    checked,
                                  )
                                }
                                aria-label={t('音频输入价格')}
                              >
                                <Switch.Control>
                                  <Switch.Thumb />
                                </Switch.Control>
                              </Switch>
                            }
                            hidden={
                              !isOptionalFieldEnabled(
                                selectedModel,
                                'audioInputPrice',
                              )
                            }
                            disabled={!hasValue(selectedModel.inputPrice)}
                            extraText={
                              !isOptionalFieldEnabled(
                                selectedModel,
                                'audioInputPrice',
                              )
                                ? t('当前未启用，需要时再打开即可。')
                                : ''
                            }
                          />
                          <PriceInput
                            label={t('音频补全价格')}
                            value={selectedModel.audioOutputPrice}
                            placeholder={t('输入 $/1M tokens')}
                            onChange={(value) =>
                              handleNumericFieldChange(
                                'audioOutputPrice',
                                value,
                              )
                            }
                            headerAction={
                              <Switch
                                size='sm'
                                isSelected={isOptionalFieldEnabled(
                                  selectedModel,
                                  'audioOutputPrice',
                                )}
                                isDisabled={
                                  !isOptionalFieldEnabled(
                                    selectedModel,
                                    'audioInputPrice',
                                  )
                                }
                                onValueChange={(checked) =>
                                  handleOptionalFieldToggle(
                                    'audioOutputPrice',
                                    checked,
                                  )
                                }
                                aria-label={t('音频补全价格')}
                              >
                                <Switch.Control>
                                  <Switch.Thumb />
                                </Switch.Control>
                              </Switch>
                            }
                            hidden={
                              !isOptionalFieldEnabled(
                                selectedModel,
                                'audioOutputPrice',
                              )
                            }
                            disabled={
                              !hasValue(selectedModel.audioInputPrice)
                            }
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
                        </div>
                      </>
                    )}

                    <div className='rounded-xl bg-surface-secondary p-4'>
                      <div className='mb-3 font-medium text-foreground'>
                        {t('保存预览')}
                      </div>
                      <div className='mb-3 text-xs text-muted'>
                        {t(
                          '下面展示这个模型保存后会写入哪些后端字段，便于和原始 JSON 编辑框保持一致。',
                        )}
                      </div>
                      <div className='grid grid-cols-[minmax(140px,180px)_1fr] gap-2'>
                        {previewRows.map((row) => (
                          <React.Fragment key={row.key}>
                            <span className='text-sm font-semibold text-foreground'>
                              {row.label}
                            </span>
                            <span className='text-sm text-foreground'>
                              {row.value}
                            </span>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </Card.Content>
            </Card>
          </div>
        </div>
      </div>

      {/* 添加模型 modal */}
      {allowAddModel ? (
        <Modal state={addModalState}>
          <ModalBackdrop variant='blur'>
            <ModalContainer size='md' placement='center'>
              <ModalDialog className='bg-background/95 backdrop-blur'>
                <ModalHeader className='border-b border-border'>
                  <span>{t('添加模型')}</span>
                </ModalHeader>
                <ModalBody className='px-6 py-5'>
                  <Input
                    value={newModelName}
                    onValueChange={setNewModelName}
                    placeholder={t('输入模型名称，例如 gpt-4.1')}
                  >
                    <Input.Control>
                      <Input.Element />
                    </Input.Control>
                  </Input>
                </ModalBody>
                <ModalFooter className='border-t border-border'>
                  <Button
                    variant='light'
                    onPress={() => {
                      setAddVisible(false);
                      setNewModelName('');
                    }}
                  >
                    {t('取消')}
                  </Button>
                  <Button color='primary' onPress={handleAddModel}>
                    {t('确定')}
                  </Button>
                </ModalFooter>
              </ModalDialog>
            </ModalContainer>
          </ModalBackdrop>
        </Modal>
      ) : null}

      {/* 批量应用 modal */}
      <Modal state={batchModalState}>
        <ModalBackdrop variant='blur'>
          <ModalContainer size='md' placement='center'>
            <ModalDialog className='bg-background/95 backdrop-blur'>
              <ModalHeader className='border-b border-border'>
                <span>{t('批量应用当前模型价格')}</span>
              </ModalHeader>
              <ModalBody className='space-y-3 px-6 py-5'>
                <div className='text-sm text-muted'>
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
                  <div className='text-xs text-muted'>
                    {t(
                      '适合同系列模型一起定价，例如把 gpt-5.1 的价格批量同步到 gpt-5.1-high、gpt-5.1-low 等模型。',
                    )}
                  </div>
                ) : null}
              </ModalBody>
              <ModalFooter className='border-t border-border'>
                <Button
                  variant='light'
                  onPress={() => setBatchVisible(false)}
                >
                  {t('取消')}
                </Button>
                <Button
                  color='primary'
                  onPress={() => {
                    if (applySelectedModelPricing()) {
                      setBatchVisible(false);
                    }
                  }}
                >
                  {t('确定')}
                </Button>
              </ModalFooter>
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      </Modal>
    </>
  );
}
