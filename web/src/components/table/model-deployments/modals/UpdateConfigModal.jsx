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
  useOverlayState,
} from '@heroui/react';
import {
  FaCog,
  FaDocker,
  FaKey,
  FaTerminal,
  FaNetworkWired,
  FaExclamationTriangle,
  FaPlus,
  FaMinus,
} from 'react-icons/fa';
import { ChevronDown } from 'lucide-react';
import { API, showError, showSuccess } from '../../../../helpers';

const TAG_TONE = {
  blue: 'bg-primary/15 text-primary',
  red: 'bg-danger/15 text-danger',
  grey: 'bg-surface-secondary text-muted',
};

function StatusChip({ tone = 'grey', children }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        TAG_TONE[tone] || TAG_TONE.grey
      }`}
    >
      {children}
    </span>
  );
}

// Replaces Semi `<Collapse>` / `<Collapse.Panel>` with a `<details>`
// element so accordion state is native (no extra hook + accessible by
// default).
function CollapseSection({ icon, title, suffix, defaultOpen = false, children }) {
  return (
    <details
      open={defaultOpen}
      className='group rounded-2xl border border-border bg-background'
    >
      <summary className='flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-foreground'>
        <span className='shrink-0'>{icon}</span>
        <span className='flex-1'>{title}</span>
        {suffix}
        <ChevronDown
          size={16}
          className='shrink-0 text-muted transition-transform group-open:rotate-180'
        />
      </summary>
      <div className='border-t border-border px-4 py-3'>{children}</div>
    </details>
  );
}

const inputClass =
  'h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary';

function FieldLabel({ children, required }) {
  return (
    <label className='block text-sm font-medium text-foreground'>
      {children}
      {required ? <span className='ml-0.5 text-danger'>*</span> : null}
    </label>
  );
}

function FieldHint({ children }) {
  if (!children) return null;
  return <div className='mt-1.5 text-xs text-muted'>{children}</div>;
}

const UpdateConfigModal = ({
  visible,
  onCancel,
  deployment,
  onSuccess,
  t,
}) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    image_url: '',
    traffic_port: '',
    entrypoint: '',
    registry_username: '',
    registry_secret: '',
    command: '',
  });
  const [envVars, setEnvVars] = useState([]);
  const [secretEnvVars, setSecretEnvVars] = useState([]);
  const [portError, setPortError] = useState('');

  const modalState = useOverlayState({
    isOpen: visible,
    onOpenChange: (isOpen) => {
      if (!isOpen) onCancel?.();
    },
  });

  // Initialize form data when modal opens
  useEffect(() => {
    if (visible && deployment) {
      setFormData({
        image_url: deployment.container_config?.image_url || '',
        traffic_port:
          deployment.container_config?.traffic_port != null
            ? String(deployment.container_config.traffic_port)
            : '',
        entrypoint: deployment.container_config?.entrypoint?.join(' ') || '',
        registry_username: '',
        registry_secret: '',
        command: '',
      });
      setPortError('');

      const envVarsList = deployment.container_config?.env_variables
        ? Object.entries(deployment.container_config.env_variables).map(
            ([key, value]) => ({
              key,
              value: String(value),
            }),
          )
        : [];

      setEnvVars(envVarsList);
      setSecretEnvVars([]);
    }
  }, [visible, deployment]);

  const updateField = (field) => (value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (field === 'traffic_port') {
      setPortError(validatePort(value));
    }
  };

  const validatePort = (value) => {
    if (!value) return '';
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return t('端口号必须为数字');
    if (numeric < 1 || numeric > 65535) {
      return t('端口号必须在1-65535之间');
    }
    return '';
  };

  const handleUpdate = async () => {
    const portValidation = validatePort(formData.traffic_port);
    if (portValidation) {
      setPortError(portValidation);
      return;
    }

    try {
      setLoading(true);

      // Prepare the update payload
      const payload = {};

      if (formData.image_url) payload.image_url = formData.image_url;
      if (formData.traffic_port)
        payload.traffic_port = Number(formData.traffic_port);
      if (formData.registry_username)
        payload.registry_username = formData.registry_username;
      if (formData.registry_secret)
        payload.registry_secret = formData.registry_secret;
      if (formData.command) payload.command = formData.command;

      if (formData.entrypoint) {
        payload.entrypoint = formData.entrypoint
          .split(' ')
          .filter((cmd) => cmd.trim());
      }

      if (envVars.length > 0) {
        payload.env_variables = envVars.reduce((acc, env) => {
          if (env.key && env.value !== undefined) {
            acc[env.key] = env.value;
          }
          return acc;
        }, {});
      }

      if (secretEnvVars.length > 0) {
        payload.secret_env_variables = secretEnvVars.reduce((acc, env) => {
          if (env.key && env.value !== undefined) {
            acc[env.key] = env.value;
          }
          return acc;
        }, {});
      }

      const response = await API.put(
        `/api/deployments/${deployment.id}`,
        payload,
      );

      if (response.data.success) {
        showSuccess(t('容器配置更新成功'));
        onSuccess?.(response.data.data);
        handleCancel();
      }
    } catch (error) {
      showError(
        t('更新配置失败') +
          ': ' +
          (error.response?.data?.message || error.message),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      image_url: '',
      traffic_port: '',
      entrypoint: '',
      registry_username: '',
      registry_secret: '',
      command: '',
    });
    setEnvVars([]);
    setSecretEnvVars([]);
    setPortError('');
    onCancel();
  };

  const addEnvVar = () => setEnvVars([...envVars, { key: '', value: '' }]);
  const removeEnvVar = (index) =>
    setEnvVars(envVars.filter((_, i) => i !== index));
  const updateEnvVar = (index, field, value) => {
    const next = [...envVars];
    next[index][field] = value;
    setEnvVars(next);
  };

  const addSecretEnvVar = () =>
    setSecretEnvVars([...secretEnvVars, { key: '', value: '' }]);
  const removeSecretEnvVar = (index) =>
    setSecretEnvVars(secretEnvVars.filter((_, i) => i !== index));
  const updateSecretEnvVar = (index, field, value) => {
    const next = [...secretEnvVars];
    next[index][field] = value;
    setSecretEnvVars(next);
  };

  return (
    <Modal state={modalState}>
      <ModalBackdrop variant='blur'>
        <ModalContainer size='2xl' scroll='inside' placement='center'>
          <ModalDialog className='bg-background/95 backdrop-blur'>
            <ModalHeader className='border-b border-border'>
              <div className='flex items-center gap-2'>
                <FaCog className='text-primary' />
                <span>{t('更新容器配置')}</span>
              </div>
            </ModalHeader>
            <ModalBody className='max-h-[70vh] overflow-y-auto px-4 py-4 md:px-6'>
              <div className='space-y-4'>
                {/* Container info */}
                <section className='rounded-2xl border border-border bg-surface-secondary px-4 py-3'>
                  <div className='flex items-center justify-between gap-3'>
                    <div>
                      <div className='text-base font-semibold text-foreground'>
                        {deployment?.container_name}
                      </div>
                      <div className='mt-1 text-xs text-muted'>
                        ID: {deployment?.id}
                      </div>
                    </div>
                    <StatusChip tone='blue'>{deployment?.status}</StatusChip>
                  </div>
                </section>

                {/* Warning banner */}
                <section className='rounded-2xl border border-warning/30 bg-warning/5 px-4 py-3'>
                  <div className='flex items-start gap-3'>
                    <FaExclamationTriangle className='mt-0.5 shrink-0 text-warning' />
                    <div className='space-y-2 text-sm'>
                      <div className='font-semibold text-foreground'>
                        {t('重要提醒')}
                      </div>
                      <p className='text-muted'>
                        {t(
                          '更新容器配置可能会导致容器重启，请确保在合适的时间进行此操作。',
                        )}
                      </p>
                      <p className='text-muted'>
                        {t('某些配置更改可能需要几分钟才能生效。')}
                      </p>
                    </div>
                  </div>
                </section>

                {/* Docker Configuration */}
                <CollapseSection
                  defaultOpen
                  icon={<FaDocker className='text-primary' />}
                  title={t('镜像配置')}
                >
                  <div className='space-y-4'>
                    <div className='space-y-1.5'>
                      <FieldLabel>{t('镜像地址')}</FieldLabel>
                      <input
                        type='text'
                        value={formData.image_url}
                        onChange={(event) =>
                          updateField('image_url')(event.target.value)
                        }
                        placeholder={t('例如: nginx:latest')}
                        className={inputClass}
                      />
                    </div>
                    <div className='space-y-1.5'>
                      <FieldLabel>{t('镜像仓库用户名')}</FieldLabel>
                      <input
                        type='text'
                        value={formData.registry_username}
                        onChange={(event) =>
                          updateField('registry_username')(event.target.value)
                        }
                        placeholder={t('如果镜像为私有，请填写用户名')}
                        className={inputClass}
                      />
                    </div>
                    <div className='space-y-1.5'>
                      <FieldLabel>{t('镜像仓库密码')}</FieldLabel>
                      <input
                        type='password'
                        value={formData.registry_secret}
                        onChange={(event) =>
                          updateField('registry_secret')(event.target.value)
                        }
                        placeholder={t('如果镜像为私有，请填写密码或Token')}
                        className={inputClass}
                      />
                    </div>
                  </div>
                </CollapseSection>

                {/* Network Configuration */}
                <CollapseSection
                  icon={<FaNetworkWired className='text-success' />}
                  title={t('网络配置')}
                >
                  <div className='space-y-1.5'>
                    <FieldLabel>{t('流量端口')}</FieldLabel>
                    <input
                      type='number'
                      min={1}
                      max={65535}
                      value={formData.traffic_port}
                      onChange={(event) =>
                        updateField('traffic_port')(event.target.value)
                      }
                      placeholder={t('容器对外暴露的端口')}
                      className={`${inputClass} ${portError ? 'border-danger' : ''}`}
                    />
                    {portError ? (
                      <div className='text-xs text-danger'>{portError}</div>
                    ) : null}
                  </div>
                </CollapseSection>

                {/* Startup Configuration */}
                <CollapseSection
                  icon={<FaTerminal className='text-accent' />}
                  title={t('启动配置')}
                >
                  <div className='space-y-4'>
                    <div className='space-y-1.5'>
                      <FieldLabel>{t('启动命令 (Entrypoint)')}</FieldLabel>
                      <input
                        type='text'
                        value={formData.entrypoint}
                        onChange={(event) =>
                          updateField('entrypoint')(event.target.value)
                        }
                        placeholder={t('例如: /bin/bash -c "python app.py"')}
                        className={inputClass}
                      />
                      <FieldHint>{t('多个命令用空格分隔')}</FieldHint>
                    </div>
                    <div className='space-y-1.5'>
                      <FieldLabel>{t('运行命令 (Command)')}</FieldLabel>
                      <input
                        type='text'
                        value={formData.command}
                        onChange={(event) =>
                          updateField('command')(event.target.value)
                        }
                        placeholder={t('容器启动后执行的命令')}
                        className={inputClass}
                      />
                    </div>
                  </div>
                </CollapseSection>

                {/* Environment Variables */}
                <CollapseSection
                  icon={<FaKey className='text-warning' />}
                  title={t('环境变量')}
                  suffix={<StatusChip tone='grey'>{envVars.length}</StatusChip>}
                >
                  <div className='space-y-4'>
                    {/* Regular env vars */}
                    <div>
                      <div className='mb-3 flex items-center justify-between'>
                        <span className='text-sm font-semibold text-foreground'>
                          {t('普通环境变量')}
                        </span>
                        <Button
                          size='sm'
                          variant='tertiary'
                          startContent={<FaPlus />}
                          onPress={addEnvVar}
                        >
                          {t('添加')}
                        </Button>
                      </div>

                      {envVars.map((envVar, index) => (
                        <div key={index} className='mb-2 flex items-center gap-2'>
                          <Input
                            placeholder={t('变量名')}
                            value={envVar.key}
                            onValueChange={(value) =>
                              updateEnvVar(index, 'key', value)
                            }
                            size='sm'
                            className='flex-1'
                          />
                          <span className='text-muted'>=</span>
                          <Input
                            placeholder={t('变量值')}
                            value={envVar.value}
                            onValueChange={(value) =>
                              updateEnvVar(index, 'value', value)
                            }
                            size='sm'
                            className='flex-[2]'
                          />
                          <Button
                            isIconOnly
                            size='sm'
                            variant='tertiary'
                            color='danger'
                            onPress={() => removeEnvVar(index)}
                            aria-label={t('移除')}
                          >
                            <FaMinus />
                          </Button>
                        </div>
                      ))}

                      {envVars.length === 0 && (
                        <div className='rounded-lg border-2 border-dashed border-border py-4 text-center text-sm text-muted'>
                          {t('暂无环境变量')}
                        </div>
                      )}
                    </div>

                    <div className='h-px bg-border' />

                    {/* Secret env vars */}
                    <div>
                      <div className='mb-3 flex items-center justify-between'>
                        <div className='flex items-center gap-2'>
                          <span className='text-sm font-semibold text-foreground'>
                            {t('机密环境变量')}
                          </span>
                          <StatusChip tone='red'>{t('加密存储')}</StatusChip>
                        </div>
                        <Button
                          size='sm'
                          variant='tertiary'
                          color='danger'
                          startContent={<FaPlus />}
                          onPress={addSecretEnvVar}
                        >
                          {t('添加')}
                        </Button>
                      </div>

                      {secretEnvVars.map((envVar, index) => (
                        <div key={index} className='mb-2 flex items-center gap-2'>
                          <Input
                            placeholder={t('变量名')}
                            value={envVar.key}
                            onValueChange={(value) =>
                              updateSecretEnvVar(index, 'key', value)
                            }
                            size='sm'
                            className='flex-1'
                          />
                          <span className='text-muted'>=</span>
                          <Input
                            type='password'
                            placeholder={t('变量值')}
                            value={envVar.value}
                            onValueChange={(value) =>
                              updateSecretEnvVar(index, 'value', value)
                            }
                            size='sm'
                            className='flex-[2]'
                          />
                          <Button
                            isIconOnly
                            size='sm'
                            variant='tertiary'
                            color='danger'
                            onPress={() => removeSecretEnvVar(index)}
                            aria-label={t('移除')}
                          >
                            <FaMinus />
                          </Button>
                        </div>
                      ))}

                      {secretEnvVars.length === 0 && (
                        <div className='rounded-lg border-2 border-dashed border-danger/30 bg-danger/5 py-4 text-center text-sm text-muted'>
                          {t('暂无机密环境变量')}
                        </div>
                      )}

                      <div className='mt-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted'>
                        <span className='font-semibold text-foreground'>
                          {t('机密环境变量说明')}
                        </span>
                        ：
                        {t(
                          '机密环境变量将被加密存储，适用于存储密码、API密钥等敏感信息。',
                        )}
                      </div>
                    </div>
                  </div>
                </CollapseSection>

                {/* Final warning */}
                <section className='rounded-lg border border-warning/30 bg-warning/5 p-3'>
                  <div className='flex items-start gap-2'>
                    <FaExclamationTriangle className='mt-0.5 shrink-0 text-warning' />
                    <div>
                      <div className='font-semibold text-foreground'>
                        {t('配置更新确认')}
                      </div>
                      <div className='mt-1 text-xs text-muted'>
                        {t(
                          '更新配置后，容器可能需要重启以应用新的设置。请确保您了解这些更改的影响。',
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </ModalBody>
            <ModalFooter className='border-t border-border'>
              <Button variant='tertiary' onPress={handleCancel}>
                {t('取消')}
              </Button>
              <Button
                color='primary'
                isPending={loading}
                isDisabled={Boolean(portError)}
                onPress={handleUpdate}
              >
                {t('更新配置')}
              </Button>
            </ModalFooter>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
};

export default UpdateConfigModal;
