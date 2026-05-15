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

  const isEdit = Boolean(editingDeployment?.id);
  const title = t('重命名部署');

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
        const modelOptions = items.map((model) => ({
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
    if (!isEdit || !editingDeployment?.id) {
      showError(t('无效的部署信息'));
      return;
    }

    setLoading(true);
    try {
      // Only handle name update for now
      const res = await API.put(
        `/api/deployments/${editingDeployment.id}/name`,
        {
          name: values.deployment_name,
        },
      );

      if (res.data.success) {
        showSuccess(t('部署名称更新成功'));
        handleClose();
        refresh();
      } else {
        showError(res.data.message || t('更新失败'));
      }
    } catch (error) {
      console.error('Submit error:', error);
      showError(t('更新失败，请检查输入信息'));
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
    if (formRef.current && editingDeployment && visible && isEdit) {
      formRef.current.setValues({
        deployment_name: editingDeployment.deployment_name || '',
      });
    }
  }, [editingDeployment, visible, isEdit]);

  return (
    <SideSheet
      title={
        <div className='flex items-center gap-2'>
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
      <div className='p-6 h-full overflow-auto'>
        <Spin spinning={loading} style={{ width: '100%' }}>
          <Form
            ref={formRef}
            onSubmit={handleSubmit}
            labelPosition='top'
            style={{ width: '100%' }}
          >
            <Card>
              <Title heading={5} style={{ marginBottom: 16 }}>
                {t('修改部署名称')}
              </Title>

              <Row gutter={16}>
                <Col span={24}>
                  <Form.Input
                    field='deployment_name'
                    label={t('部署名称')}
                    placeholder={t('请输入新的部署名称')}
                    rules={[
                      { required: true, message: t('请输入部署名称') },
                      {
                        pattern: /^[a-zA-Z0-9-_\u4e00-\u9fa5]+$/,
                        message: t(
                          '部署名称只能包含字母、数字、横线、下划线和中文',
                        ),
                      },
                    ]}
                  />
                </Col>
              </Row>

              {isEdit && (
                <div className='mt-4 p-3 bg-gray-50 rounded'>
                  <Text type='secondary'>{t('部署ID')}: </Text>
                  <Text code>{editingDeployment.id}</Text>
                  <br />
                  <Text type='secondary'>{t('当前状态')}: </Text>
                  <Tag
                    color={
                      editingDeployment.status === 'running' ? 'green' : 'grey'
                    }
                  >
                    {editingDeployment.status}
                  </Tag>
                </div>
              )}
            </Card>
          </Form>
        </Spin>
      </div>

      <div className='p-4 border-t border-gray-200 bg-gray-50 flex justify-end'>
        <Space>
          <Button theme='outline' onClick={handleClose} disabled={loading}>
            <X size={16} className='mr-1' />
            {t('取消')}
          </Button>
          <Button
            theme='solid'
            type='primary'
            loading={loading}
            onClick={() => formRef.current?.submitForm()}
          >
            <Save size={16} className='mr-1' />
            {isEdit ? t('更新') : t('创建')}
          </Button>
        </Space>
      </div>
    </SideSheet>
  );
};

export default EditDeploymentModal;
