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

import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Typography,
  Card,
  Space,
  Divider,
  Button,
  Banner,
  Tag,
  Collapse,
  TextArea,
  Switch,
} from '@douyinfe/semi-ui';
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
import { API, showError, showSuccess } from '../../../../helpers';

const { Text, Title } = Typography;

const UpdateConfigModal = ({ visible, onCancel, deployment, onSuccess, t }) => {
  const formRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [envVars, setEnvVars] = useState([]);
  const [secretEnvVars, setSecretEnvVars] = useState([]);

  // Initialize form data when modal opens
  useEffect(() => {
    if (visible && deployment) {
      // Set initial form values based on deployment data
      const initialValues = {
        image_url: deployment.container_config?.image_url || '',
        traffic_port: deployment.container_config?.traffic_port || null,
        entrypoint: deployment.container_config?.entrypoint?.join(' ') || '',
        registry_username: '',
        registry_secret: '',
        command: '',
      };

      if (formRef.current) {
        formRef.current.setValues(initialValues);
      }

      // Initialize environment variables
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

  const handleUpdate = async () => {
    try {
      const formValues = formRef.current
        ? await formRef.current.validate()
        : {};
      setLoading(true);

      // Prepare the update payload
      const payload = {};

      if (formValues.image_url) payload.image_url = formValues.image_url;
      if (formValues.traffic_port)
        payload.traffic_port = formValues.traffic_port;
      if (formValues.registry_username)
        payload.registry_username = formValues.registry_username;
      if (formValues.registry_secret)
        payload.registry_secret = formValues.registry_secret;
      if (formValues.command) payload.command = formValues.command;

      // Process entrypoint
      if (formValues.entrypoint) {
        payload.entrypoint = formValues.entrypoint
          .split(' ')
          .filter((cmd) => cmd.trim());
      }

      // Process environment variables
      if (envVars.length > 0) {
        payload.env_variables = envVars.reduce((acc, env) => {
          if (env.key && env.value !== undefined) {
            acc[env.key] = env.value;
          }
          return acc;
        }, {});
      }

      // Process secret environment variables
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
    if (formRef.current) {
      formRef.current.reset();
    }
    setEnvVars([]);
    setSecretEnvVars([]);
    onCancel();
  };

  const addEnvVar = () => {
    setEnvVars([...envVars, { key: '', value: '' }]);
  };

  const removeEnvVar = (index) => {
    const newEnvVars = envVars.filter((_, i) => i !== index);
    setEnvVars(newEnvVars);
  };

  const updateEnvVar = (index, field, value) => {
    const newEnvVars = [...envVars];
    newEnvVars[index][field] = value;
    setEnvVars(newEnvVars);
  };

  const addSecretEnvVar = () => {
    setSecretEnvVars([...secretEnvVars, { key: '', value: '' }]);
  };

  const removeSecretEnvVar = (index) => {
    const newSecretEnvVars = secretEnvVars.filter((_, i) => i !== index);
    setSecretEnvVars(newSecretEnvVars);
  };

  const updateSecretEnvVar = (index, field, value) => {
    const newSecretEnvVars = [...secretEnvVars];
    newSecretEnvVars[index][field] = value;
    setSecretEnvVars(newSecretEnvVars);
  };

  return (
    <Modal
      title={
        <div className='flex items-center gap-2'>
          <FaCog className='text-blue-500' />
          <span>{t('更新容器配置')}</span>
        </div>
      }
      visible={visible}
      onCancel={handleCancel}
      onOk={handleUpdate}
      okText={t('更新配置')}
      cancelText={t('取消')}
      confirmLoading={loading}
      width={700}
      className='update-config-modal'
    >
      <div className='space-y-4 max-h-[600px] overflow-y-auto'>
        {/* Container Info */}
        <Card className='border-0 bg-gray-50'>
          <div className='flex items-center justify-between'>
            <div>
              <Text strong className='text-base'>
                {deployment?.container_name}
              </Text>
              <div className='mt-1'>
                <Text type='secondary' size='small'>
                  ID: {deployment?.id}
                </Text>
              </div>
            </div>
            <Tag color='blue'>{deployment?.status}</Tag>
          </div>
        </Card>

        {/* Warning Banner */}
        <Banner
          type='warning'
          icon={<FaExclamationTriangle />}
          title={t('重要提醒')}
          description={
            <div className='space-y-2'>
              <p>
                {t(
                  '更新容器配置可能会导致容器重启，请确保在合适的时间进行此操作。',
                )}
              </p>
              <p>{t('某些配置更改可能需要几分钟才能生效。')}</p>
            </div>
          }
        />

        <Form getFormApi={(api) => (formRef.current = api)} layout='vertical'>
          <Collapse defaultActiveKey={['docker']}>
            {/* Docker Configuration */}
            <Collapse.Panel
              header={
                <div className='flex items-center gap-2'>
                  <FaDocker className='text-blue-600' />
                  <span>{t('镜像配置')}</span>
                </div>
              }
              itemKey='docker'
            >
              <div className='space-y-4'>
                <Form.Input
                  field='image_url'
                  label={t('镜像地址')}
                  placeholder={t('例如: nginx:latest')}
                  rules={[
                    {
                      type: 'string',
                      message: t('请输入有效的镜像地址'),
                    },
                  ]}
                />

                <Form.Input
                  field='registry_username'
                  label={t('镜像仓库用户名')}
                  placeholder={t('如果镜像为私有，请填写用户名')}
                />

                <Form.Input
                  field='registry_secret'
                  label={t('镜像仓库密码')}
                  mode='password'
                  placeholder={t('如果镜像为私有，请填写密码或Token')}
                />
              </div>
            </Collapse.Panel>

            {/* Network Configuration */}
            <Collapse.Panel
              header={
                <div className='flex items-center gap-2'>
                  <FaNetworkWired className='text-green-600' />
                  <span>{t('网络配置')}</span>
                </div>
              }
              itemKey='network'
            >
              <Form.InputNumber
                field='traffic_port'
                label={t('流量端口')}
                placeholder={t('容器对外暴露的端口')}
                min={1}
                max={65535}
                style={{ width: '100%' }}
                rules={[
                  {
                    type: 'number',
                    min: 1,
                    max: 65535,
                    message: t('端口号必须在1-65535之间'),
                  },
                ]}
              />
            </Collapse.Panel>

            {/* Startup Configuration */}
            <Collapse.Panel
              header={
                <div className='flex items-center gap-2'>
                  <FaTerminal className='text-purple-600' />
                  <span>{t('启动配置')}</span>
                </div>
              }
              itemKey='startup'
            >
              <div className='space-y-4'>
                <Form.Input
                  field='entrypoint'
                  label={t('启动命令 (Entrypoint)')}
                  placeholder={t('例如: /bin/bash -c "python app.py"')}
                  helpText={t('多个命令用空格分隔')}
                />

                <Form.Input
                  field='command'
                  label={t('运行命令 (Command)')}
                  placeholder={t('容器启动后执行的命令')}
                />
              </div>
            </Collapse.Panel>

            {/* Environment Variables */}
            <Collapse.Panel
              header={
                <div className='flex items-center gap-2'>
                  <FaKey className='text-orange-600' />
                  <span>{t('环境变量')}</span>
                  <Tag size='small'>{envVars.length}</Tag>
                </div>
              }
              itemKey='env'
            >
              <div className='space-y-4'>
                {/* Regular Environment Variables */}
                <div>
                  <div className='flex items-center justify-between mb-3'>
                    <Text strong>{t('普通环境变量')}</Text>
                    <Button
                      size='small'
                      icon={<FaPlus />}
                      onClick={addEnvVar}
                      theme='borderless'
                      type='primary'
                    >
                      {t('添加')}
                    </Button>
                  </div>

                  {envVars.map((envVar, index) => (
                    <div key={index} className='flex items-end gap-2 mb-2'>
                      <Input
                        placeholder={t('变量名')}
                        value={envVar.key}
                        onChange={(value) => updateEnvVar(index, 'key', value)}
                        style={{ flex: 1 }}
                      />
                      <Text>=</Text>
                      <Input
                        placeholder={t('变量值')}
                        value={envVar.value}
                        onChange={(value) =>
                          updateEnvVar(index, 'value', value)
                        }
                        style={{ flex: 2 }}
                      />
                      <Button
                        size='small'
                        icon={<FaMinus />}
                        onClick={() => removeEnvVar(index)}
                        theme='borderless'
                        type='danger'
                      />
                    </div>
                  ))}

                  {envVars.length === 0 && (
                    <div className='text-center text-gray-500 py-4 border-2 border-dashed border-gray-300 rounded-lg'>
                      <Text type='secondary'>{t('暂无环境变量')}</Text>
                    </div>
                  )}
                </div>

                <Divider />

                {/* Secret Environment Variables */}
                <div>
                  <div className='flex items-center justify-between mb-3'>
                    <div className='flex items-center gap-2'>
                      <Text strong>{t('机密环境变量')}</Text>
                      <Tag size='small' type='danger'>
                        {t('加密存储')}
                      </Tag>
                    </div>
                    <Button
                      size='small'
                      icon={<FaPlus />}
                      onClick={addSecretEnvVar}
                      theme='borderless'
                      type='danger'
                    >
                      {t('添加')}
                    </Button>
                  </div>

                  {secretEnvVars.map((envVar, index) => (
                    <div key={index} className='flex items-end gap-2 mb-2'>
                      <Input
                        placeholder={t('变量名')}
                        value={envVar.key}
                        onChange={(value) =>
                          updateSecretEnvVar(index, 'key', value)
                        }
                        style={{ flex: 1 }}
                      />
                      <Text>=</Text>
                      <Input
                        mode='password'
                        placeholder={t('变量值')}
                        value={envVar.value}
                        onChange={(value) =>
                          updateSecretEnvVar(index, 'value', value)
                        }
                        style={{ flex: 2 }}
                      />
                      <Button
                        size='small'
                        icon={<FaMinus />}
                        onClick={() => removeSecretEnvVar(index)}
                        theme='borderless'
                        type='danger'
                      />
                    </div>
                  ))}

                  {secretEnvVars.length === 0 && (
                    <div className='text-center text-gray-500 py-4 border-2 border-dashed border-red-200 rounded-lg bg-red-50'>
                      <Text type='secondary'>{t('暂无机密环境变量')}</Text>
                    </div>
                  )}

                  <Banner
                    type='info'
                    title={t('机密环境变量说明')}
                    description={t(
                      '机密环境变量将被加密存储，适用于存储密码、API密钥等敏感信息。',
                    )}
                    size='small'
                  />
                </div>
              </div>
            </Collapse.Panel>
          </Collapse>
        </Form>

        {/* Final Warning */}
        <div className='bg-yellow-50 border border-yellow-200 rounded-lg p-3'>
          <div className='flex items-start gap-2'>
            <FaExclamationTriangle className='text-yellow-600 mt-0.5' />
            <div>
              <Text strong className='text-yellow-800'>
                {t('配置更新确认')}
              </Text>
              <div className='mt-1'>
                <Text size='small' className='text-yellow-700'>
                  {t(
                    '更新配置后，容器可能需要重启以应用新的设置。请确保您了解这些更改的影响。',
                  )}
                </Text>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default UpdateConfigModal;
