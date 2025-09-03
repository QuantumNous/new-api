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
import { API, showError, showSuccess, showWarning } from '../../../../helpers';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  Divider,
  Input,
  Modal,
  Tag,
  Typography,
  Steps,
  Space,
  Badge,
} from '@douyinfe/semi-ui';
import {
  IconShield,
  IconAlertTriangle,
  IconRefresh,
  IconCopy,
} from '@douyinfe/semi-icons';
import React, { useEffect, useState } from 'react';

import { QRCodeSVG } from 'qrcode.react';

const { Text, Paragraph } = Typography;

const TwoFASetting = ({ t }) => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({
    enabled: false,
    locked: false,
    backup_codes_remaining: 0,
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
  const [currentStep, setCurrentStep] = useState(0);

  // 获取2FA状态
  const fetchStatus = async () => {
    try {
      const res = await API.get('/api/user/2fa/status');
      if (res.data.success) {
        setStatus(res.data.data);
      }
    } catch (error) {
      showError(t('获取2FA状态失败'));
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
        setCurrentStep(0);
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('设置2FA失败'));
    } finally {
      setLoading(false);
    }
  };

  // 启用2FA
  const handleEnable2FA = async () => {
    if (!verificationCode) {
      showWarning(t('请输入验证码'));
      return;
    }

    setLoading(true);
    try {
      const res = await API.post('/api/user/2fa/enable', {
        code: verificationCode,
      });
      if (res.data.success) {
        showSuccess(t('两步验证启用成功！'));
        setEnableModalVisible(false);
        setSetupModalVisible(false);
        setVerificationCode('');
        setCurrentStep(0);
        fetchStatus();
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('启用2FA失败'));
    } finally {
      setLoading(false);
    }
  };

  // 禁用2FA
  const handleDisable2FA = async () => {
    if (!verificationCode) {
      showWarning(t('请输入验证码或备用码'));
      return;
    }

    if (!confirmDisable) {
      showWarning(t('请确认您已了解禁用两步验证的后果'));
      return;
    }

    setLoading(true);
    try {
      const res = await API.post('/api/user/2fa/disable', {
        code: verificationCode,
      });
      if (res.data.success) {
        showSuccess(t('两步验证已禁用'));
        setDisableModalVisible(false);
        setVerificationCode('');
        setConfirmDisable(false);
        fetchStatus();
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('禁用2FA失败'));
    } finally {
      setLoading(false);
    }
  };

  // 重新生成备用码
  const handleRegenerateBackupCodes = async () => {
    if (!verificationCode) {
      showWarning(t('请输入验证码'));
      return;
    }

    setLoading(true);
    try {
      const res = await API.post('/api/user/2fa/backup_codes', {
        code: verificationCode,
      });
      if (res.data.success) {
        setBackupCodes(res.data.data.backup_codes);
        showSuccess(t('备用码重新生成成功'));
        setVerificationCode('');
        fetchStatus();
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('重新生成备用码失败'));
    } finally {
      setLoading(false);
    }
  };

  // 通用复制函数
  const copyTextToClipboard = (text, successMessage = t('已复制到剪贴板')) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        showSuccess(successMessage);
      })
      .catch(() => {
        showError(t('复制失败，请手动复制'));
      });
  };

  const copyBackupCodes = () => {
    const codesText = backupCodes.join('\n');
    copyTextToClipboard(codesText, t('备用码已复制到剪贴板'));
  };

  // 备用码展示组件
  const BackupCodesDisplay = ({ codes, title, onCopy }) => {
    return (
      <Card className='!rounded-xl' style={{ width: '100%' }}>
        <div className='space-y-3'>
          <div className='flex items-center justify-between'>
            <Text strong className='text-slate-700 dark:text-slate-200'>
              {title}
            </Text>
          </div>

          <div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
            {codes.map((code, index) => (
              <div key={index} className='rounded-lg p-3'>
                <div className='flex items-center justify-between'>
                  <Text
                    code
                    className='text-sm font-mono text-slate-700 dark:text-slate-200'
                  >
                    {code}
                  </Text>
                  <Text type='quaternary' className='text-xs'>
                    #{(index + 1).toString().padStart(2, '0')}
                  </Text>
                </div>
              </div>
            ))}
          </div>

          <Divider margin={12} />
          <Button
            type='primary'
            theme='solid'
            icon={<IconCopy />}
            onClick={onCopy}
            className='!rounded-lg !bg-slate-600 hover:!bg-slate-700 w-full'
          >
            {t('复制所有代码')}
          </Button>
        </div>
      </Card>
    );
  };

  // 渲染设置模态框footer
  const renderSetupModalFooter = () => {
    return (
      <>
        {currentStep > 0 && (
          <Button
            onClick={() => setCurrentStep(currentStep - 1)}
            className='!rounded-lg'
          >
            {t('上一步')}
          </Button>
        )}
        {currentStep < 2 ? (
          <Button
            type='primary'
            theme='solid'
            onClick={() => setCurrentStep(currentStep + 1)}
            className='!rounded-lg !bg-slate-600 hover:!bg-slate-700'
          >
            {t('下一步')}
          </Button>
        ) : (
          <Button
            type='primary'
            theme='solid'
            loading={loading}
            onClick={() => {
              if (!verificationCode) {
                showWarning(t('请输入验证码'));
                return;
              }
              handleEnable2FA();
            }}
            className='!rounded-lg !bg-slate-600 hover:!bg-slate-700'
          >
            {t('完成设置并启用两步验证')}
          </Button>
        )}
      </>
    );
  };

  // 渲染禁用模态框footer
  const renderDisableModalFooter = () => {
    return (
      <>
        <Button
          onClick={() => {
            setDisableModalVisible(false);
            setVerificationCode('');
            setConfirmDisable(false);
          }}
          className='!rounded-lg'
        >
          {t('取消')}
        </Button>
        <Button
          type='danger'
          theme='solid'
          loading={loading}
          disabled={!confirmDisable || !verificationCode}
          onClick={handleDisable2FA}
          className='!rounded-lg !bg-slate-500 hover:!bg-slate-600'
        >
          {t('确认禁用')}
        </Button>
      </>
    );
  };

  // 渲染重新生成模态框footer
  const renderRegenerateModalFooter = () => {
    if (backupCodes.length > 0) {
      return (
        <Button
          type='primary'
          theme='solid'
          onClick={() => {
            setBackupModalVisible(false);
            setVerificationCode('');
            setBackupCodes([]);
          }}
          className='!rounded-lg !bg-slate-600 hover:!bg-slate-700'
        >
          {t('完成')}
        </Button>
      );
    }

    return (
      <>
        <Button
          onClick={() => {
            setBackupModalVisible(false);
            setVerificationCode('');
            setBackupCodes([]);
          }}
          className='!rounded-lg'
        >
          {t('取消')}
        </Button>
        <Button
          type='primary'
          theme='solid'
          loading={loading}
          disabled={!verificationCode}
          onClick={handleRegenerateBackupCodes}
          className='!rounded-lg !bg-slate-600 hover:!bg-slate-700'
        >
          {t('生成新的备用码')}
        </Button>
      </>
    );
  };

  return (
    <>
      <Card className='!rounded-xl w-full'>
        <div className='flex flex-col sm:flex-row items-start sm:justify-between gap-4'>
          <div className='flex items-start w-full sm:w-auto'>
            <div className='w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mr-4 flex-shrink-0'>
              <IconShield
                size='large'
                className='text-slate-600 dark:text-slate-300'
              />
            </div>
            <div className='flex-1'>
              <div className='flex items-center gap-2 mb-1'>
                <Typography.Title heading={6} className='mb-0'>
                  {t('两步验证设置')}
                </Typography.Title>
                {status.enabled ? (
                  <Tag color='green' shape='circle' size='small'>
                    {t('已启用')}
                  </Tag>
                ) : (
                  <Tag color='red' shape='circle' size='small'>
                    {t('未启用')}
                  </Tag>
                )}
                {status.locked && (
                  <Tag color='orange' shape='circle' size='small'>
                    {t('账户已锁定')}
                  </Tag>
                )}
              </div>
              <Typography.Text type='tertiary' className='text-sm'>
                {t(
                  '两步验证（2FA）为您的账户提供额外的安全保护。启用后，登录时需要输入密码和验证器应用生成的验证码。',
                )}
              </Typography.Text>
              {status.enabled && (
                <div className='mt-2'>
                  <Text size='small' type='secondary'>
                    {t('剩余备用码：')}
                    {status.backup_codes_remaining || 0}
                    {t('个')}
                  </Text>
                </div>
              )}
            </div>
          </div>
          <div className='flex flex-col space-y-2 w-full sm:w-auto'>
            {!status.enabled ? (
              <Button
                type='primary'
                theme='solid'
                size='default'
                onClick={handleSetup2FA}
                loading={loading}
                className='!rounded-lg !bg-slate-600 hover:!bg-slate-700'
                icon={<IconShield />}
              >
                {t('启用验证')}
              </Button>
            ) : (
              <div className='flex flex-col space-y-2'>
                <Button
                  type='danger'
                  theme='solid'
                  size='default'
                  onClick={() => setDisableModalVisible(true)}
                  className='!rounded-lg !bg-slate-500 hover:!bg-slate-600'
                  icon={<IconAlertTriangle />}
                >
                  {t('禁用两步验证')}
                </Button>
                <Button
                  type='primary'
                  theme='solid'
                  size='default'
                  onClick={() => setBackupModalVisible(true)}
                  className='!rounded-lg'
                  icon={<IconRefresh />}
                >
                  {t('重新生成备用码')}
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* 2FA设置模态框 */}
      <Modal
        title={
          <div className='flex items-center'>
            <IconShield className='mr-2 text-slate-600' />
            {t('设置两步验证')}
          </div>
        }
        visible={setupModalVisible}
        onCancel={() => {
          setSetupModalVisible(false);
          setSetupData(null);
          setCurrentStep(0);
          setVerificationCode('');
        }}
        footer={renderSetupModalFooter()}
        width={650}
        style={{ maxWidth: '90vw' }}
      >
        {setupData && (
          <div className='space-y-6'>
            {/* 步骤进度 */}
            <Steps type='basic' size='small' current={currentStep}>
              <Steps.Step
                title={t('扫描二维码')}
                description={t('使用认证器应用扫描二维码')}
              />
              <Steps.Step
                title={t('保存备用码')}
                description={t('保存备用码以备不时之需')}
              />
              <Steps.Step
                title={t('验证设置')}
                description={t('输入验证码完成设置')}
              />
            </Steps>

            {/* 步骤内容 */}
            <div className='rounded-xl'>
              {currentStep === 0 && (
                <div>
                  <Paragraph className='text-gray-600 dark:text-gray-300 mb-4'>
                    {t(
                      '使用认证器应用（如 Google Authenticator、Microsoft Authenticator）扫描下方二维码：',
                    )}
                  </Paragraph>
                  <div className='flex justify-center mb-4'>
                    <div className='bg-white p-4 rounded-lg shadow-sm'>
                      <QRCodeSVG value={setupData.qr_code_data} size={180} />
                    </div>
                  </div>
                  <div className='bg-blue-50 dark:bg-blue-900 rounded-lg p-3'>
                    <Text className='text-blue-800 dark:text-blue-200 text-sm'>
                      {t('或手动输入密钥：')}
                      <Text code copyable className='ml-2'>
                        {setupData.secret}
                      </Text>
                    </Text>
                  </div>
                </div>
              )}

              {currentStep === 1 && (
                <div className='space-y-4'>
                  {/* 备用码展示 */}
                  <BackupCodesDisplay
                    codes={setupData.backup_codes}
                    title={t('备用恢复代码')}
                    onCopy={() => {
                      const codesText = setupData.backup_codes.join('\n');
                      copyTextToClipboard(codesText, t('备用码已复制到剪贴板'));
                    }}
                  />
                </div>
              )}

              {currentStep === 2 && (
                <Input
                  placeholder={t('输入认证器应用显示的6位数字验证码')}
                  value={verificationCode}
                  onChange={setVerificationCode}
                  size='large'
                  maxLength={6}
                  className='!rounded-lg'
                />
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* 禁用2FA模态框 */}
      <Modal
        title={
          <div className='flex items-center'>
            <IconAlertTriangle className='mr-2 text-red-500' />
            {t('禁用两步验证')}
          </div>
        }
        visible={disableModalVisible}
        onCancel={() => {
          setDisableModalVisible(false);
          setVerificationCode('');
          setConfirmDisable(false);
        }}
        footer={renderDisableModalFooter()}
        width={550}
        style={{ maxWidth: '90vw' }}
      >
        <div className='space-y-6'>
          {/* 警告提示 */}
          <div className='rounded-xl'>
            <Banner
              type='warning'
              description={t(
                '警告：禁用两步验证将永久删除您的验证设置和所有备用码，此操作不可撤销！',
              )}
              className='!rounded-lg'
            />
          </div>

          {/* 内容区域 */}
          <div className='space-y-4'>
            <div>
              <Text
                strong
                className='block mb-2 text-slate-700 dark:text-slate-200'
              >
                {t('禁用后的影响：')}
              </Text>
              <ul className='space-y-2 text-sm text-slate-600 dark:text-slate-300'>
                <li className='flex items-start gap-2'>
                  <Badge dot type='warning' />
                  {t('降低您账户的安全性')}
                </li>
                <li className='flex items-start gap-2'>
                  <Badge dot type='warning' />
                  {t('需要重新完整设置才能再次启用')}
                </li>
                <li className='flex items-start gap-2'>
                  <Badge dot type='danger' />
                  {t('永久删除您的两步验证设置')}
                </li>
                <li className='flex items-start gap-2'>
                  <Badge dot type='danger' />
                  {t('永久删除所有备用码（包括未使用的）')}
                </li>
              </ul>
            </div>

            <Divider margin={16} />

            <div className='space-y-4'>
              <div>
                <Text
                  strong
                  className='block mb-2 text-slate-700 dark:text-slate-200'
                >
                  {t('验证身份')}
                </Text>
                <Input
                  placeholder={t('请输入认证器验证码或备用码')}
                  value={verificationCode}
                  onChange={setVerificationCode}
                  size='large'
                  className='!rounded-lg'
                />
              </div>

              <div>
                <Checkbox
                  checked={confirmDisable}
                  onChange={(e) => setConfirmDisable(e.target.checked)}
                  className='text-sm'
                >
                  {t(
                    '我已了解禁用两步验证将永久删除所有相关设置和备用码，此操作不可撤销',
                  )}
                </Checkbox>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* 重新生成备用码模态框 */}
      <Modal
        title={
          <div className='flex items-center'>
            <IconRefresh className='mr-2 text-slate-600' />
            {t('重新生成备用码')}
          </div>
        }
        visible={backupModalVisible}
        onCancel={() => {
          setBackupModalVisible(false);
          setVerificationCode('');
          setBackupCodes([]);
        }}
        footer={renderRegenerateModalFooter()}
        width={500}
        style={{ maxWidth: '90vw' }}
      >
        <div className='space-y-6'>
          {backupCodes.length === 0 ? (
            <>
              {/* 警告提示 */}
              <div className='rounded-xl'>
                <Banner
                  type='warning'
                  description={t(
                    '重新生成备用码将使现有的备用码失效，请确保您已保存了当前的备用码。',
                  )}
                  className='!rounded-lg'
                />
              </div>

              {/* 验证区域 */}
              <div className='space-y-4'>
                <div>
                  <Text
                    strong
                    className='block mb-2 text-slate-700 dark:text-slate-200'
                  >
                    {t('验证身份')}
                  </Text>
                  <Input
                    placeholder={t('请输入认证器验证码')}
                    value={verificationCode}
                    onChange={setVerificationCode}
                    size='large'
                    className='!rounded-lg'
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              {/* 成功提示 */}
              <Space vertical style={{ width: '100%' }}>
                <div className='flex items-center justify-center gap-2'>
                  <Badge dot type='success' />
                  <Text
                    strong
                    className='text-lg text-slate-700 dark:text-slate-200'
                  >
                    {t('新的备用码已生成')}
                  </Text>
                </div>
                <Text className='text-slate-500 dark:text-slate-400 text-sm'>
                  {t('旧的备用码已失效，请保存新的备用码')}
                </Text>

                {/* 备用码展示 */}
                <BackupCodesDisplay
                  codes={backupCodes}
                  title={t('新的备用恢复代码')}
                  onCopy={copyBackupCodes}
                />
              </Space>
            </>
          )}
        </div>
      </Modal>
    </>
  );
};

export default TwoFASetting;
