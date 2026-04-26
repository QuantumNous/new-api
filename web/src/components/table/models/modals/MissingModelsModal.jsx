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

import React, { useEffect, useState } from 'react';
import {
  Button,
  Input,
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalHeader,
  Spinner,
  useOverlayState,
} from '@heroui/react';
import { Inbox, Search } from 'lucide-react';
import { API, showError } from '../../../../helpers';
import { MODEL_TABLE_PAGE_SIZE } from '../../../../constants';

function EmptyState({ description }) {
  return (
    <div className='flex flex-col items-center gap-3 py-10 text-center text-sm text-muted'>
      <div className='flex h-16 w-16 items-center justify-center rounded-full bg-surface-secondary text-muted'>
        <Inbox size={28} />
      </div>
      <div>{description}</div>
    </div>
  );
}

function Pager({ current, pageSize, total, onChange, t }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;
  return (
    <div className='mt-3 flex items-center justify-end gap-2 text-sm text-muted'>
      <span>
        {t('共 {{total}} 条', { total })}
      </span>
      <Button
        size='sm'
        variant='light'
        isDisabled={current <= 1}
        onPress={() => onChange(current - 1)}
      >
        {t('上一页')}
      </Button>
      <span>
        {current} / {totalPages}
      </span>
      <Button
        size='sm'
        variant='light'
        isDisabled={current >= totalPages}
        onPress={() => onChange(current + 1)}
      >
        {t('下一页')}
      </Button>
    </div>
  );
}

const MissingModelsModal = ({ visible, onClose, onConfigureModel, t }) => {
  const [loading, setLoading] = useState(false);
  const [missingModels, setMissingModels] = useState([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const fetchMissing = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/models/missing');
      if (res.data?.success) {
        setMissingModels(res.data.data || []);
      } else {
        showError(res.data?.message);
      }
    } catch (_) {
      showError(t('获取未配置模型失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchMissing();
      setSearchKeyword('');
      setCurrentPage(1);
    } else {
      setMissingModels([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const filteredModels = missingModels.filter((model) =>
    model.toLowerCase().includes(searchKeyword.toLowerCase()),
  );
  const start = (currentPage - 1) * MODEL_TABLE_PAGE_SIZE;
  const pageItems = filteredModels.slice(start, start + MODEL_TABLE_PAGE_SIZE);

  const modalState = useOverlayState({
    isOpen: !!visible,
    onOpenChange: (isOpen) => {
      if (!isOpen) onClose?.();
    },
  });

  return (
    <Modal state={modalState}>
      <ModalBackdrop variant='blur'>
        <ModalContainer size='md' placement='center'>
          <ModalDialog className='bg-background/95 backdrop-blur'>
            <ModalHeader className='border-b border-border'>
              <div className='flex flex-wrap items-center gap-2'>
                <span className='text-base font-semibold text-foreground'>
                  {t('未配置的模型列表')}
                </span>
                <span className='text-xs text-muted'>
                  {t('共')} {missingModels.length} {t('个未配置模型')}
                </span>
              </div>
            </ModalHeader>
            <ModalBody className='space-y-4 px-6 py-5'>
              {loading ? (
                <div className='flex items-center justify-center py-10'>
                  <Spinner />
                </div>
              ) : missingModels.length === 0 ? (
                <EmptyState description={t('暂无缺失模型')} />
              ) : (
                <>
                  <div className='relative'>
                    <Search
                      size={14}
                      className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted'
                    />
                    <Input
                      type='text'
                      placeholder={t('搜索模型...')}
                      value={searchKeyword}
                      onChange={(event) => {
                        setSearchKeyword(event.target.value);
                        setCurrentPage(1);
                      }}
                      aria-label={t('搜索模型')}
                      className='h-10 w-full rounded-lg border border-[color:var(--app-border)] bg-background pl-9 pr-3 text-sm text-foreground outline-none transition focus:border-primary'
                    />
                  </div>

                  {filteredModels.length > 0 ? (
                    <div className='overflow-hidden rounded-xl border border-[color:var(--app-border)]'>
                      <table className='w-full text-sm'>
                        <thead className='bg-[color:var(--app-background)] text-xs uppercase text-muted'>
                          <tr>
                            <th className='px-4 py-2 text-left font-semibold'>
                              {t('模型名称')}
                            </th>
                            <th className='w-32 px-4 py-2 text-right font-semibold'>
                              &nbsp;
                            </th>
                          </tr>
                        </thead>
                        <tbody className='divide-y divide-[color:var(--app-border)]'>
                          {pageItems.map((model) => (
                            <tr key={model}>
                              <td className='px-4 py-2 font-medium text-foreground'>
                                {model}
                              </td>
                              <td className='px-4 py-2 text-right'>
                                <Button
                                  color='primary'
                                  size='sm'
                                  onPress={() => onConfigureModel?.(model)}
                                >
                                  {t('配置')}
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptyState
                      description={
                        searchKeyword
                          ? t('未找到匹配的模型')
                          : t('暂无缺失模型')
                      }
                    />
                  )}

                  <Pager
                    current={currentPage}
                    pageSize={MODEL_TABLE_PAGE_SIZE}
                    total={filteredModels.length}
                    onChange={(p) => setCurrentPage(p)}
                    t={t}
                  />
                </>
              )}
            </ModalBody>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
};

export default MissingModelsModal;
