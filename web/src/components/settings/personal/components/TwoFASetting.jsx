/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useEffect, useState } from 'react';
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
import { AlertTriangle, Copy, RefreshCw, Shield } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { API, showError, showSuccess, showWarning } from '../../../../helpers';

const TAG_TONE = {
  green: 'bg-success/15 text-success',
  red: 'bg-danger/15 text-danger',
  orange: 'bg-warning/15 text-warning',
};

function StatusChip({ tone, children }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
        TAG_TONE[tone] || TAG_TONE.green
      }`}
    >
      {children}
    </span>
  );
}

function Dot({ tone = 'warning' }) {
  const cls =
    tone === 'success'
      ? 'bg-success'
      : tone === 'danger'
        ? 'bg-danger'
        : 'bg-warning';
  return (
    <span
      className={`mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${cls}`}
    />
  );
}

function InfoBanner({ tone = 'warning', children }) {
  const cls =
    tone === 'warning'
      ? 'border-warning/30 bg-warning/5'
      : 'border-primary/20 bg-primary/5';
  return (
    <div
      className={`flex items-start gap-2 rounded-xl border ${cls} px-3 py-2 text-sm text-foreground`}
    >
      <AlertTriangle
        size={16}
        className={
          tone === 'warning'
            ? 'mt-0.5 shrink-0 text-warning'
            : 'mt-0.5 shrink-0 text-primary'
        }
      />
      <span>{children}</span>
    </div>
  );
}

const inputClass =
  'h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary disabled:opacity-50';

// Mirrors Semi `<Steps type='basic' size='small' current>`: a top
// progress bar with numbered circles, current step highlighted, prior
// steps marked done.
function Steps({ steps, current }) {
  return (
    <ol className='flex w-full items-start gap-3'>
      {steps.map((step, idx) => {
        const done = idx < current;
        const active = idx === current;
        const circleCls = done
          ? 'bg-primary text-background'
          : active
            ? 'border-2 border-primary bg-background text-primary'
            : 'border border-border bg-background text-muted';
        const labelCls = active
          ? 'text-foreground'
          : done
            ? 'text-foreground'
            : 'text-muted';
        return (
          <li key={idx} className='flex flex-1 items-start gap-2'>
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${circleCls}`}
            >
              {idx + 1}
            </div>
            <div className='min-w-0'>
              <div className={`text-sm font-medium ${labelCls}`}>
                {step.title}
              </div>
              <div className='text-xs text-muted'>{step.description}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const TwoFASetting = ({ t }) => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({
    enabled: false,
    locked: false,
    backup_codes_remaining: 0,
  });

  // Modal visibility
  const [setupModalVisible, setSetupModalVisible] = useState(false);
  const [disableModalVisible, setDisableModalVisible] = useState(false);
  const [backupModalVisible, setBackupModalVisible] = useState(false);

  // Form data
  const [setupData, setSetupData] = useState(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const setupModalState = useOverlayState({
    isOpen: setupModalVisible,
    onOpenChange: (isOpen) => {
      if (!isOpen) closeSetupModal();
    },
  });

  const disableModalState = useOverlayState({
    isOpen: disableModalVisible,
    onOpenChange: (isOpen) => {
      if (!isOpen) closeDisableModal();
    },
  });

  const backupModalState = useOverlayState({
    isOpen: backupModalVisible,
    onOpenChange: (isOpen) => {
      if (!isOpen) closeBackupModal();
    },
  });

  function closeSetupModal() {
    setSetupModalVisible(false);
    setSetupData(null);
    setCurrentStep(0);
    setVerificationCode('');
  }

  function closeDisableModal() {
    setDisableModalVisible(false);
    setVerificationCode('');
    setConfirmDisable(false);
  }

  function closeBackupModal() {
    setBackupModalVisible(false);
    setVerificationCode('');
    setBackupCodes([]);
  }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        closeSetupModal();
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
        closeDisableModal();
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

  const copyTextToClipboard = (text, successMessage = t('已复制到剪贴板')) => {
    navigator.clipboard
      .writeText(text)
      .then(() => showSuccess(successMessage))
      .catch(() => showError(t('复制失败，请手动复制')));
  };

  const copyBackupCodes = () => {
    const codesText = backupCodes.join('\n');
    copyTextToClipboard(codesText, t('备用码已复制到剪贴板'));
  };

  const BackupCodesDisplay = ({ codes, title, onCopy }) => (
    <Card className='!w-full !rounded-xl'>
      <Card.Content className='space-y-3 p-4'>
        <div className='text-sm font-semibold text-foreground'>{title}</div>
        <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
          {codes.map((code, index) => (
            <div
              key={index}
              className='flex items-center justify-between rounded-lg bg-surface-secondary px-3 py-2'
            >
              <code className='font-mono text-sm text-foreground'>{code}</code>
              <span className='text-xs text-muted'>
                #{(index + 1).toString().padStart(2, '0')}
              </span>
            </div>
          ))}
        </div>
        <div className='border-t border-border' />
        <Button
          color='primary'
          className='w-full !bg-foreground/85 hover:!bg-foreground'
          onPress={onCopy}
        >
          <Copy size={14} />
          {t('复制所有代码')}
        </Button>
      </Card.Content>
    </Card>
  );

  return (
    <>
      <Card className='!w-full !rounded-xl'>
        <Card.Content className='p-5'>
          <div className='flex flex-col items-start gap-4 sm:flex-row sm:justify-between'>
            <div className='flex w-full items-start sm:w-auto'>
              <div className='mr-4 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-secondary'>
                <Shield size={20} className='text-muted' />
              </div>
              <div className='flex-1'>
                <div className='mb-1 flex flex-wrap items-center gap-2'>
                  <h6 className='m-0 text-base font-semibold text-foreground'>
                    {t('两步验证设置')}
                  </h6>
                  {status.enabled ? (
                    <StatusChip tone='green'>{t('已启用')}</StatusChip>
                  ) : (
                    <StatusChip tone='red'>{t('未启用')}</StatusChip>
                  )}
                  {status.locked && (
                    <StatusChip tone='orange'>{t('账户已锁定')}</StatusChip>
                  )}
                </div>
                <div className='text-sm text-muted'>
                  {t(
                    '两步验证（2FA）为您的账户提供额外的安全保护。启用后，登录时需要输入密码和验证器应用生成的验证码。',
                  )}
                </div>
                {status.enabled && (
                  <div className='mt-2 text-xs text-muted'>
                    {t('剩余备用码：')}
                    {status.backup_codes_remaining || 0}
                    {t('个')}
                  </div>
                )}
              </div>
            </div>
            <div className='flex w-full flex-col gap-2 sm:w-auto'>
              {!status.enabled ? (
                <Button
                  color='primary'
                  isPending={loading}
                  onPress={handleSetup2FA}
                  className='!bg-foreground/85 hover:!bg-foreground'
                >
                  <Shield size={14} />
                  {t('启用验证')}
                </Button>
              ) : (
                <>
                  <Button
                    color='danger'
                    onPress={() => setDisableModalVisible(true)}
                    className='!bg-foreground/70 hover:!bg-foreground/85'
                  >
                    <AlertTriangle size={14} />
                    {t('禁用两步验证')}
                  </Button>
                  <Button
                    variant='tertiary'
                    onPress={() => setBackupModalVisible(true)}
                  >
                    <RefreshCw size={14} />
                    {t('重新生成备用码')}
                  </Button>
                </>
              )}
            </div>
          </div>
        </Card.Content>
      </Card>

      {/* 2FA setup modal */}
      <Modal state={setupModalState}>
        <ModalBackdrop variant='blur'>
          <ModalContainer
            size='2xl'
            placement='center'
            className='max-w-[90vw]'
          >
            <ModalDialog className='bg-background/95 backdrop-blur'>
              <ModalHeader className='border-b border-border'>
                <div className='flex items-center gap-2'>
                  <Shield size={16} className='text-muted' />
                  <span>{t('设置两步验证')}</span>
                </div>
              </ModalHeader>
              <ModalBody className='space-y-6 px-6 py-5'>
                {setupData && (
                  <>
                    <Steps
                      current={currentStep}
                      steps={[
                        {
                          title: t('扫描二维码'),
                          description: t('使用认证器应用扫描二维码'),
                        },
                        {
                          title: t('保存备用码'),
                          description: t('保存备用码以备不时之需'),
                        },
                        {
                          title: t('验证设置'),
                          description: t('输入验证码完成设置'),
                        },
                      ]}
                    />

                    <div>
                      {currentStep === 0 && (
                        <div>
                          <p className='mb-4 text-sm text-muted'>
                            {t(
                              '使用认证器应用（如 Google Authenticator、Microsoft Authenticator）扫描下方二维码：',
                            )}
                          </p>
                          <div className='mb-4 flex justify-center'>
                            <div className='rounded-lg bg-white p-4 shadow-sm'>
                              <QRCodeSVG
                                value={setupData.qr_code_data}
                                size={180}
                              />
                            </div>
                          </div>
                          <div className='rounded-lg bg-primary/10 p-3 text-sm text-primary'>
                            <span>{t('或手动输入密钥：')}</span>
                            <code className='ml-2 select-all rounded bg-background/40 px-1.5 py-0.5 font-mono text-xs text-foreground'>
                              {setupData.secret}
                            </code>
                            <button
                              type='button'
                              className='ml-2 inline-flex items-center text-xs text-primary hover:underline'
                              onClick={() =>
                                copyTextToClipboard(setupData.secret)
                              }
                              aria-label={t('复制')}
                            >
                              <Copy size={12} className='mr-1' />
                              {t('复制')}
                            </button>
                          </div>
                        </div>
                      )}

                      {currentStep === 1 && (
                        <BackupCodesDisplay
                          codes={setupData.backup_codes}
                          title={t('备用恢复代码')}
                          onCopy={() => {
                            const codesText = setupData.backup_codes.join('\n');
                            copyTextToClipboard(
                              codesText,
                              t('备用码已复制到剪贴板'),
                            );
                          }}
                        />
                      )}

                      {currentStep === 2 && (
                        <Input
                          value={verificationCode}
                          onValueChange={setVerificationCode}
                          maxLength={6}
                          placeholder={t('输入认证器应用显示的6位数字验证码')}
                          size='lg'
                        >
                          <Input.Control>
                            <Input.Element />
                          </Input.Control>
                        </Input>
                      )}
                    </div>
                  </>
                )}
              </ModalBody>
              <ModalFooter className='border-t border-border'>
                {currentStep > 0 && (
                  <Button
                    variant='tertiary'
                    onPress={() => setCurrentStep(currentStep - 1)}
                  >
                    {t('上一步')}
                  </Button>
                )}
                {currentStep < 2 ? (
                  <Button
                    color='primary'
                    className='!bg-foreground/85 hover:!bg-foreground'
                    onPress={() => setCurrentStep(currentStep + 1)}
                  >
                    {t('下一步')}
                  </Button>
                ) : (
                  <Button
                    color='primary'
                    isPending={loading}
                    className='!bg-foreground/85 hover:!bg-foreground'
                    onPress={() => {
                      if (!verificationCode) {
                        showWarning(t('请输入验证码'));
                        return;
                      }
                      handleEnable2FA();
                    }}
                  >
                    {t('完成设置并启用两步验证')}
                  </Button>
                )}
              </ModalFooter>
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      </Modal>

      {/* Disable 2FA modal */}
      <Modal state={disableModalState}>
        <ModalBackdrop variant='blur'>
          <ModalContainer size='xl' placement='center' className='max-w-[90vw]'>
            <ModalDialog className='bg-background/95 backdrop-blur'>
              <ModalHeader className='border-b border-border'>
                <div className='flex items-center gap-2'>
                  <AlertTriangle size={16} className='text-danger' />
                  <span>{t('禁用两步验证')}</span>
                </div>
              </ModalHeader>
              <ModalBody className='space-y-6 px-6 py-5'>
                <InfoBanner tone='warning'>
                  {t(
                    '警告：禁用两步验证将永久删除您的验证设置和所有备用码，此操作不可撤销！',
                  )}
                </InfoBanner>

                <div className='space-y-4'>
                  <div>
                    <div className='mb-2 text-sm font-semibold text-foreground'>
                      {t('禁用后的影响：')}
                    </div>
                    <ul className='space-y-2 text-sm text-foreground'>
                      <li className='flex items-start gap-2'>
                        <Dot tone='warning' />
                        <span>{t('降低您账户的安全性')}</span>
                      </li>
                      <li className='flex items-start gap-2'>
                        <Dot tone='warning' />
                        <span>{t('需要重新完整设置才能再次启用')}</span>
                      </li>
                      <li className='flex items-start gap-2'>
                        <Dot tone='danger' />
                        <span>{t('永久删除您的两步验证设置')}</span>
                      </li>
                      <li className='flex items-start gap-2'>
                        <Dot tone='danger' />
                        <span>{t('永久删除所有备用码（包括未使用的）')}</span>
                      </li>
                    </ul>
                  </div>

                  <div className='border-t border-border' />

                  <div>
                    <div className='mb-2 text-sm font-semibold text-foreground'>
                      {t('验证身份')}
                    </div>
                    <Input
                      value={verificationCode}
                      onValueChange={setVerificationCode}
                      placeholder={t('请输入认证器验证码或备用码')}
                      size='lg'
                    >
                      <Input.Control>
                        <Input.Element />
                      </Input.Control>
                    </Input>
                  </div>

                  <label className='flex items-start gap-2 text-sm text-foreground'>
                    <input
                      type='checkbox'
                      checked={confirmDisable}
                      onChange={(event) =>
                        setConfirmDisable(event.target.checked)
                      }
                      className='mt-0.5 h-4 w-4 accent-primary'
                    />
                    <span>
                      {t(
                        '我已了解禁用两步验证将永久删除所有相关设置和备用码，此操作不可撤销',
                      )}
                    </span>
                  </label>
                </div>
              </ModalBody>
              <ModalFooter className='border-t border-border'>
                <Button variant='tertiary' onPress={closeDisableModal}>
                  {t('取消')}
                </Button>
                <Button
                  color='danger'
                  isPending={loading}
                  isDisabled={!confirmDisable || !verificationCode}
                  className='!bg-foreground/70 hover:!bg-foreground/85'
                  onPress={handleDisable2FA}
                >
                  {t('确认禁用')}
                </Button>
              </ModalFooter>
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      </Modal>

      {/* Regenerate backup codes modal */}
      <Modal state={backupModalState}>
        <ModalBackdrop variant='blur'>
          <ModalContainer size='lg' placement='center' className='max-w-[90vw]'>
            <ModalDialog className='bg-background/95 backdrop-blur'>
              <ModalHeader className='border-b border-border'>
                <div className='flex items-center gap-2'>
                  <RefreshCw size={16} className='text-muted' />
                  <span>{t('重新生成备用码')}</span>
                </div>
              </ModalHeader>
              <ModalBody className='space-y-6 px-6 py-5'>
                {backupCodes.length === 0 ? (
                  <>
                    <InfoBanner tone='warning'>
                      {t(
                        '重新生成备用码将使现有的备用码失效，请确保您已保存了当前的备用码。',
                      )}
                    </InfoBanner>
                    <div>
                      <div className='mb-2 text-sm font-semibold text-foreground'>
                        {t('验证身份')}
                      </div>
                      <Input
                        value={verificationCode}
                        onValueChange={setVerificationCode}
                        placeholder={t('请输入认证器验证码')}
                        size='lg'
                      >
                        <Input.Control>
                          <Input.Element />
                        </Input.Control>
                      </Input>
                    </div>
                  </>
                ) : (
                  <div className='flex flex-col gap-3'>
                    <div className='flex items-center justify-center gap-2'>
                      <span className='inline-block h-2 w-2 rounded-full bg-success' />
                      <span className='text-lg font-semibold text-foreground'>
                        {t('新的备用码已生成')}
                      </span>
                    </div>
                    <div className='text-center text-sm text-muted'>
                      {t('旧的备用码已失效，请保存新的备用码')}
                    </div>
                    <BackupCodesDisplay
                      codes={backupCodes}
                      title={t('新的备用恢复代码')}
                      onCopy={copyBackupCodes}
                    />
                  </div>
                )}
              </ModalBody>
              <ModalFooter className='border-t border-border'>
                {backupCodes.length > 0 ? (
                  <Button
                    color='primary'
                    className='!bg-foreground/85 hover:!bg-foreground'
                    onPress={closeBackupModal}
                  >
                    {t('完成')}
                  </Button>
                ) : (
                  <>
                    <Button variant='tertiary' onPress={closeBackupModal}>
                      {t('取消')}
                    </Button>
                    <Button
                      color='primary'
                      isPending={loading}
                      isDisabled={!verificationCode}
                      className='!bg-foreground/85 hover:!bg-foreground'
                      onPress={handleRegenerateBackupCodes}
                    >
                      {t('生成新的备用码')}
                    </Button>
                  </>
                )}
              </ModalFooter>
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      </Modal>
    </>
  );
};

export default TwoFASetting;
