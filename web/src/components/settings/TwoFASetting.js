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
import { API, showError, showSuccess, showWarning } from '../../helpers';
import { Banner, Button, Card, Checkbox, Divider, Form, Input, Modal, Tag, Typography } from '@douyinfe/semi-ui';
import React, { useEffect, useState } from 'react';

import { QRCodeSVG } from 'qrcode.react';

const { Text, Paragraph } = Typography;

const TwoFASetting = () => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({
    enabled: false,
    locked: false,
    backup_codes_remaining: 0
  });

  // 模态框状态
  const [setupModalVisible, setSetupModalVisible] = useState(false);
  const [enableModalVisible, setEnableModalVisible] = useState(false);
  const [disableModalVisible, setDisableModalVisible] = useState(false);
  const [backupModalVisible, setBackupModalVisible] = useState(false);

  // 表单数据
  const [setupData, setSetupData] = useState(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [confirmDisable, setConfirmDisable] = useState(false);

  // 获取2FA状态
  const fetchStatus = async () => {
    try {
      const res = await API.get('/api/user/2fa/status');
      if (res.data.success) {
        setStatus(res.data.data);
      }
    } catch (error) {
      showError('获取2FA状态失败');
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  // 初始化2FA设置
  const handleSetup2FA = async () => {
    setLoading(true);
    try {
      const res = await API.post('/api/user/2fa/setup');
      if (res.data.success) {
        setSetupData(res.data.data);
        setSetupModalVisible(true);
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError('设置2FA失败');
    } finally {
      setLoading(false);
    }
  };

  // 启用2FA
  const handleEnable2FA = async () => {
    if (!verificationCode) {
      showWarning('请输入验证码');
      return;
    }

    setLoading(true);
    try {
      const res = await API.post('/api/user/2fa/enable', {
        code: verificationCode
      });
      if (res.data.success) {
        showSuccess('两步验证启用成功！');
        setEnableModalVisible(false);
        setSetupModalVisible(false);
        setVerificationCode('');
        fetchStatus();
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError('启用2FA失败');
    } finally {
      setLoading(false);
    }
  };

  // 禁用2FA
  const handleDisable2FA = async () => {
    if (!verificationCode) {
      showWarning('请输入验证码或备用码');
      return;
    }

    if (!confirmDisable) {
      showWarning('请确认您已了解禁用两步验证的后果');
      return;
    }

    setLoading(true);
    try {
      const res = await API.post('/api/user/2fa/disable', {
        code: verificationCode
      });
      if (res.data.success) {
        showSuccess('两步验证已禁用');
        setDisableModalVisible(false);
        setVerificationCode('');
        setConfirmDisable(false);
        fetchStatus();
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError('禁用2FA失败');
    } finally {
      setLoading(false);
    }
  };

  // 重新生成备用码
  const handleRegenerateBackupCodes = async () => {
    if (!verificationCode) {
      showWarning('请输入验证码');
      return;
    }

    setLoading(true);
    try {
      const res = await API.post('/api/user/2fa/backup_codes', {
        code: verificationCode
      });
      if (res.data.success) {
        setBackupCodes(res.data.data.backup_codes);
        showSuccess('备用码重新生成成功');
        setVerificationCode('');
        fetchStatus();
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError('重新生成备用码失败');
    } finally {
      setLoading(false);
    }
  };

  const copyBackupCodes = () => {
    const codesText = backupCodes.join('\n');
    navigator.clipboard.writeText(codesText).then(() => {
      showSuccess('备用码已复制到剪贴板');
    }).catch(() => {
      showError('复制失败，请手动复制');
    });
  };

  return (
    <div>
      <Card
        className="!rounded-xl transition-shadow w-full"
        bodyStyle={{ padding: '20px' }}
        shadows='hover'
        style={{ marginBottom: 16 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center flex-1">
            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mr-3">
              <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6 8a2 2 0 11-4 0 2 2 0 014 0zM8 7a1 1 0 100 2h8a1 1 0 100-2H8zM6 14a2 2 0 11-4 0 2 2 0 014 0zM8 13a1 1 0 100 2h8a1 1 0 100-2H8z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 dark:text-gray-100">两步验证设置</div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                两步验证（2FA）为您的账户提供额外的安全保护。启用后，登录时需要输入密码和验证器应用生成的验证码。
              </div>
              <div className="flex items-center mt-2 space-x-2">
                <Text strong>当前状态：</Text>
                {status.enabled ? (
                  <Tag color="green" size="small">已启用</Tag>
                ) : (
                  <Tag color="red" size="small">未启用</Tag>
                )}
                {status.locked && (
                  <Tag color="orange" size="small">账户已锁定</Tag>
                )}
              </div>
              {status.enabled && (
                <div className="mt-1">
                  <Text size="small" type="secondary">剩余备用码：{status.backup_codes_remaining || 0} 个</Text>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col space-y-2">
            {!status.enabled ? (
              <Button
                type="primary"
                size="default"
                onClick={handleSetup2FA}
                loading={loading}
              >
                启用两步验证
              </Button>
            ) : (
              <div className="flex flex-col space-y-2">
                <Button
                  type="danger"
                  size="default"
                  onClick={() => setDisableModalVisible(true)}
                >
                  禁用两步验证
                </Button>
                <Button
                  size="default"
                  onClick={() => setBackupModalVisible(true)}
                >
                  重新生成备用码
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* 2FA设置模态框 */}
      <Modal
        title={
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mr-3">
              <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6 8a2 2 0 11-4 0 2 2 0 014 0zM8 7a1 1 0 100 2h8a1 1 0 100-2H8zM6 14a2 2 0 11-4 0 2 2 0 014 0zM8 13a1 1 0 100 2h8a1 1 0 100-2H8z" clipRule="evenodd" />
              </svg>
            </div>
            设置两步验证
          </div>
        }
        visible={setupModalVisible}
        onCancel={() => {
          setSetupModalVisible(false);
          setSetupData(null);
        }}
        footer={null}
        width={650}
        style={{ maxWidth: '90vw' }}
      >
        {setupData && (
          <div className="space-y-6">
            {/* 步骤 1：扫描二维码 */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <div className="flex items-center mb-3">
                <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-medium mr-2">
                  1
                </div>
                <Text strong className="text-gray-900 dark:text-gray-100">扫描二维码</Text>
              </div>
              <Paragraph className="text-gray-600 dark:text-gray-300 mb-4">
                使用认证器应用（如 Google Authenticator、Microsoft Authenticator）扫描下方二维码：
              </Paragraph>
              <div className="flex justify-center mb-4">
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <QRCodeSVG value={setupData.qr_code_data} size={180} />
                </div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900 rounded-lg p-3">
                <Text className="text-blue-800 dark:text-blue-200 text-sm">
                  或手动输入密钥：<Text code copyable className="ml-2">{setupData.secret}</Text>
                </Text>
              </div>
            </div>

            {/* 步骤 2：保存备用码 */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <div className="flex items-center mb-3">
                <div className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-medium mr-2">
                  2
                </div>
                <Text strong className="text-gray-900 dark:text-gray-100">保存备用码</Text>
              </div>
              <Paragraph className="text-gray-600 dark:text-gray-300 mb-4">
                请将以下备用码保存在安全的地方。如果丢失手机，可以使用这些备用码登录：
              </Paragraph>
              <div className="bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {setupData.backup_codes.map((code, index) => (
                    <div key={index} className="bg-white dark:bg-gray-700 p-2 rounded text-center">
                      <Text code className="text-sm">{code}</Text>
                    </div>
                  ))}
                </div>
                <Button
                  size="small"
                  type="primary"
                  onClick={() => {
                    const codesText = setupData.backup_codes.join('\n');
                    navigator.clipboard.writeText(codesText);
                    showSuccess('备用码已复制');
                  }}
                  className="w-full"
                >
                  复制所有备用码
                </Button>
              </div>
            </div>

            {/* 步骤 3：验证设置 */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <div className="flex items-center mb-3">
                <div className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-sm font-medium mr-2">
                  3
                </div>
                <Text strong className="text-gray-900 dark:text-gray-100">验证设置</Text>
              </div>
              <Paragraph className="text-gray-600 dark:text-gray-300 mb-4">
                输入认证器应用显示的6位数字验证码：
              </Paragraph>
              <Form onSubmit={handleEnable2FA}>
                <Form.Input
                  field="code"
                  placeholder="请输入6位验证码"
                  value={verificationCode}
                  onChange={setVerificationCode}
                  size="large"
                  style={{ marginBottom: 16 }}
                  maxLength={6}
                />
                <Button
                  htmlType="submit"
                  type="primary"
                  loading={loading}
                  size="large"
                  block
                >
                  完成设置并启用两步验证
                </Button>
              </Form>
            </div>
          </div>
        )}
      </Modal>

      {/* 禁用2FA模态框 */}
      <Modal
        title={
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center mr-3">
              <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            禁用两步验证
          </div>
        }
        visible={disableModalVisible}
        onCancel={() => {
          setDisableModalVisible(false);
          setVerificationCode('');
          setConfirmDisable(false);
        }}
        footer={null}
        width={550}
      >
        <div className="space-y-4">
          <Banner
            type="warning"
            description={
              <div className="space-y-2">
                <div className="font-medium">警告：禁用两步验证将会：</div>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>降低您账户的安全性</li>
                  <li>永久删除您的两步验证设置</li>
                  <li>永久删除所有备用码（包括未使用的）</li>
                  <li>需要重新完整设置才能再次启用</li>
                </ul>
                <div className="text-sm text-red-600 dark:text-red-400 font-medium mt-2">
                  此操作不可撤销，请谨慎操作！
                </div>
              </div>
            }
            className="rounded-lg"
          />
          <Form onSubmit={handleDisable2FA}>
            <Form.Input
              field="code"
              label="验证码"
              placeholder="请输入认证器验证码或备用码"
              value={verificationCode}
              onChange={setVerificationCode}
              size="large"
              style={{ marginBottom: 16 }}
            />
            <div className="mb-4">
              <Checkbox
                checked={confirmDisable}
                onChange={(e) => setConfirmDisable(e.target.checked)}
                className="text-sm"
              >
                我已了解禁用两步验证将永久删除所有相关设置和备用码，此操作不可撤销
              </Checkbox>
            </div>
            <Button
              htmlType="submit"
              type="danger"
              loading={loading}
              size="large"
              block
              disabled={!confirmDisable}
            >
              确认禁用两步验证
            </Button>
          </Form>
        </div>
      </Modal>

      {/* 重新生成备用码模态框 */}
      <Modal
        title={
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center mr-3">
              <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
            </div>
            重新生成备用码
          </div>
        }
        visible={backupModalVisible}
        onCancel={() => {
          setBackupModalVisible(false);
          setVerificationCode('');
          setBackupCodes([]);
        }}
        footer={null}
        width={500}
      >
        <div className="space-y-4">
          {backupCodes.length === 0 ? (
            <>
              <Banner
                type="warning"
                description="重新生成备用码将使现有的备用码失效，请确保您已保存了当前的备用码。"
                className="rounded-lg"
              />
              <Form onSubmit={handleRegenerateBackupCodes}>
                <Form.Input
                  field="code"
                  label="验证码"
                  placeholder="请输入认证器验证码"
                  value={verificationCode}
                  onChange={setVerificationCode}
                  size="large"
                  style={{ marginBottom: 16 }}
                />
                <Button
                  htmlType="submit"
                  type="primary"
                  loading={loading}
                  size="large"
                  block
                >
                  生成新的备用码
                </Button>
              </Form>
            </>
          ) : (
            <>
              <div className="text-center mb-4">
                <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mx-auto mb-2">
                  <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <Text strong className="text-lg">新的备用码已生成</Text>
                <Paragraph className="text-gray-600 dark:text-gray-300 mt-2">
                  请将以下备用码保存在安全的地方：
                </Paragraph>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {backupCodes.map((code, index) => (
                    <div key={index} className="bg-white dark:bg-gray-700 p-2 rounded text-center">
                      <Text code className="text-sm">{code}</Text>
                    </div>
                  ))}
                </div>
                <Button
                  onClick={copyBackupCodes}
                  type="primary"
                  size="large"
                  block
                >
                  复制所有备用码
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default TwoFASetting;