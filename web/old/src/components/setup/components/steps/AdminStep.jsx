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

import React from 'react';
import { Banner, Form } from '@douyinfe/semi-ui';
import { IconUser, IconLock } from '@douyinfe/semi-icons';

/**
 * 管理员账号设置步骤组件
 * 提供管理员用户名和密码的设置界面
 */
const AdminStep = ({
  setupStatus,
  formData,
  setFormData,
  formRef,
  renderNavigationButtons,
  t,
}) => {
  return (
    <>
      {setupStatus.root_init ? (
        <Banner
          type='info'
          closeIcon={null}
          description={
            <div className='flex items-center'>
              <span>{t('管理员账号已经初始化过，请继续设置其他参数')}</span>
            </div>
          }
          className='!rounded-lg'
        />
      ) : (
        <>
          <Form.Input
            field='username'
            label={t('用户名')}
            placeholder={t('请输入管理员用户名')}
            prefix={<IconUser />}
            showClear
            noLabel={false}
            validateStatus='default'
            rules={[{ required: true, message: t('请输入管理员用户名') }]}
            initValue={formData.username || ''}
            onChange={(value) => {
              setFormData({ ...formData, username: value });
            }}
          />
          <Form.Input
            field='password'
            label={t('密码')}
            placeholder={t('请输入管理员密码')}
            type='password'
            prefix={<IconLock />}
            showClear
            noLabel={false}
            mode='password'
            validateStatus='default'
            rules={[
              { required: true, message: t('请输入管理员密码') },
              { min: 8, message: t('密码长度至少为8个字符') },
            ]}
            initValue={formData.password || ''}
            onChange={(value) => {
              setFormData({ ...formData, password: value });
            }}
          />
          <Form.Input
            field='confirmPassword'
            label={t('确认密码')}
            placeholder={t('请确认管理员密码')}
            type='password'
            prefix={<IconLock />}
            showClear
            noLabel={false}
            mode='password'
            validateStatus='default'
            rules={[
              { required: true, message: t('请确认管理员密码') },
              {
                validator: (rule, value) => {
                  if (value && formRef.current) {
                    const password = formRef.current.getValue('password');
                    if (value !== password) {
                      return Promise.reject(t('两次输入的密码不一致'));
                    }
                  }
                  return Promise.resolve();
                },
              },
            ]}
            initValue={formData.confirmPassword || ''}
            onChange={(value) => {
              setFormData({ ...formData, confirmPassword: value });
            }}
          />
        </>
      )}
      {renderNavigationButtons && renderNavigationButtons()}
    </>
  );
};

export default AdminStep;
