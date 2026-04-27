/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useEffect, useRef } from 'react';
import {
  Button,
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
import { Info, Search, Settings } from 'lucide-react';
import { copy, showError, showInfo, showSuccess } from '../../../../helpers';
import { warningGhostButtonClass } from '../../../common/ui/buttonTones';
import { MODEL_TABLE_PAGE_SIZE } from '../../../../constants';

const TAG_TONE = {
  green: 'bg-success/15 text-success',
  blue: 'bg-primary/15 text-primary',
  red: 'bg-danger/15 text-danger',
  grey: 'bg-surface-secondary text-muted',
};

function StatusChip({ tone = 'grey', children }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        TAG_TONE[tone] || TAG_TONE.grey
      }`}
    >
      {children}
    </span>
  );
}

// Mirrors `HeaderCheckbox` from PricingTable / SettingsAPIInfo:
// `indeterminate` is set imperatively on the DOM element so the visual
// minus state shows up between checked/unchecked.
function HeaderCheckbox({ checked, indeterminate, onChange, ariaLabel }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate && !checked;
  }, [indeterminate, checked]);
  return (
    <input
      ref={ref}
      type='checkbox'
      checked={!!checked}
      onChange={(event) => onChange(event.target.checked)}
      aria-label={ariaLabel}
      className='h-4 w-4 accent-primary'
    />
  );
}

const ModelTestModal = ({
  showModelTestModal,
  currentTestChannel,
  handleCloseModal,
  isBatchTesting,
  batchTestModels,
  modelSearchKeyword,
  setModelSearchKeyword,
  selectedModelKeys,
  setSelectedModelKeys,
  modelTestResults,
  testingModels,
  testChannel,
  modelTablePage,
  setModelTablePage,
  selectedEndpointType,
  setSelectedEndpointType,
  isStreamTest,
  setIsStreamTest,
  allSelectingRef,
  isMobile,
  t,
}) => {
  const hasChannel = Boolean(currentTestChannel);
  const streamToggleDisabled = [
    'embeddings',
    'image-generation',
    'jina-rerank',
    'openai-response-compact',
  ].includes(selectedEndpointType);

  const modalState = useOverlayState({
    isOpen: showModelTestModal,
    onOpenChange: (isOpen) => {
      if (!isOpen) handleCloseModal?.();
    },
  });

  useEffect(() => {
    if (streamToggleDisabled && isStreamTest) {
      setIsStreamTest(false);
    }
  }, [streamToggleDisabled, isStreamTest, setIsStreamTest]);

  const filteredModels = hasChannel
    ? currentTestChannel.models
        .split(',')
        .filter((model) =>
          model.toLowerCase().includes(modelSearchKeyword.toLowerCase()),
        )
    : [];

  const endpointTypeOptions = [
    { value: '', label: t('自动检测') },
    { value: 'openai', label: 'OpenAI (/v1/chat/completions)' },
    { value: 'openai-response', label: 'OpenAI Response (/v1/responses)' },
    {
      value: 'openai-response-compact',
      label: 'OpenAI Response Compaction (/v1/responses/compact)',
    },
    { value: 'anthropic', label: 'Anthropic (/v1/messages)' },
    {
      value: 'gemini',
      label: 'Gemini (/v1beta/models/{model}:generateContent)',
    },
    { value: 'jina-rerank', label: 'Jina Rerank (/v1/rerank)' },
    {
      value: 'image-generation',
      label: t('图像生成') + ' (/v1/images/generations)',
    },
    { value: 'embeddings', label: 'Embeddings (/v1/embeddings)' },
  ];

  const handleCopySelected = () => {
    if (selectedModelKeys.length === 0) {
      showError(t('请先选择模型！'));
      return;
    }
    copy(selectedModelKeys.join(',')).then((ok) => {
      if (ok) {
        showSuccess(
          t('已复制 ${count} 个模型').replace(
            '${count}',
            selectedModelKeys.length,
          ),
        );
      } else {
        showError(t('复制失败，请手动复制'));
      }
    });
  };

  const handleSelectSuccess = () => {
    if (!currentTestChannel) return;
    const successKeys = currentTestChannel.models
      .split(',')
      .filter((m) => m.toLowerCase().includes(modelSearchKeyword.toLowerCase()))
      .filter((m) => {
        const result = modelTestResults[`${currentTestChannel.id}-${m}`];
        return result && result.success;
      });
    if (successKeys.length === 0) {
      showInfo(t('暂无成功模型'));
    }
    setSelectedModelKeys(successKeys);
  };

  // Pagination + slicing
  const totalRows = filteredModels.length;
  const totalPages = Math.max(
    1,
    Math.ceil(totalRows / MODEL_TABLE_PAGE_SIZE) || 1,
  );
  const safePage = Math.min(Math.max(1, modelTablePage), totalPages);
  const startIndex = (safePage - 1) * MODEL_TABLE_PAGE_SIZE;
  const pagedModels = filteredModels
    .slice(startIndex, startIndex + MODEL_TABLE_PAGE_SIZE)
    .map((model) => ({ model, key: model }));

  // Page checkbox state
  const pageRowKeys = pagedModels.map((row) => row.key);
  const allPageSelected =
    pageRowKeys.length > 0 &&
    pageRowKeys.every((key) => selectedModelKeys.includes(key));
  const somePageSelected =
    !allPageSelected &&
    pageRowKeys.some((key) => selectedModelKeys.includes(key));

  const togglePageSelection = (checked) => {
    if (allSelectingRef) {
      allSelectingRef.current = true;
    }
    if (checked) {
      setSelectedModelKeys(filteredModels);
    } else {
      setSelectedModelKeys([]);
    }
  };

  const toggleRowSelection = (key, checked) => {
    if (allSelectingRef && allSelectingRef.current) {
      allSelectingRef.current = false;
      return;
    }
    if (checked) {
      setSelectedModelKeys(Array.from(new Set([...selectedModelKeys, key])));
    } else {
      setSelectedModelKeys(selectedModelKeys.filter((item) => item !== key));
    }
  };

  // Renders a single status cell — replaces the Semi columns[].render
  // closure for the 状态 column.
  const renderStatusCell = (record) => {
    const testResult =
      modelTestResults[`${currentTestChannel.id}-${record.model}`];
    const isTesting = testingModels.has(record.model);

    if (isTesting) {
      return <StatusChip tone='blue'>{t('测试中')}</StatusChip>;
    }

    if (!testResult) {
      return <StatusChip tone='grey'>{t('未开始')}</StatusChip>;
    }

    return (
      <div className='flex flex-col gap-1'>
        <div className='flex items-center gap-2'>
          <StatusChip tone={testResult.success ? 'green' : 'red'}>
            {testResult.success ? t('成功') : t('失败')}
          </StatusChip>
          {testResult.success && (
            <span className='text-xs text-muted tabular-nums'>
              {t('请求时长: ${time}s').replace(
                '${time}',
                testResult.time.toFixed(2),
              )}
            </span>
          )}
        </div>
        {!testResult.success && testResult.message && (
          <div className='flex flex-col gap-1'>
            <span
              className='break-all text-xs text-danger'
              style={{ maxWidth: '400px' }}
            >
              {testResult.message}
            </span>
            {testResult.errorCode === 'model_price_error' && (
              <Button
                size='sm'
                variant='tertiary'
                onPress={() =>
                  window.open('/console/setting?tab=ratio', '_blank')
                }
                className={`w-fit ${warningGhostButtonClass}`}
              >
                <Settings size={12} />
                {t('前往设置')}
              </Button>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderActionCell = (record) => {
    const isTesting = testingModels.has(record.model);
    return (
      <Button
        size='sm'
        variant='tertiary'
        isPending={isTesting}
        onPress={() =>
          testChannel(
            currentTestChannel,
            record.model,
            selectedEndpointType,
            isStreamTest,
          )
        }
      >
        {t('测试')}
      </Button>
    );
  };

  return (
    <Modal state={modalState}>
      <ModalBackdrop variant='blur' isDismissable={!isBatchTesting}>
        <ModalContainer
          size={isMobile ? 'full' : 'xl'}
          scroll='inside'
          placement='center'
        >
          <ModalDialog className='bg-background/95 backdrop-blur'>
            <ModalHeader className='border-b border-border'>
              {hasChannel ? (
                <div className='flex flex-col gap-1 w-full'>
                  <div className='flex items-center gap-2'>
                    <span className='text-base font-semibold text-foreground'>
                      {currentTestChannel.name} {t('渠道的模型测试')}
                    </span>
                    <span className='text-xs text-muted'>
                      {t('共')} {currentTestChannel.models.split(',').length}{' '}
                      {t('个模型')}
                    </span>
                  </div>
                </div>
              ) : null}
            </ModalHeader>
            <ModalBody className='max-h-[70vh] overflow-y-auto px-4 py-4 md:px-6'>
              {hasChannel && (
                <div className='space-y-3'>
                  {/* Endpoint toolbar */}
                  <div className='flex w-full flex-col gap-2 sm:flex-row sm:items-center'>
                    <div className='flex flex-1 items-center gap-2 min-w-0'>
                      <span className='shrink-0 text-sm font-semibold text-foreground'>
                        {t('端点类型')}:
                      </span>
                      <select
                        value={selectedEndpointType}
                        onChange={(event) =>
                          setSelectedEndpointType(event.target.value)
                        }
                        aria-label={t('选择端点类型')}
                        className='h-9 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary'
                      >
                        {endpointTypeOptions.map((option) => (
                          <option
                            key={String(option.value)}
                            value={option.value}
                          >
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <label className='flex items-center justify-between gap-2 sm:justify-end'>
                      <span className='text-sm font-semibold text-foreground'>
                        {t('流式')}:
                      </span>
                      <Switch
                        isSelected={isStreamTest}
                        onValueChange={setIsStreamTest}
                        size='sm'
                        isDisabled={streamToggleDisabled}
                        aria-label={t('流式')}
                      >
                        <Switch.Control>
                          <Switch.Thumb />
                        </Switch.Control>
                      </Switch>
                    </label>
                  </div>

                  {/* Info banner */}
                  <div className='flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted'>
                    <Info size={14} className='mt-0.5 shrink-0 text-primary' />
                    <span>
                      {t(
                        '说明：本页测试为非流式请求；若渠道仅支持流式返回，可能出现测试失败，请以实际使用为准。',
                      )}
                    </span>
                  </div>

                  {/* Search + actions */}
                  <div className='flex w-full flex-col gap-2 sm:flex-row sm:items-center'>
                    <div className='relative flex-1'>
                      <Search
                        className='pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted'
                        size={14}
                      />
                      <Input
                        aria-label={t('搜索模型')}
                        placeholder={t('搜索模型...')}
                        value={modelSearchKeyword}
                        onValueChange={(value) => {
                          setModelSearchKeyword(value);
                          setModelTablePage(1);
                        }}
                        size='sm'
                        className='w-full [&_input]:pl-7'
                      />
                    </div>
                    <div className='flex items-center justify-end gap-2'>
                      <Button onPress={handleCopySelected}>
                        {t('复制已选')}
                      </Button>
                      <Button variant='tertiary' onPress={handleSelectSuccess}>
                        {t('选择成功')}
                      </Button>
                    </div>
                  </div>

                  {/* Native HTML table */}
                  <div className='overflow-hidden rounded-2xl border border-border bg-background'>
                    <div className='overflow-x-auto'>
                      <table className='min-w-full border-collapse text-sm'>
                        <thead className='bg-surface-secondary text-left text-xs font-semibold uppercase tracking-wide text-muted'>
                          <tr>
                            <th className='w-10 px-3 py-3'>
                              <HeaderCheckbox
                                checked={allPageSelected}
                                indeterminate={somePageSelected}
                                onChange={togglePageSelection}
                                ariaLabel={t('全选')}
                              />
                            </th>
                            <th className='px-4 py-3'>{t('模型名称')}</th>
                            <th className='px-4 py-3'>{t('状态')}</th>
                            <th className='px-4 py-3' />
                          </tr>
                        </thead>
                        <tbody className='divide-y divide-border'>
                          {pagedModels.length === 0 ? (
                            <tr>
                              <td
                                colSpan={4}
                                className='py-10 text-center text-sm text-muted'
                              >
                                {t('暂无数据')}
                              </td>
                            </tr>
                          ) : (
                            pagedModels.map((row) => {
                              const checked = selectedModelKeys.includes(
                                row.key,
                              );
                              return (
                                <tr key={row.key}>
                                  <td className='w-10 px-3 py-2 align-middle'>
                                    <input
                                      type='checkbox'
                                      checked={checked}
                                      onChange={(event) =>
                                        toggleRowSelection(
                                          row.key,
                                          event.target.checked,
                                        )
                                      }
                                      aria-label={t('选择行')}
                                      className='h-4 w-4 accent-primary'
                                    />
                                  </td>
                                  <td className='px-4 py-2 align-middle'>
                                    <span className='font-semibold text-foreground'>
                                      {row.model}
                                    </span>
                                  </td>
                                  <td className='px-4 py-2 align-middle'>
                                    {renderStatusCell(row)}
                                  </td>
                                  <td className='px-4 py-2 text-right align-middle'>
                                    {renderActionCell(row)}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Pagination */}
                  {totalRows > 0 && (
                    <div className='flex flex-wrap items-center justify-between gap-2 text-xs text-muted'>
                      <span>{t('共 {{total}} 条', { total: totalRows })}</span>
                      <div className='flex items-center gap-1'>
                        <Button
                          size='sm'
                          variant='tertiary'
                          isDisabled={safePage <= 1}
                          onPress={() =>
                            setModelTablePage(Math.max(1, safePage - 1))
                          }
                        >
                          {t('上一页')}
                        </Button>
                        <span className='tabular-nums'>
                          {safePage} / {totalPages}
                        </span>
                        <Button
                          size='sm'
                          variant='tertiary'
                          isDisabled={safePage >= totalPages}
                          onPress={() =>
                            setModelTablePage(
                              Math.min(totalPages, safePage + 1),
                            )
                          }
                        >
                          {t('下一页')}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ModalBody>
            {hasChannel && (
              <ModalFooter className='border-t border-border'>
                {isBatchTesting ? (
                  <Button color='danger' onPress={handleCloseModal}>
                    {t('停止测试')}
                  </Button>
                ) : (
                  <Button variant='tertiary' onPress={handleCloseModal}>
                    {t('取消')}
                  </Button>
                )}
                <Button
                  color='primary'
                  isPending={isBatchTesting}
                  isDisabled={isBatchTesting}
                  onPress={batchTestModels}
                >
                  {isBatchTesting
                    ? t('测试中...')
                    : t('批量测试${count}个模型').replace(
                        '${count}',
                        filteredModels.length,
                      )}
                </Button>
              </ModalFooter>
            )}
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
};

export default ModelTestModal;
