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
import { Save, X, UserPlus } from 'lucide-react';
import { API, showError, showSuccess } from '../../../../helpers';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import { useTranslation } from 'react-i18next';

const inputClass =
  'h-10 w-full rounded-lg border border-[color:var(--app-border)] bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary';

const AddUserModal = (props) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
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
    <>
      <div
        aria-hidden={!props.visible}
        onClick={props.handleClose}
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
          props.visible ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      <aside
        role='dialog'
        aria-modal='true'
        aria-hidden={!props.visible}
        style={{ width: isMobile ? '100%' : 600 }}
        className={`fixed bottom-0 left-0 top-0 z-50 flex flex-col bg-background shadow-2xl transition-transform duration-300 ease-out ${
          props.visible ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <header className='flex items-center justify-between gap-3 border-b border-[color:var(--app-border)] px-5 py-3'>
          <div className='flex items-center gap-2'>
            <span className='inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'>
              {t('新建')}
            </span>
            <h4 className='m-0 text-lg font-semibold text-foreground'>
              {t('添加用户')}
            </h4>
          </div>
          <Button
            isIconOnly
            variant='light'
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
              <div className='flex items-center gap-2'>
                <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300'>
                  <UserPlus size={16} />
                </div>
                <div>
                  <div className='text-base font-semibold text-foreground'>
                    {t('用户信息')}
                  </div>
                  <div className='text-xs text-muted'>
                    {t('创建新用户账户')}
                  </div>
                </div>
              </div>

              <div className='space-y-3'>
                <div className='space-y-2'>
                  <div className='text-sm font-medium text-foreground'>
                    {t('用户名')}
                    <span className='ml-1 text-red-500'>*</span>
                  </div>
                  <Input
                    type='text'
                    value={values.username}
                    onChange={(event) => setField('username')(event.target.value)}
                    placeholder={t('请输入用户名')}
                    aria-label={t('用户名')}
                    className={inputClass}
                  />
                  {errors.username ? (
                    <div className='text-xs text-red-600'>{errors.username}</div>
                  ) : null}
                </div>

                <div className='space-y-2'>
                  <div className='text-sm font-medium text-foreground'>
                    {t('显示名称')}
                  </div>
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
                  <div className='text-sm font-medium text-foreground'>
                    {t('密码')}
                    <span className='ml-1 text-red-500'>*</span>
                  </div>
                  <Input
                    type='password'
                    value={values.password}
                    onChange={(event) => setField('password')(event.target.value)}
                    placeholder={t('请输入密码')}
                    aria-label={t('密码')}
                    className={inputClass}
                  />
                  {errors.password ? (
                    <div className='text-xs text-red-600'>{errors.password}</div>
                  ) : null}
                </div>

                <div className='space-y-2'>
                  <div className='text-sm font-medium text-foreground'>
                    {t('备注')}
                  </div>
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

        <footer className='flex justify-end gap-2 border-t border-[color:var(--app-border)] bg-[color:var(--app-background)] px-5 py-3'>
          <Button
            variant='light'
            onPress={props.handleClose}
            startContent={<X size={14} />}
          >
            {t('取消')}
          </Button>
          <Button
            color='primary'
            onPress={submit}
            isPending={loading}
            startContent={<Save size={14} />}
          >
            {t('提交')}
          </Button>
        </footer>
      </aside>
    </>
  );
};

export default AddUserModal;
