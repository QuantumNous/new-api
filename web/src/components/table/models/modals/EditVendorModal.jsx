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
import { ExternalLink } from 'lucide-react';
import { API, showError, showSuccess } from '../../../../helpers';
import { useTranslation } from 'react-i18next';

const inputClass =
  'h-10 w-full rounded-lg border border-[color:var(--app-border)] bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary';

const textareaClass =
  'w-full resize-y rounded-lg border border-[color:var(--app-border)] bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary';

const EditVendorModal = ({ visible, handleClose, refresh, editingVendor }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [values, setValues] = useState({
    name: '',
    description: '',
    icon: '',
    status: true,
  });
  const [errors, setErrors] = useState({});

  const isEdit = editingVendor && editingVendor.id !== undefined;

  const setField = (key) => (value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const reset = () => {
    setValues({ name: '', description: '', icon: '', status: true });
    setErrors({});
  };

  const handleCancel = () => {
    handleClose?.();
    reset();
  };

  const loadVendor = async () => {
    if (!isEdit || !editingVendor.id) return;
    setLoading(true);
    try {
      const res = await API.get(`/api/vendors/${editingVendor.id}`);
      const { success, message, data } = res.data || {};
      if (success && data) {
        setValues({
          name: data.name || '',
          description: data.description || '',
          icon: data.icon || '',
          status: data.status === 1 || data.status === true,
        });
      } else {
        showError(message);
      }
    } catch (error) {
      showError(t('加载供应商信息失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      if (isEdit) {
        loadVendor();
      } else {
        reset();
      }
    } else {
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, editingVendor?.id]);

  const submit = async () => {
    if (!values.name?.trim()) {
      setErrors({ name: t('请输入供应商名称') });
      return;
    }
    setLoading(true);
    try {
      const submitData = { ...values, status: values.status ? 1 : 0 };
      if (isEdit) {
        submitData.id = editingVendor.id;
        const res = await API.put('/api/vendors/', submitData);
        const { success, message } = res.data || {};
        if (success) {
          showSuccess(t('供应商更新成功！'));
          refresh?.();
          handleClose?.();
        } else {
          showError(t(message));
        }
      } else {
        const res = await API.post('/api/vendors/', submitData);
        const { success, message } = res.data || {};
        if (success) {
          showSuccess(t('供应商创建成功！'));
          refresh?.();
          handleClose?.();
        } else {
          showError(t(message));
        }
      }
    } catch (error) {
      showError(error.response?.data?.message || t('操作失败'));
    } finally {
      setLoading(false);
    }
  };

  const modalState = useOverlayState({
    isOpen: !!visible,
    onOpenChange: (isOpen) => {
      if (!isOpen) handleCancel();
    },
  });

  return (
    <Modal state={modalState}>
      <ModalBackdrop variant='blur'>
        <ModalContainer size='md' placement='center'>
          <ModalDialog className='bg-background/95 backdrop-blur'>
            <ModalHeader className='border-b border-border'>
              {isEdit ? t('编辑供应商') : t('新增供应商')}
            </ModalHeader>
            <ModalBody className='space-y-4 px-6 py-5'>
              <div className='space-y-2'>
                <div className='text-sm font-medium text-foreground'>
                  {t('供应商名称')}
                  <span className='ml-1 text-red-500'>*</span>
                </div>
                <Input
                  type='text'
                  value={values.name}
                  onChange={(event) => setField('name')(event.target.value)}
                  placeholder={t('请输入供应商名称，如：OpenAI')}
                  aria-label={t('供应商名称')}
                  className={inputClass}
                />
                {errors.name ? (
                  <div className='text-xs text-red-600'>{errors.name}</div>
                ) : null}
              </div>

              <div className='space-y-2'>
                <div className='text-sm font-medium text-foreground'>
                  {t('描述')}
                </div>
                <textarea
                  value={values.description}
                  onChange={(event) => setField('description')(event.target.value)}
                  placeholder={t('请输入供应商描述')}
                  rows={3}
                  aria-label={t('描述')}
                  className={textareaClass}
                />
              </div>

              <div className='space-y-2'>
                <div className='text-sm font-medium text-foreground'>
                  {t('供应商图标')}
                </div>
                <Input
                  type='text'
                  value={values.icon}
                  onChange={(event) => setField('icon')(event.target.value)}
                  placeholder={t('请输入图标名称')}
                  aria-label={t('供应商图标')}
                  className={inputClass}
                />
                <div className='text-xs leading-snug text-muted'>
                  {t(
                    "图标使用@lobehub/icons库，如：OpenAI、Claude.Color，支持链式参数：OpenAI.Avatar.type={'platform'}、OpenRouter.Avatar.shape={'square'}，查询所有可用图标请 ",
                  )}
                  <a
                    href='https://icons.lobehub.com/components/lobe-hub'
                    target='_blank'
                    rel='noreferrer'
                    className='inline-flex items-center gap-1 text-primary underline'
                  >
                    {t('请点击我')}
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>

              <label className='flex items-center justify-between gap-3 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-background)] p-4'>
                <div className='text-sm font-medium text-foreground'>
                  {t('状态')}
                </div>
                <Switch
                  isSelected={!!values.status}
                  onChange={setField('status')}
                  aria-label={t('状态')}
                  size='sm'
                >
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              </label>
            </ModalBody>
            <ModalFooter className='border-t border-border'>
              <Button variant='tertiary' onPress={handleCancel}>
                {t('取消')}
              </Button>
              <Button color='primary' onPress={submit} isPending={loading}>
                {t('确定')}
              </Button>
            </ModalFooter>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
};

export default EditVendorModal;
