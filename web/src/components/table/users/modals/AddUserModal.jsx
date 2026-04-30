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
import { Button, Card, Input } from '@heroui/react';
import { X } from 'lucide-react';
import { API, showError, showSuccess } from '../../../../helpers';
import SideSheet from '../../../common/ui/SideSheet';
import { useTranslation } from 'react-i18next';

// Visual baseline shared with the rest of the side-sheet forms — see
// EditModelModal / EditRedemptionModal. Locks every Input / Select.Trigger
// to a single 40px-tall rounded-xl bordered surface so the column reads
// as one stack instead of a patchwork of HeroUI defaults.
const inputClass =
  '!h-10 w-full !rounded-xl !border !border-border !bg-background !px-3 !text-sm !text-foreground outline-none transition focus:!border-primary disabled:opacity-50';

function StatusChip({ tone, children }) {
  const cls =
    {
      blue: 'bg-primary/15 text-primary',
      green: 'bg-success/15 text-success',
    }[tone] || 'bg-primary/15 text-primary';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}
    >
      {children}
    </span>
  );
}

function FieldLabel({ children, required }) {
  return (
    <label className='block text-sm font-medium text-foreground'>
      {children}
      {required ? <span className='ml-0.5 text-danger'>*</span> : null}
    </label>
  );
}

function FieldError({ children }) {
  if (!children) return null;
  return <div className='mt-1 text-xs text-danger'>{children}</div>;
}

const AddUserModal = (props) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [values, setValues] = useState({
    username: '',
    display_name: '',
    password: '',
    remark: '',
  });
  const [errors, setErrors] = useState({});

  const setField = (key) => (value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const reset = () => {
    setValues({ username: '', display_name: '', password: '', remark: '' });
    setErrors({});
  };

  useEffect(() => {
    if (!props.visible) reset();
  }, [props.visible]);

  useEffect(() => {
    if (!props.visible) return;
    const onKey = (event) => {
      if (event.key === 'Escape') props.handleClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [props.visible, props.handleClose]);

  const validate = () => {
    const next = {};
    if (!values.username.trim()) next.username = t('请输入用户名');
    if (!values.password.trim()) next.password = t('请输入密码');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await API.post('/api/user/', values);
      const { success, message } = res.data || {};
      if (success) {
        showSuccess(t('用户账户创建成功！'));
        reset();
        props.refresh?.();
        props.handleClose?.();
      } else {
        showError(message);
      }
    } catch (err) {
      showError(err.response?.data?.message || t('创建失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SideSheet
      visible={props.visible}
      onClose={props.handleClose}
      placement='left'
      width={480}
    >
      <header className='flex items-center justify-between gap-3 border-b border-border px-5 py-3'>
        <div className='flex items-center gap-2'>
          <StatusChip tone='green'>{t('新建')}</StatusChip>
          <h4 className='m-0 text-lg font-semibold text-foreground'>
            {t('添加用户')}
          </h4>
        </div>
        <Button
          isIconOnly
          variant='tertiary'
          size='sm'
          aria-label={t('关闭')}
          onPress={props.handleClose}
        >
          <X size={16} />
        </Button>
      </header>

      <div className='flex-1 overflow-y-auto p-3'>
        <Card className='!rounded-2xl border-0 shadow-sm'>
          <Card.Content className='space-y-4 p-5'>
            {/* Section header — icon tile removed per UX request; title +
                subtitle alone gives enough hierarchy inside a single-card
                side sheet. */}
            <div>
              <div className='text-base font-semibold text-foreground'>
                {t('用户信息')}
              </div>
              <div className='text-xs text-muted'>
                {t('创建新用户账户')}
              </div>
            </div>

            <div className='space-y-3'>
              <div className='space-y-2'>
                <FieldLabel required>{t('用户名')}</FieldLabel>
                <Input
                  type='text'
                  value={values.username}
                  onChange={(event) =>
                    setField('username')(event.target.value)
                  }
                  placeholder={t('请输入用户名')}
                  aria-label={t('用户名')}
                  className={inputClass}
                />
                <FieldError>{errors.username}</FieldError>
              </div>

              <div className='space-y-2'>
                <FieldLabel>{t('显示名称')}</FieldLabel>
                <Input
                  type='text'
                  value={values.display_name}
                  onChange={(event) =>
                    setField('display_name')(event.target.value)
                  }
                  placeholder={t('请输入显示名称')}
                  aria-label={t('显示名称')}
                  className={inputClass}
                />
              </div>

              <div className='space-y-2'>
                <FieldLabel required>{t('密码')}</FieldLabel>
                <Input
                  type='password'
                  value={values.password}
                  onChange={(event) =>
                    setField('password')(event.target.value)
                  }
                  placeholder={t('请输入密码')}
                  aria-label={t('密码')}
                  className={inputClass}
                />
                <FieldError>{errors.password}</FieldError>
              </div>

              <div className='space-y-2'>
                <FieldLabel>{t('备注')}</FieldLabel>
                <Input
                  type='text'
                  value={values.remark}
                  onChange={(event) => setField('remark')(event.target.value)}
                  placeholder={t('请输入备注（仅管理员可见）')}
                  aria-label={t('备注')}
                  className={inputClass}
                />
              </div>
            </div>
          </Card.Content>
        </Card>
      </div>

      <footer className='flex justify-end gap-2 border-t border-border bg-background px-5 py-3'>
        <Button variant='tertiary' onPress={props.handleClose}>
          {t('取消')}
        </Button>
        <Button color='primary' onPress={submit} isPending={loading}>
          {t('提交')}
        </Button>
      </footer>
    </SideSheet>
  );
};

export default AddUserModal;
