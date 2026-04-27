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

import React, { useState, useEffect } from 'react';
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
  useOverlayState,
} from '@heroui/react';
import { Save, X, Server } from 'lucide-react';
import { API, showError, showSuccess } from '../../../../helpers';
import { useTranslation } from 'react-i18next';

const inputClass =
  'h-10 w-full rounded-lg border border-[color:var(--app-border)] bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary';

const NAME_PATTERN = /^[a-zA-Z0-9-_\u4e00-\u9fa5]+$/;

const EditDeploymentModal = ({
  refresh,
  editingDeployment,
  visible,
  handleClose,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const isEdit = Boolean(editingDeployment?.id);
  const title = t('重命名部署');

  useEffect(() => {
    if (visible) {
      setName(editingDeployment?.deployment_name || '');
      setError('');
    } else {
      setName('');
      setError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, editingDeployment?.id]);

  const validate = () => {
    if (!name.trim()) {
      setError(t('请输入部署名称'));
      return false;
    }
    if (!NAME_PATTERN.test(name.trim())) {
      setError(t('部署名称只能包含字母、数字、横线、下划线和中文'));
      return false;
    }
    setError('');
    return true;
  };

  const handleSubmit = async () => {
    if (!isEdit || !editingDeployment?.id) {
      showError(t('无效的部署信息'));
      return;
    }
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await API.put(
        `/api/deployments/${editingDeployment.id}/name`,
        { name: name.trim() },
      );
      if (res.data?.success) {
        showSuccess(t('部署名称更新成功'));
        handleClose?.();
        refresh?.();
      } else {
        showError(res.data?.message || t('更新失败'));
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Submit error:', err);
      showError(t('更新失败，请检查输入信息'));
    } finally {
      setLoading(false);
    }
  };

  const modalState = useOverlayState({
    isOpen: !!visible,
    onOpenChange: (isOpen) => {
      if (!isOpen) handleClose?.();
    },
  });

  return (
    <Modal state={modalState}>
      <ModalBackdrop variant='blur'>
        <ModalContainer size='md' placement='center'>
          <ModalDialog className='bg-background/95 backdrop-blur'>
            <ModalHeader className='border-b border-border'>
              <div className='flex items-center gap-2'>
                <Server size={18} />
                <span>{title}</span>
              </div>
            </ModalHeader>
            <ModalBody className='space-y-4 px-6 py-5'>
              <Card className='!rounded-xl border border-[color:var(--app-border)] shadow-sm'>
                <Card.Content className='space-y-4 p-5'>
                  <div className='text-base font-semibold text-foreground'>
                    {t('修改部署名称')}
                  </div>

                  <div className='space-y-2'>
                    <div className='text-sm font-medium text-foreground'>
                      {t('部署名称')}
                      <span className='ml-1 text-red-500'>*</span>
                    </div>
                    <Input
                      type='text'
                      value={name}
                      onChange={(event) => {
                        setName(event.target.value);
                        if (error) setError('');
                      }}
                      placeholder={t('请输入新的部署名称')}
                      aria-label={t('部署名称')}
                      className={inputClass}
                    />
                    {error ? (
                      <div className='text-xs text-red-600 dark:text-red-400'>
                        {error}
                      </div>
                    ) : null}
                  </div>

                  {isEdit ? (
                    <div className='space-y-1 rounded-lg bg-[color:var(--app-background)] p-3 text-sm'>
                      <div className='flex flex-wrap items-center gap-1'>
                        <span className='text-muted'>{t('部署ID')}:</span>
                        <code className='rounded bg-background px-1.5 py-0.5 text-xs text-foreground'>
                          {editingDeployment.id}
                        </code>
                      </div>
                      <div className='flex flex-wrap items-center gap-1'>
                        <span className='text-muted'>{t('当前状态')}:</span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            editingDeployment.status === 'running'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'bg-surface-secondary text-foreground'
                          }`}
                        >
                          {editingDeployment.status}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </Card.Content>
              </Card>
            </ModalBody>
            <ModalFooter className='border-t border-border'>
              <Button
                variant='tertiary'
                onPress={handleClose}
                isDisabled={loading}
                startContent={<X size={14} />}
              >
                {t('取消')}
              </Button>
              <Button
                color='primary'
                onPress={handleSubmit}
                isPending={loading}
                startContent={<Save size={14} />}
              >
                {isEdit ? t('更新') : t('创建')}
              </Button>
            </ModalFooter>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
};

export default EditDeploymentModal;
