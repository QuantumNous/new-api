import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Form, Input, NavBar } from 'antd-mobile';

import { API } from '@classic/helpers/api';

import { showError, showSuccess } from '../shims/classic-utils';

const Setting = () => {
  const navigate = useNavigate();
  const [originalPassword, setOriginalPassword] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChangePassword = async () => {
    if (!password || password.length < 8) {
      showError('新密码长度至少 8 位');
      return;
    }
    if (password !== password2) {
      showError('两次输入的新密码不一致');
      return;
    }
    setSubmitting(true);
    try {
      const res = await API.put('/api/user/self', {
        original_password: originalPassword,
        password,
      });
      const { success, message } = res.data;
      if (success) {
        showSuccess('密码修改成功');
        setOriginalPassword('');
        setPassword('');
        setPassword2('');
      } else {
        showError(message);
      }
    } catch (e) {
      showError(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <NavBar onBack={() => navigate(-1)}>账户设置</NavBar>
      <Form
        layout='vertical'
        footer={
          <Button
            block
            color='primary'
            loading={submitting}
            onClick={handleChangePassword}
          >
            修改密码
          </Button>
        }
      >
        <Form.Header>修改密码</Form.Header>
        <Form.Item label='原密码'>
          <Input
            type='password'
            placeholder='请输入原密码'
            value={originalPassword}
            onChange={setOriginalPassword}
            autoComplete='current-password'
          />
        </Form.Item>
        <Form.Item label='新密码'>
          <Input
            type='password'
            placeholder='至少 8 位'
            value={password}
            onChange={setPassword}
            autoComplete='new-password'
          />
        </Form.Item>
        <Form.Item label='确认新密码'>
          <Input
            type='password'
            placeholder='再次输入新密码'
            value={password2}
            onChange={setPassword2}
            autoComplete='new-password'
          />
        </Form.Item>
      </Form>
      <p
        style={{
          padding: '0 16px',
          fontSize: 12,
          color: 'var(--adm-color-weak)',
        }}
      >
        更多设置（邮箱绑定、两步验证、通知等）请前往电脑端网站操作。
      </p>
    </div>
  );
};

export default Setting;
