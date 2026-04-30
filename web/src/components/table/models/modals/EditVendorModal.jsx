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

// EditVendorModal — refactored against the official HeroUI v3 Modal
// anatomy (https://heroui.com/docs/react/components/modal):
//
//   <Modal>
//     <Modal.Backdrop variant='blur' isOpen onOpenChange>
//       <Modal.Container size='md' placement='center'>
//         <Modal.Dialog>
//           <Modal.Header>
//             <Modal.Heading />
//             <Modal.CloseTrigger />
//           </Modal.Header>
//           <Modal.Body />
//           <Modal.Footer />
//         </Modal.Dialog>
//       </Modal.Container>
//     </Modal.Backdrop>
//   </Modal>
//
// Two notable departures from the previous version:
//   • Drop `useOverlayState` + `<Modal state>` controlled-shim. The
//     v3 doc's recommended pattern is to plug `visible` straight into
//     `<Modal.Backdrop isOpen onOpenChange>`. Less indirection, and
//     consistent with how Modal.Trigger composes when present.
//   • Use dot-notation (Modal.Header, Modal.Body, ...) so all
//     compound parts come from the same import. The previous flat
//     imports (ModalHeader, ModalBody, ...) still work but the dot
//     notation is what the official anatomy spells out.
//
// Form fields use HeroUI Input / TextArea / Switch and the textarea
// no longer falls back to a native `<textarea>` (the previous version
// did, which broke visual rhythm against the HeroUI `Input`s above /
// below it).

import React, { useState, useEffect } from 'react';
import { Button, Input, Modal, Switch, TextArea } from '@heroui/react';
import { ExternalLink } from 'lucide-react';
import { API, showError, showSuccess } from '../../../../helpers';
import { useTranslation } from 'react-i18next';

const inputClass =
  '!h-10 w-full !rounded-xl !border !border-border !bg-background !px-3 !text-sm !text-foreground outline-none transition focus:!border-primary';

const textareaClass =
  '!w-full !resize-y !rounded-xl !border !border-border !bg-background !px-3 !py-2 !text-sm !text-foreground outline-none transition focus:!border-primary';

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

  return (
    <Modal>
      <Modal.Backdrop
        variant='blur'
        isOpen={!!visible}
        onOpenChange={(isOpen) => {
          if (!isOpen) handleCancel();
        }}
      >
        <Modal.Container size='md' placement='center'>
          {/* HeroUI's `.modal__dialog` ships `p-6` that wraps ALL of
              header / body / footer. So overriding Body with its own
              `px-6 py-5` was DOUBLING the horizontal padding and
              shifting body content 24px to the right of the header
              and footer (the misalignment you saw). Drop the body's
              padding override, and drop the manual `border-b` /
              `border-t` separators on header/footer per UX spec. */}
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading className='text-base font-semibold'>
                {isEdit ? t('编辑供应商') : t('新增供应商')}
              </Modal.Heading>
              <Modal.CloseTrigger />
            </Modal.Header>
            <Modal.Body className='space-y-4'>
              <div className='space-y-2'>
                <div className='text-sm font-medium text-foreground'>
                  {t('供应商名称')}
                  <span className='ml-1 text-danger'>*</span>
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
                  <div className='text-xs text-danger'>{errors.name}</div>
                ) : null}
              </div>

              <div className='space-y-2'>
                <div className='text-sm font-medium text-foreground'>
                  {t('描述')}
                </div>
                <TextArea
                  value={values.description}
                  onChange={(event) =>
                    setField('description')(event.target.value)
                  }
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
                    className='inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline'
                  >
                    {t('请点击我')}
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>

              <label className='flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-4'>
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
            </Modal.Body>
            <Modal.Footer>
              <Button variant='tertiary' onPress={handleCancel}>
                {t('取消')}
              </Button>
              <Button
                color='primary'
                onPress={submit}
                isPending={loading}
              >
                {t('确定')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};

export default EditVendorModal;
