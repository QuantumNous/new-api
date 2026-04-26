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

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';
import { useIsMobile } from '../../hooks/common/useIsMobile';
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
  useOverlayState,
} from '@heroui/react';
import { Search } from 'lucide-react';

const OFFICIAL_RATIO_PRESET_ID = -100;
const MODELS_DEV_PRESET_ID = -101;
const OFFICIAL_RATIO_PRESET_NAME = '官方倍率预设';
const MODELS_DEV_PRESET_NAME = 'models.dev 价格预设';
const OFFICIAL_RATIO_PRESET_BASE_URL = 'https://basellm.github.io';
const MODELS_DEV_PRESET_BASE_URL = 'https://models.dev';

const inputClass =
  'h-10 w-full rounded-lg border border-[color:var(--app-border)] bg-background pl-9 pr-3 text-sm text-foreground outline-none transition focus:border-primary';
const selectClass =
  'h-8 w-full rounded-md border border-[color:var(--app-border)] bg-background px-2 text-sm text-foreground outline-none transition focus:border-primary';
const cellInputClass =
  'h-8 w-full rounded-md border border-[color:var(--app-border)] bg-background px-2 text-xs text-foreground outline-none transition focus:border-primary';

const ENDPOINT_TYPE_OPTIONS = [
  { label: 'ratio_config', value: 'ratio_config' },
  { label: 'pricing', value: 'pricing' },
  { label: 'OpenRouter', value: 'openrouter' },
  { label: 'custom', value: 'custom' },
];

function StatusChip({ tone, children }) {
  const cls =
    tone === 'green'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
      : tone === 'red'
        ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
        : tone === 'yellow'
          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
          : tone === 'green-light'
            ? 'border border-emerald-300 bg-background text-emerald-700'
            : 'bg-surface-secondary text-muted';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {children}
    </span>
  );
}

function HighlightText({ text, keyword }) {
  if (!keyword) return <span>{text || '-'}</span>;
  const safe = String(text || '');
  if (!safe) return <span>-</span>;
  const lower = safe.toLowerCase();
  const kw = String(keyword).toLowerCase();
  const idx = lower.indexOf(kw);
  if (idx === -1) return <span>{safe}</span>;
  return (
    <span>
      {safe.slice(0, idx)}
      <mark className='rounded bg-amber-200/70 px-0.5 text-amber-900 dark:bg-amber-700/60 dark:text-amber-100'>
        {safe.slice(idx, idx + kw.length)}
      </mark>
      {safe.slice(idx + kw.length)}
    </span>
  );
}

function HeaderCheckbox({ checked, indeterminate, onChange, ariaLabel }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
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

const ChannelSelectorModal = forwardRef(
  (
    {
      visible,
      onCancel,
      onOk,
      allChannels,
      selectedChannelIds,
      setSelectedChannelIds,
      channelEndpoints,
      updateChannelEndpoint,
      t,
    },
    ref,
  ) => {
    const isMobile = useIsMobile();
    const [searchText, setSearchText] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [filteredData, setFilteredData] = useState([]);

    useImperativeHandle(ref, () => ({
      resetPagination: () => {
        setCurrentPage(1);
        setSearchText('');
      },
    }));

    const isOfficialChannel = (record) => {
      const id = record?.key ?? record?.value ?? record?._originalData?.id;
      const base = record?._originalData?.base_url || '';
      const name = record?.label || '';
      return (
        id === OFFICIAL_RATIO_PRESET_ID ||
        id === MODELS_DEV_PRESET_ID ||
        base === OFFICIAL_RATIO_PRESET_BASE_URL ||
        base === MODELS_DEV_PRESET_BASE_URL ||
        name === OFFICIAL_RATIO_PRESET_NAME ||
        name === MODELS_DEV_PRESET_NAME
      );
    };

    useEffect(() => {
      if (!allChannels) return;
      const searchLower = searchText.trim().toLowerCase();
      const matched = searchLower
        ? allChannels.filter((item) => {
            const name = (item.label || '').toLowerCase();
            const baseUrl = (item._originalData?.base_url || '').toLowerCase();
            return name.includes(searchLower) || baseUrl.includes(searchLower);
          })
        : allChannels;

      const sorted = [...matched].sort((a, b) => {
        const wa = isOfficialChannel(a) ? 0 : 1;
        const wb = isOfficialChannel(b) ? 0 : 1;
        return wa - wb;
      });
      setFilteredData(sorted);
      setCurrentPage(1);
    }, [allChannels, searchText]);

    const total = filteredData.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const paginatedData = filteredData.slice(
      (currentPage - 1) * pageSize,
      currentPage * pageSize,
    );

    const updateEndpoint = (channelId, endpoint) => {
      if (typeof updateChannelEndpoint === 'function') {
        updateChannelEndpoint(channelId, endpoint);
      }
    };

    const getEndpointType = (ep) => {
      if (ep === '/api/ratio_config') return 'ratio_config';
      if (ep === '/api/pricing') return 'pricing';
      if (ep === 'openrouter') return 'openrouter';
      return 'custom';
    };

    const visiblePageKeys = paginatedData.map((row) => row.key ?? row.value);
    const allPageSelected =
      visiblePageKeys.length > 0 &&
      visiblePageKeys.every((key) => selectedChannelIds.includes(key));
    const somePageSelected =
      !allPageSelected &&
      visiblePageKeys.some((key) => selectedChannelIds.includes(key));

    const togglePageSelection = (checked) => {
      const set = new Set(selectedChannelIds);
      if (checked) {
        visiblePageKeys.forEach((key) => set.add(key));
      } else {
        visiblePageKeys.forEach((key) => set.delete(key));
      }
      setSelectedChannelIds(Array.from(set));
    };

    const toggleRowSelection = (key, checked) => {
      const set = new Set(selectedChannelIds);
      if (checked) set.add(key);
      else set.delete(key);
      setSelectedChannelIds(Array.from(set));
    };

    const renderStatusCell = (record) => {
      const status = record?._originalData?.status || 0;
      const official = isOfficialChannel(record);
      let chip = null;
      if (status === 1) chip = <StatusChip tone='green'>{t('已启用')}</StatusChip>;
      else if (status === 2) chip = <StatusChip tone='red'>{t('已禁用')}</StatusChip>;
      else if (status === 3)
        chip = <StatusChip tone='yellow'>{t('自动禁用')}</StatusChip>;
      else chip = <StatusChip>{t('未知状态')}</StatusChip>;
      return (
        <div className='flex items-center gap-1.5'>
          {chip}
          {official ? (
            <StatusChip tone='green-light'>{t('官方')}</StatusChip>
          ) : null}
        </div>
      );
    };

    const renderEndpointCell = (record) => {
      const channelId = record.key || record.value;
      const currentEndpoint = channelEndpoints[channelId] || '';
      const currentType = getEndpointType(currentEndpoint);

      const handleTypeChange = (val) => {
        if (val === 'ratio_config') {
          updateEndpoint(channelId, '/api/ratio_config');
        } else if (val === 'pricing') {
          updateEndpoint(channelId, '/api/pricing');
        } else if (val === 'openrouter') {
          updateEndpoint(channelId, 'openrouter');
        } else if (currentType !== 'custom') {
          updateEndpoint(channelId, '');
        }
      };

      return (
        <div className='flex items-center gap-2'>
          <select
            value={currentType}
            onChange={(event) => handleTypeChange(event.target.value)}
            aria-label={t('同步接口')}
            className={`${selectClass} w-28`}
          >
            {ENDPOINT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {currentType === 'custom' ? (
            <Input
              type='text'
              value={currentEndpoint}
              onChange={(event) =>
                updateEndpoint(channelId, event.target.value)
              }
              placeholder='/your/endpoint'
              aria-label={t('自定义同步接口路径')}
              className={`${cellInputClass} w-40`}
            />
          ) : null}
        </div>
      );
    };

    const modalState = useOverlayState({
      isOpen: !!visible,
      onOpenChange: (isOpen) => {
        if (!isOpen) onCancel?.();
      },
    });

    return (
      <Modal state={modalState}>
        <ModalBackdrop variant='blur'>
          <ModalContainer
            size={isMobile ? 'full' : 'xl'}
            placement='center'
          >
            <ModalDialog className='bg-background/95 backdrop-blur'>
              <ModalHeader className='border-b border-slate-200/80 dark:border-white/10'>
                <span className='text-lg font-semibold'>
                  {t('选择同步渠道')}
                </span>
              </ModalHeader>
              <ModalBody className='space-y-3 px-6 py-5'>
                <div className='relative'>
                  <Search
                    size={14}
                    className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted'
                  />
                  <Input
                    type='text'
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder={t('搜索渠道名称或地址')}
                    aria-label={t('搜索渠道名称或地址')}
                    className={inputClass}
                  />
                </div>

                <div className='overflow-x-auto rounded-xl border border-[color:var(--app-border)]'>
                  <table className='w-full text-sm'>
                    <thead className='bg-[color:var(--app-background)] text-xs uppercase text-muted'>
                      <tr>
                        <th className='w-10 px-3 py-2 text-left font-semibold'>
                          <HeaderCheckbox
                            checked={allPageSelected}
                            indeterminate={somePageSelected}
                            onChange={togglePageSelection}
                            ariaLabel={t('选择当前页')}
                          />
                        </th>
                        <th className='px-3 py-2 text-left font-semibold'>
                          {t('名称')}
                        </th>
                        <th className='px-3 py-2 text-left font-semibold'>
                          {t('源地址')}
                        </th>
                        <th className='px-3 py-2 text-left font-semibold'>
                          {t('状态')}
                        </th>
                        <th className='px-3 py-2 text-left font-semibold'>
                          {t('同步接口')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className='divide-y divide-[color:var(--app-border)]'>
                      {paginatedData.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className='py-10 text-center text-sm text-muted'
                          >
                            {t('暂无数据')}
                          </td>
                        </tr>
                      ) : (
                        paginatedData.map((record) => {
                          const key = record.key || record.value;
                          const checked = selectedChannelIds.includes(key);
                          return (
                            <tr key={key}>
                              <td className='px-3 py-2'>
                                <input
                                  type='checkbox'
                                  checked={checked}
                                  onChange={(event) =>
                                    toggleRowSelection(
                                      key,
                                      event.target.checked,
                                    )
                                  }
                                  className='h-4 w-4 accent-primary'
                                />
                              </td>
                              <td className='px-3 py-2 text-foreground'>
                                <HighlightText
                                  text={record.label}
                                  keyword={searchText}
                                />
                              </td>
                              <td className='px-3 py-2 text-muted'>
                                <HighlightText
                                  text={record._originalData?.base_url || ''}
                                  keyword={searchText}
                                />
                              </td>
                              <td className='px-3 py-2'>
                                {renderStatusCell(record)}
                              </td>
                              <td className='px-3 py-2'>
                                {renderEndpointCell(record)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className='flex flex-wrap items-center justify-between gap-2 text-xs text-muted'>
                  <div className='flex items-center gap-2'>
                    <span>{t('每页')}</span>
                    <select
                      value={String(pageSize)}
                      onChange={(event) => {
                        setPageSize(Number(event.target.value));
                        setCurrentPage(1);
                      }}
                      aria-label={t('每页数量')}
                      className='h-7 rounded-md border border-[color:var(--app-border)] bg-background px-2 text-xs outline-none focus:border-primary'
                    >
                      {[10, 20, 50, 100].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                    <span>
                      {t('共 {{total}} 条', { total })}
                    </span>
                  </div>
                  <div className='flex items-center gap-1'>
                    <Button
                      size='sm'
                      variant='light'
                      isDisabled={currentPage <= 1}
                      onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
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
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                    >
                      {t('下一页')}
                    </Button>
                  </div>
                </div>
              </ModalBody>
              <ModalFooter className='border-t border-slate-200/80 dark:border-white/10'>
                <Button variant='light' onPress={onCancel}>
                  {t('取消')}
                </Button>
                <Button color='primary' onPress={onOk}>
                  {t('确定')}
                </Button>
              </ModalFooter>
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      </Modal>
    );
  },
);

export default ChannelSelectorModal;
