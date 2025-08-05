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
import { API, showError, showSuccess } from '../../helpers';
import { Button, Card, Divider, Form, Input, Typography } from '@douyinfe/semi-ui';
import React, { useState } from 'react';

const { Title, Text, Paragraph } = Typography;

const TwoFAVerification = ({ onSuccess, onBack, isModal = false }) => {
  const [loading, setLoading] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');

  const handleSubmit = async () => {
    if (!verificationCode) {
      showError('请输入验证码');
      return;
    }
    // Validate code format
    if (useBackupCode && verificationCode.length !== 8) {
      showError('备用码必须是8位');
      return;
    } else if (!useBackupCode && !/^\d{6}$/.test(verificationCode)) {
      showError('验证码必须是6位数字');
      return;
    }

    setLoading(true);
    try {
      const res = await API.post('/api/user/login/2fa', {
        code: verificationCode
      });

      if (res.data.success) {
        showSuccess('登录成功');
        // 保存用户信息到本地存储
        localStorage.setItem('user', JSON.stringify(res.data.data));
        if (onSuccess) {
          onSuccess(res.data.data);
        }
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError('验证失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  if (isModal) {
    return (
      <div className="space-y-4">
        <Paragraph className="text-gray-600 dark:text-gray-300">
          请输入认证器应用显示的验证码完成登录
        </Paragraph>

        <Form onSubmit={handleSubmit}>
          <Form.Input
            field="code"
            label={useBackupCode ? "备用码" : "验证码"}
            placeholder={useBackupCode ? "请输入8位备用码" : "请输入6位验证码"}
            value={verificationCode}
            onChange={setVerificationCode}
            onKeyPress={handleKeyPress}
            size="large"
            style={{ marginBottom: 16 }}
            autoFocus
          />

          <Button
            htmlType="submit"
            type="primary"
            loading={loading}
            block
            size="large"
            style={{ marginBottom: 16 }}
          >
            验证并登录
          </Button>
        </Form>

        <Divider />

        <div style={{ textAlign: 'center' }}>
          <Button
            theme="borderless"
            type="tertiary"
            onClick={() => {
              setUseBackupCode(!useBackupCode);
              setVerificationCode('');
            }}
            style={{ marginRight: 16, color: '#1890ff', padding: 0 }}
          >
            {useBackupCode ? '使用认证器验证码' : '使用备用码'}
          </Button>

          {onBack && (
            <Button
              theme="borderless"
              type="tertiary"
              onClick={onBack}
              style={{ color: '#1890ff', padding: 0 }}
            >
              返回登录
            </Button>
          )}
        </div>

        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <Text size="small" type="secondary">
            <strong>提示：</strong>
            <br />
            • 验证码每30秒更新一次
            <br />
            • 如果无法获取验证码，请使用备用码
            <br />
            • 每个备用码只能使用一次
          </Text>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '60vh'
    }}>
      <Card style={{ width: 400, padding: 24 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title heading={3}>两步验证</Title>
          <Paragraph type="secondary">
            请输入认证器应用显示的验证码完成登录
          </Paragraph>
        </div>

        <Form onSubmit={handleSubmit}>
          <Form.Input
            field="code"
            label={useBackupCode ? "备用码" : "验证码"}
            placeholder={useBackupCode ? "请输入8位备用码" : "请输入6位验证码"}
            value={verificationCode}
            onChange={setVerificationCode}
            onKeyPress={handleKeyPress}
            size="large"
            style={{ marginBottom: 16 }}
            autoFocus
          />

          <Button
            htmlType="submit"
            type="primary"
            loading={loading}
            block
            size="large"
            style={{ marginBottom: 16 }}
          >
            验证并登录
          </Button>
        </Form>

        <Divider />

        <div style={{ textAlign: 'center' }}>
          <Button
            theme="borderless"
            type="tertiary"
            onClick={() => {
              setUseBackupCode(!useBackupCode);
              setVerificationCode('');
            }}
            style={{ marginRight: 16, color: '#1890ff', padding: 0 }}
          >
            {useBackupCode ? '使用认证器验证码' : '使用备用码'}
          </Button>

          {onBack && (
            <Button
              theme="borderless"
              type="tertiary"
              onClick={onBack}
              style={{ color: '#1890ff', padding: 0 }}
            >
              返回登录
            </Button>
          )}
        </div>

        <div style={{ marginTop: 24, padding: 16, background: '#f6f8fa', borderRadius: 6 }}>
          <Text size="small" type="secondary">
            <strong>提示：</strong>
            <br />
            • 验证码每30秒更新一次
            <br />
            • 如果无法获取验证码，请使用备用码
            <br />
            • 每个备用码只能使用一次
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default TwoFAVerification;