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

import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Switch,
  Collapse,
  Card,
  Divider,
  Button,
  Typography,
  Space,
  Spin,
  Tag,
  Row,
  Col,
  Alert,
  Tooltip,
  AutoComplete,
} from '@douyinfe/semi-ui';
import { IconPlus, IconMinus, IconHelpCircle, IconRefresh } from '@douyinfe/semi-icons';
import { API } from '../../../../helpers';
import { showError, showSuccess, showNotice } from '../../../../helpers';

const { Text, Title } = Typography;
const { Option } = Select;

const CreateDeploymentModal = ({ visible, onCancel, onSuccess, t }) => {
  const [formApi, setFormApi] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Resource data states
  const [hardwareTypes, setHardwareTypes] = useState([]);
  const [locations, setLocations] = useState([]);
  const [availableReplicas, setAvailableReplicas] = useState([]);
  const [priceEstimation, setPriceEstimation] = useState(null);

  // UI states
  const [loadingHardware, setLoadingHardware] = useState(false);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [loadingReplicas, setLoadingReplicas] = useState(false);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [envVariables, setEnvVariables] = useState([{ key: '', value: '' }]);
  const [secretEnvVariables, setSecretEnvVariables] = useState([{ key: '', value: '' }]);
  const [entrypoint, setEntrypoint] = useState(['']);
  const [args, setArgs] = useState(['']);

  // Form values for price calculation
  const [selectedHardwareId, setSelectedHardwareId] = useState(null);
  const [selectedLocationIds, setSelectedLocationIds] = useState([]);
  const [gpusPerContainer, setGpusPerContainer] = useState(1);
  const [durationHours, setDurationHours] = useState(24);
  const [replicaCount, setReplicaCount] = useState(1);

  // Load initial data when modal opens
  useEffect(() => {
    if (visible) {
      loadHardwareTypes();
      loadLocations();
      if (formApi) {
        formApi.reset();
      }
      resetFormState();
    }
  }, [visible]);

  // Load available replicas when hardware or locations change
  useEffect(() => {
    if (selectedHardwareId && gpusPerContainer > 0) {
      loadAvailableReplicas(selectedHardwareId, gpusPerContainer);
    }
  }, [selectedHardwareId, gpusPerContainer]);

  // Calculate price when relevant parameters change
  useEffect(() => {
    if (
      selectedHardwareId &&
      selectedLocationIds.length > 0 &&
      gpusPerContainer > 0 &&
      durationHours > 0 &&
      replicaCount > 0
    ) {
      calculatePrice();
    } else {
      setPriceEstimation(null);
    }
  }, [selectedHardwareId, selectedLocationIds, gpusPerContainer, durationHours, replicaCount]);

  const resetFormState = () => {
    setSelectedHardwareId(null);
    setSelectedLocationIds([]);
    setGpusPerContainer(1);
    setDurationHours(24);
    setReplicaCount(1);
    setPriceEstimation(null);
    setAvailableReplicas([]);
    setEnvVariables([{ key: '', value: '' }]);
    setSecretEnvVariables([{ key: '', value: '' }]);
    setEntrypoint(['']);
    setArgs(['']);
    setShowAdvanced(false);
  };

  const loadHardwareTypes = async () => {
    try {
      setLoadingHardware(true);
      const response = await API.get('/api/deployments/hardware-types');
      if (response.data.success) {
        setHardwareTypes(response.data.data.hardware_types || []);
      } else {
        showError(t('获取硬件类型失败: ') + response.data.message);
      }
    } catch (error) {
      showError(t('获取硬件类型失败: ') + error.message);
    } finally {
      setLoadingHardware(false);
    }
  };

  const loadLocations = async () => {
    try {
      setLoadingLocations(true);
      const response = await API.get('/api/deployments/locations');
      if (response.data.success) {
        setLocations(response.data.data.locations || []);
      } else {
        showError(t('获取部署位置失败: ') + response.data.message);
      }
    } catch (error) {
      showError(t('获取部署位置失败: ') + error.message);
    } finally {
      setLoadingLocations(false);
    }
  };

  const loadAvailableReplicas = async (hardwareId, gpuCount) => {
    try {
      setLoadingReplicas(true);
      const response = await API.get(
        `/api/deployments/available-replicas?hardware_id=${hardwareId}&gpu_count=${gpuCount}`
      );
      if (response.data.success) {
        setAvailableReplicas(response.data.data.replicas || []);
      } else {
        showError(t('获取可用资源失败: ') + response.data.message);
        setAvailableReplicas([]);
      }
    } catch (error) {
      console.error('Load available replicas error:', error);
      setAvailableReplicas([]);
    } finally {
      setLoadingReplicas(false);
    }
  };

  const calculatePrice = async () => {
    try {
      setLoadingPrice(true);
      const requestData = {
        location_ids: selectedLocationIds,
        hardware_id: selectedHardwareId,
        gpus_per_container: gpusPerContainer,
        duration_hours: durationHours,
        replica_count: replicaCount,
      };

      const response = await API.post('/api/deployments/price-estimation', requestData);
      if (response.data.success) {
        setPriceEstimation(response.data.data);
      } else {
        showError(t('价格计算失败: ') + response.data.message);
        setPriceEstimation(null);
      }
    } catch (error) {
      console.error('Price calculation error:', error);
      setPriceEstimation(null);
    } finally {
      setLoadingPrice(false);
    }
  };

  const handleSubmit = async (values) => {
    try {
      setSubmitting(true);

      // Prepare environment variables
      const envVars = {};
      envVariables.forEach(env => {
        if (env.key && env.value) {
          envVars[env.key] = env.value;
        }
      });

      const secretEnvVars = {};
      secretEnvVariables.forEach(env => {
        if (env.key && env.value) {
          secretEnvVars[env.key] = env.value;
        }
      });

      // Prepare entrypoint and args
      const cleanEntrypoint = entrypoint.filter(item => item.trim() !== '');
      const cleanArgs = args.filter(item => item.trim() !== '');

      const requestData = {
        resource_private_name: values.resource_private_name,
        duration_hours: values.duration_hours,
        gpus_per_container: values.gpus_per_container,
        hardware_id: values.hardware_id,
        location_ids: values.location_ids,
        container_config: {
          replica_count: values.replica_count,
          env_variables: envVars,
          secret_env_variables: secretEnvVars,
          entrypoint: cleanEntrypoint.length > 0 ? cleanEntrypoint : undefined,
          args: cleanArgs.length > 0 ? cleanArgs : undefined,
          traffic_port: values.traffic_port || undefined,
        },
        registry_config: {
          image_url: values.image_url,
          registry_username: values.registry_username || undefined,
          registry_secret: values.registry_secret || undefined,
        },
      };

      const response = await API.post('/api/deployments', requestData);
      
      if (response.data.success) {
        showSuccess(t('容器创建成功'));
        onSuccess?.(response.data.data);
        onCancel();
      } else {
        showError(t('容器创建失败: ') + response.data.message);
      }
    } catch (error) {
      showError(t('容器创建失败: ') + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddEnvVariable = (type) => {
    if (type === 'env') {
      setEnvVariables([...envVariables, { key: '', value: '' }]);
    } else {
      setSecretEnvVariables([...secretEnvVariables, { key: '', value: '' }]);
    }
  };

  const handleRemoveEnvVariable = (index, type) => {
    if (type === 'env') {
      const newEnvVars = envVariables.filter((_, i) => i !== index);
      setEnvVariables(newEnvVars.length > 0 ? newEnvVars : [{ key: '', value: '' }]);
    } else {
      const newSecretEnvVars = secretEnvVariables.filter((_, i) => i !== index);
      setSecretEnvVariables(newSecretEnvVars.length > 0 ? newSecretEnvVars : [{ key: '', value: '' }]);
    }
  };

  const handleEnvVariableChange = (index, field, value, type) => {
    if (type === 'env') {
      const newEnvVars = [...envVariables];
      newEnvVars[index][field] = value;
      setEnvVariables(newEnvVars);
    } else {
      const newSecretEnvVars = [...secretEnvVariables];
      newSecretEnvVars[index][field] = value;
      setSecretEnvVariables(newSecretEnvVars);
    }
  };

  const handleArrayFieldChange = (index, value, type) => {
    if (type === 'entrypoint') {
      const newEntrypoint = [...entrypoint];
      newEntrypoint[index] = value;
      setEntrypoint(newEntrypoint);
    } else {
      const newArgs = [...args];
      newArgs[index] = value;
      setArgs(newArgs);
    }
  };

  const handleAddArrayField = (type) => {
    if (type === 'entrypoint') {
      setEntrypoint([...entrypoint, '']);
    } else {
      setArgs([...args, '']);
    }
  };

  const handleRemoveArrayField = (index, type) => {
    if (type === 'entrypoint') {
      const newEntrypoint = entrypoint.filter((_, i) => i !== index);
      setEntrypoint(newEntrypoint.length > 0 ? newEntrypoint : ['']);
    } else {
      const newArgs = args.filter((_, i) => i !== index);
      setArgs(newArgs.length > 0 ? newArgs : ['']);
    }
  };

  // Get available replicas for selected locations
  const getAvailableReplicasForLocations = () => {
    if (!selectedLocationIds.length || !availableReplicas.length) return 0;
    
    return availableReplicas
      .filter(replica => selectedLocationIds.includes(replica.location_id))
      .reduce((total, replica) => total + replica.available_count, 0);
  };

  const maxAvailableReplicas = getAvailableReplicasForLocations();

  return (
    <Modal
      title={t('新建容器部署')}
      visible={visible}
      onCancel={onCancel}
      onOk={() => formApi?.submitForm()}
      okText={t('创建')}
      cancelText={t('取消')}
      width={800}
      confirmLoading={submitting}
      style={{ top: 20 }}
    >
      <Form
        getFormApi={setFormApi}
        onSubmit={handleSubmit}
        style={{ maxHeight: '70vh', overflowY: 'auto' }}
        labelPosition="top"
      >
        <Card className="mb-4">
          <Title heading={6}>{t('基本配置')}</Title>
          
          <Form.Input
            field="resource_private_name"
            label={t('容器名称')}
            placeholder={t('请输入容器名称')}
            rules={[{ required: true, message: t('请输入容器名称') }]}
          />

          <Form.Input
            field="image_url"
            label={t('镜像地址')}
            placeholder={t('例如：nginx:latest')}
            rules={[{ required: true, message: t('请输入镜像地址') }]}
          />

          <Row gutter={16}>
            <Col span={12}>
              <Form.Select
                field="hardware_id"
                label={t('硬件类型')}
                placeholder={t('选择硬件类型')}
                loading={loadingHardware}
                rules={[{ required: true, message: t('请选择硬件类型') }]}
                onChange={(value) => setSelectedHardwareId(value)}
              >
                {hardwareTypes.map(hardware => (
                  <Option key={hardware.id} value={hardware.id}>
                    <div>
                      <Text strong>{hardware.name}</Text>
                      <br />
                      <Text size="small" type="tertiary">
                        {t('最大GPU数')}: {hardware.max_gpus}
                        {hardware.available && <Tag color="green" size="small" style={{ marginLeft: 8 }}>可用</Tag>}
                      </Text>
                    </div>
                  </Option>
                ))}
              </Form.Select>
            </Col>
            <Col span={12}>
              <Form.InputNumber
                field="gpus_per_container"
                label={t('每容器GPU数量')}
                placeholder={1}
                min={1}
                max={selectedHardwareId ? hardwareTypes.find(h => h.id === selectedHardwareId)?.max_gpus : 8}
                rules={[{ required: true, message: t('请输入GPU数量') }]}
                onChange={(value) => setGpusPerContainer(value)}
              />
            </Col>
          </Row>

          <Form.Select
            field="location_ids"
            label={
              <Space>
                {t('部署位置')}
                {loadingReplicas && <Spin size="small" />}
              </Space>
            }
            placeholder={t('选择部署位置（可多选）')}
            multiple
            loading={loadingLocations}
            rules={[{ required: true, message: t('请选择至少一个部署位置') }]}
            onChange={(value) => setSelectedLocationIds(value)}
          >
            {locations.map(location => {
              const availableCount = availableReplicas.find(
                r => r.location_id === location.id
              )?.available_count || 0;
              
              return (
                <Option key={location.id} value={location.id} disabled={availableCount === 0}>
                  <div>
                    <Text strong>{location.name}</Text>
                    <Text size="small" type="tertiary" style={{ marginLeft: 8 }}>
                      ({location.region || location.country})
                    </Text>
                    <br />
                    <Text size="small" type={availableCount > 0 ? "success" : "danger"}>
                      {t('可用数量')}: {availableCount}
                    </Text>
                  </div>
                </Option>
              );
            })}
          </Form.Select>

          <Row gutter={16}>
            <Col span={8}>
              <Form.InputNumber
                field="replica_count"
                label={t('副本数量')}
                placeholder={1}
                min={1}
                max={maxAvailableReplicas || 100}
                rules={[{ required: true, message: t('请输入副本数量') }]}
                onChange={(value) => setReplicaCount(value)}
              />
              {maxAvailableReplicas > 0 && (
                <Text size="small" type="tertiary">
                  {t('最大可用')}: {maxAvailableReplicas}
                </Text>
              )}
            </Col>
            <Col span={8}>
              <Form.InputNumber
                field="duration_hours"
                label={t('运行时长（小时）')}
                placeholder={24}
                min={1}
                max={8760} // 1 year
                rules={[{ required: true, message: t('请输入运行时长') }]}
                onChange={(value) => setDurationHours(value)}
              />
            </Col>
            <Col span={8}>
              <Form.InputNumber
                field="traffic_port"
                label={
                  <Space>
                    {t('流量端口')}
                    <Tooltip content={t('容器对外服务的端口号，可选')}>
                      <IconHelpCircle />
                    </Tooltip>
                  </Space>
                }
                placeholder={t('例如：8080')}
                min={1}
                max={65535}
              />
            </Col>
          </Row>
        </Card>

        {priceEstimation && (
          <Card className="mb-4">
            <Title heading={6}>{t('价格预估')}</Title>
            <Row gutter={16}>
              <Col span={8}>
                <Text strong>{t('总费用')}: </Text>
                <Text size="large" type="primary">
                  ${priceEstimation.estimated_cost?.toFixed(4)} {priceEstimation.currency}
                </Text>
              </Col>
              <Col span={8}>
                <Text strong>{t('小时费率')}: </Text>
                <Text>
                  ${priceEstimation.price_breakdown?.hourly_rate?.toFixed(4)} {priceEstimation.currency}/h
                </Text>
              </Col>
              <Col span={8}>
                <Text strong>{t('计算成本')}: </Text>
                <Text>
                  ${priceEstimation.price_breakdown?.compute_cost?.toFixed(4)} {priceEstimation.currency}
                </Text>
              </Col>
            </Row>
            {loadingPrice && (
              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <Spin size="small" />
                <Text size="small" style={{ marginLeft: 8 }}>{t('价格计算中...')}</Text>
              </div>
            )}
          </Card>
        )}

        <Collapse>
          <Collapse.Panel header={t('高级配置')} itemKey="advanced">
            <Card>
              <Title heading={6}>{t('镜像仓库配置')}</Title>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Input
                    field="registry_username"
                    label={t('镜像仓库用户名')}
                    placeholder={t('私有镜像仓库的用户名')}
                  />
                </Col>
                <Col span={12}>
                  <Form.Input
                    field="registry_secret"
                    label={t('镜像仓库密码')}
                    type="password"
                    placeholder={t('私有镜像仓库的密码')}
                  />
                </Col>
              </Row>
            </Card>

            <Divider />

            <Card>
              <Title heading={6}>{t('容器启动配置')}</Title>
              
              <div style={{ marginBottom: 16 }}>
                <Text strong>{t('启动命令 (Entrypoint)')}</Text>
                {entrypoint.map((cmd, index) => (
                  <div key={index} style={{ display: 'flex', marginTop: 8 }}>
                    <Input
                      value={cmd}
                      placeholder={t('例如：/bin/bash')}
                      onChange={(value) => handleArrayFieldChange(index, value, 'entrypoint')}
                      style={{ flex: 1, marginRight: 8 }}
                    />
                    <Button
                      icon={<IconMinus />}
                      onClick={() => handleRemoveArrayField(index, 'entrypoint')}
                      disabled={entrypoint.length === 1}
                    />
                  </div>
                ))}
                <Button
                  icon={<IconPlus />}
                  onClick={() => handleAddArrayField('entrypoint')}
                  style={{ marginTop: 8 }}
                >
                  {t('添加启动命令')}
                </Button>
              </div>

              <div style={{ marginBottom: 16 }}>
                <Text strong>{t('启动参数 (Args)')}</Text>
                {args.map((arg, index) => (
                  <div key={index} style={{ display: 'flex', marginTop: 8 }}>
                    <Input
                      value={arg}
                      placeholder={t('例如：-c')}
                      onChange={(value) => handleArrayFieldChange(index, value, 'args')}
                      style={{ flex: 1, marginRight: 8 }}
                    />
                    <Button
                      icon={<IconMinus />}
                      onClick={() => handleRemoveArrayField(index, 'args')}
                      disabled={args.length === 1}
                    />
                  </div>
                ))}
                <Button
                  icon={<IconPlus />}
                  onClick={() => handleAddArrayField('args')}
                  style={{ marginTop: 8 }}
                >
                  {t('添加启动参数')}
                </Button>
              </div>
            </Card>

            <Divider />

            <Card>
              <Title heading={6}>{t('环境变量')}</Title>
              
              <div style={{ marginBottom: 16 }}>
                <Text strong>{t('普通环境变量')}</Text>
                {envVariables.map((env, index) => (
                  <Row key={index} gutter={8} style={{ marginTop: 8 }}>
                    <Col span={10}>
                      <Input
                        placeholder={t('变量名')}
                        value={env.key}
                        onChange={(value) => handleEnvVariableChange(index, 'key', value, 'env')}
                      />
                    </Col>
                    <Col span={10}>
                      <Input
                        placeholder={t('变量值')}
                        value={env.value}
                        onChange={(value) => handleEnvVariableChange(index, 'value', value, 'env')}
                      />
                    </Col>
                    <Col span={4}>
                      <Button
                        icon={<IconMinus />}
                        onClick={() => handleRemoveEnvVariable(index, 'env')}
                        disabled={envVariables.length === 1}
                      />
                    </Col>
                  </Row>
                ))}
                <Button
                  icon={<IconPlus />}
                  onClick={() => handleAddEnvVariable('env')}
                  style={{ marginTop: 8 }}
                >
                  {t('添加环境变量')}
                </Button>
              </div>

              <div>
                <Text strong>{t('密钥环境变量')}</Text>
                {secretEnvVariables.map((env, index) => (
                  <Row key={index} gutter={8} style={{ marginTop: 8 }}>
                    <Col span={10}>
                      <Input
                        placeholder={t('变量名')}
                        value={env.key}
                        onChange={(value) => handleEnvVariableChange(index, 'key', value, 'secret')}
                      />
                    </Col>
                    <Col span={10}>
                      <Input
                        placeholder={t('变量值')}
                        type="password"
                        value={env.value}
                        onChange={(value) => handleEnvVariableChange(index, 'value', value, 'secret')}
                      />
                    </Col>
                    <Col span={4}>
                      <Button
                        icon={<IconMinus />}
                        onClick={() => handleRemoveEnvVariable(index, 'secret')}
                        disabled={secretEnvVariables.length === 1}
                      />
                    </Col>
                  </Row>
                ))}
                <Button
                  icon={<IconPlus />}
                  onClick={() => handleAddEnvVariable('secret')}
                  style={{ marginTop: 8 }}
                >
                  {t('添加密钥环境变量')}
                </Button>
              </div>
            </Card>
          </Collapse.Panel>
        </Collapse>
      </Form>
    </Modal>
  );
};

export default CreateDeploymentModal;