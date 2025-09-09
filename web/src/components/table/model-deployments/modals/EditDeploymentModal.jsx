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
  SideSheet,
  Form,
  Button,
  Space,
  Spin,
  Typography,
  Card,
  InputNumber,
  Select,
  Input,
  Row,
  Col,
  Divider,
  Tag,
} from '@douyinfe/semi-ui';
import { Save, X, Server } from 'lucide-react';
import { API, showError, showSuccess } from '../../../../helpers';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';

const { Text, Title } = Typography;

const EditDeploymentModal = ({
  refresh,
  editingDeployment,
  visible,
  handleClose,
}) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const formRef = useRef();

  const isEdit = editingDeployment?.id;
  const title = isEdit ? t('编辑部署') : t('新增部署');

  // Resource configuration options
  const cpuOptions = [
    { label: '0.5 Core', value: '0.5' },
    { label: '1 Core', value: '1' },
    { label: '2 Cores', value: '2' },
    { label: '4 Cores', value: '4' },
    { label: '8 Cores', value: '8' },
  ];

  const memoryOptions = [
    { label: '1GB', value: '1Gi' },
    { label: '2GB', value: '2Gi' },
    { label: '4GB', value: '4Gi' },
    { label: '8GB', value: '8Gi' },
    { label: '16GB', value: '16Gi' },
    { label: '32GB', value: '32Gi' },
  ];

  const gpuOptions = [
    { label: t('无GPU'), value: '' },
    { label: '1 GPU', value: '1' },
    { label: '2 GPUs', value: '2' },
    { label: '4 GPUs', value: '4' },
  ];

  // Load available models
  const loadModels = async () => {
    setLoadingModels(true);
    try {
      const res = await API.get('/api/models/?page_size=1000');
      if (res.data.success) {
        const items = res.data.data.items || res.data.data || [];
        const modelOptions = items.map(model => ({
          label: `${model.model_name} (${model.vendor?.name || 'Unknown'})`,
          value: model.model_name,
          model_id: model.id,
        }));
        setModels(modelOptions);
      }
    } catch (error) {
      console.error('Failed to load models:', error);
      showError(t('加载模型列表失败'));
    }
    setLoadingModels(false);
  };

  // Form submission
  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const deploymentData = {
        deployment_name: values.deployment_name,
        model_name: values.model_name,
        instance_count: values.instance_count || 1,
        resource_config: {
          cpu: values.cpu,
          memory: values.memory,
          gpu: values.gpu || null,
        },
        description: values.description || '',
      };

      let res;
      if (isEdit) {
        res = await API.put(`/api/deployments/${editingDeployment.id}`, deploymentData);
      } else {
        res = await API.post('/api/deployments', deploymentData);
      }

      if (res.data.success) {
        showSuccess(isEdit ? t('部署更新成功') : t('部署创建成功'));
        handleClose();
        refresh();
      } else {
        showError(res.data.message || t('操作失败'));
      }
    } catch (error) {
      console.error('Submit error:', error);
      showError(t('操作失败，请检查输入信息'));
    }
    setLoading(false);
  };

  // Load models when modal opens
  useEffect(() => {
    if (visible) {
      loadModels();
    }
  }, [visible]);

  // Set form values when editing
  useEffect(() => {
    if (formRef.current && editingDeployment && visible) {
      if (isEdit) {
        const { resource_config = {} } = editingDeployment;
        formRef.current.setValues({
          deployment_name: editingDeployment.deployment_name || '',
          model_name: editingDeployment.model_name || '',
          instance_count: editingDeployment.instance_count || 1,
          cpu: resource_config.cpu || '1',
          memory: resource_config.memory || '2Gi',
          gpu: resource_config.gpu || '',
          description: editingDeployment.description || '',
        });
      } else {
        formRef.current.reset();
      }
    }
  }, [editingDeployment, visible, isEdit]);

  return (
    <SideSheet
      title={
        <div className="flex items-center gap-2">
          <Server size={20} />
          <span>{title}</span>
        </div>
      }
      visible={visible}
      onCancel={handleClose}
      width={isMobile ? '100%' : 600}
      bodyStyle={{ padding: 0 }}
      maskClosable={false}
      closeOnEsc={true}
    >
      <div className="p-6 h-full overflow-auto">
        <Spin spinning={loading} style={{ width: '100%' }}>
          <Form
            ref={formRef}
            onSubmit={handleSubmit}
            labelPosition="top"
            style={{ width: '100%' }}
          >
            <Card className="mb-4">
              <Title heading={5} style={{ marginBottom: 16 }}>
                {t('基本信息')}
              </Title>
              
              <Row gutter={16}>
                <Col span={24}>
                  <Form.Input
                    field="deployment_name"
                    label={t('部署名称')}
                    placeholder={t('请输入部署名称')}
                    rules={[
                      { required: true, message: t('请输入部署名称') },
                      { 
                        pattern: /^[a-zA-Z0-9-_]+$/, 
                        message: t('部署名称只能包含字母、数字、横线和下划线') 
                      },
                    ]}
                  />
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={24}>
                  <Form.Select
                    field="model_name"
                    label={t('选择模型')}
                    placeholder={t('请选择要部署的模型')}
                    optionList={models}
                    loading={loadingModels}
                    filter
                    rules={[{ required: true, message: t('请选择模型') }]}
                  />
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.InputNumber
                    field="instance_count"
                    label={t('实例数量')}
                    placeholder={t('请输入实例数量')}
                    min={1}
                    max={10}
                    step={1}
                    formatter={value => `${value} 个实例`}
                    parser={value => value.replace(/[^\d]/g, '')}
                    rules={[{ required: true, message: t('请输入实例数量') }]}
                  />
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={24}>
                  <Form.TextArea
                    field="description"
                    label={t('描述')}
                    placeholder={t('请输入部署描述（可选）')}
                    rows={3}
                    maxLength={500}
                    showClear
                  />
                </Col>
              </Row>
            </Card>

            <Card>
              <Title heading={5} style={{ marginBottom: 16 }}>
                {t('资源配置')}
              </Title>
              
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Select
                    field="cpu"
                    label={t('CPU配置')}
                    placeholder={t('请选择CPU配置')}
                    optionList={cpuOptions}
                    rules={[{ required: true, message: t('请选择CPU配置') }]}
                  />
                </Col>
                <Col span={12}>
                  <Form.Select
                    field="memory"
                    label={t('内存配置')}
                    placeholder={t('请选择内存配置')}
                    optionList={memoryOptions}
                    rules={[{ required: true, message: t('请选择内存配置') }]}
                  />
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Select
                    field="gpu"
                    label={t('GPU配置')}
                    placeholder={t('请选择GPU配置')}
                    optionList={gpuOptions}
                  />
                </Col>
              </Row>

              {isEdit && editingDeployment.status && (
                <div className="mt-4">
                  <Text type="secondary">{t('当前状态')}: </Text>
                  <Tag color={editingDeployment.status === 'running' ? 'green' : 'grey'}>
                    {editingDeployment.status}
                  </Tag>
                </div>
              )}
            </Card>
          </Form>
        </Spin>
      </div>

      <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
        <Space>
          <Button 
            theme="outline" 
            onClick={handleClose}
            disabled={loading}
          >
            <X size={16} className="mr-1" />
            {t('取消')}
          </Button>
          <Button
            theme="solid"
            type="primary"
            loading={loading}
            onClick={() => formRef.current?.submitForm()}
          >
            <Save size={16} className="mr-1" />
            {isEdit ? t('更新') : t('创建')}
          </Button>
        </Space>
      </div>
    </SideSheet>
  );
};

export default EditDeploymentModal;