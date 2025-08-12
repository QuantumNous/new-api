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

import React, { useState, useRef, useEffect } from 'react';
import JSONEditor from '../../../common/ui/JSONEditor';
import {
  SideSheet,
  Button,
  Form,
  Typography,
  Space,
  Tag,
  Row,
  Col,
  Card,
  Avatar,
  Spin,
} from '@douyinfe/semi-ui';
import {
  IconLayers,
  IconSave,
  IconClose,
} from '@douyinfe/semi-icons';
import { API, showError, showSuccess } from '../../../../helpers';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';

const { Text, Title } = Typography;

// Example endpoint template for quick fill
const ENDPOINT_TEMPLATE = {
  openai: { path: '/v1/chat/completions', method: 'POST' },
  'openai-response': { path: '/v1/responses', method: 'POST' },
  anthropic: { path: '/v1/messages', method: 'POST' },
  gemini: { path: '/v1beta/models/{model}:generateContent', method: 'POST' },
  'jina-rerank': { path: '/rerank', method: 'POST' },
  'image-generation': { path: '/v1/images/generations', method: 'POST' },
};

const EditPrefillGroupModal = ({ visible, onClose, editingGroup, onSuccess }) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const formRef = useRef(null);
  const isEdit = editingGroup && editingGroup.id !== undefined;

  const [selectedType, setSelectedType] = useState(editingGroup?.type || 'tag');

  // 当外部传入的编辑组类型变化时同步 selectedType
  useEffect(() => {
    setSelectedType(editingGroup?.type || 'tag');
  }, [editingGroup?.type]);

  const typeOptions = [
    { label: t('模型组'), value: 'model' },
    { label: t('标签组'), value: 'tag' },
    { label: t('端点组'), value: 'endpoint' },
  ];

  // 提交表单
  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const submitData = {
        ...values,
      };
      if (values.type === 'endpoint') {
        submitData.items = values.items || '';
      } else {
        submitData.items = Array.isArray(values.items) ? values.items : [];
      }

      if (editingGroup.id) {
        submitData.id = editingGroup.id;
        const res = await API.put('/api/prefill_group', submitData);
        if (res.data.success) {
          showSuccess(t('更新成功'));
          onSuccess();
        } else {
          showError(res.data.message || t('更新失败'));
        }
      } else {
        const res = await API.post('/api/prefill_group', submitData);
        if (res.data.success) {
          showSuccess(t('创建成功'));
          onSuccess();
        } else {
          showError(res.data.message || t('创建失败'));
        }
      }
    } catch (error) {
      showError(t('操作失败'));
    }
    setLoading(false);
  };

  return (
    <SideSheet
      placement="left"
      title={
        <Space>
          {isEdit ? (
            <Tag color='blue' shape='circle'>
              {t('更新')}
            </Tag>
          ) : (
            <Tag color='green' shape='circle'>
              {t('新建')}
            </Tag>
          )}
          <Title heading={4} className='m-0'>
            {isEdit ? t('更新预填组') : t('创建新的预填组')}
          </Title>
        </Space>
      }
      visible={visible}
      onCancel={onClose}
      width={isMobile ? '100%' : 600}
      bodyStyle={{ padding: '0' }}
      footer={
        <div className='flex justify-end bg-white'>
          <Space>
            <Button
              theme='solid'
              className='!rounded-lg'
              onClick={() => formRef.current?.submitForm()}
              icon={<IconSave />}
              loading={loading}
            >
              {t('提交')}
            </Button>
            <Button
              theme='light'
              className='!rounded-lg'
              type='primary'
              onClick={onClose}
              icon={<IconClose />}
            >
              {t('取消')}
            </Button>
          </Space>
        </div>
      }
      closeIcon={null}
    >
      <Spin spinning={loading}>
        <Form
          getFormApi={(api) => (formRef.current = api)}
          initValues={{
            name: editingGroup?.name || '',
            type: editingGroup?.type || 'tag',
            description: editingGroup?.description || '',
            items: (() => {
              try {
                if (editingGroup?.type === 'endpoint') {
                  // 保持原始字符串
                  return typeof editingGroup?.items === 'string'
                    ? editingGroup.items
                    : JSON.stringify(editingGroup.items || {}, null, 2);
                }
                return Array.isArray(editingGroup?.items)
                  ? editingGroup.items
                  : [];
              } catch {
                return editingGroup?.type === 'endpoint' ? '' : [];
              }
            })(),
          }}
          onSubmit={handleSubmit}
        >
          <div className='p-2'>
            {/* 基本信息 */}
            <Card className='!rounded-2xl shadow-sm border-0'>
              <div className='flex items-center mb-2'>
                <Avatar size='small' color='green' className='mr-2 shadow-md'>
                  <IconLayers size={16} />
                </Avatar>
                <div>
                  <Text className='text-lg font-medium'>{t('基本信息')}</Text>
                  <div className='text-xs text-gray-600'>{t('设置预填组的基本信息')}</div>
                </div>
              </div>
              <Row gutter={12}>
                <Col span={24}>
                  <Form.Input
                    field="name"
                    label={t('组名')}
                    placeholder={t('请输入组名')}
                    rules={[{ required: true, message: t('请输入组名') }]}
                    showClear
                  />
                </Col>
                <Col span={24}>
                  <Form.Select
                    field="type"
                    label={t('类型')}
                    placeholder={t('选择组类型')}
                    optionList={typeOptions}
                    rules={[{ required: true, message: t('请选择组类型') }]}
                    style={{ width: '100%' }}
                    onChange={(val) => setSelectedType(val)}
                  />
                </Col>
                <Col span={24}>
                  <Form.TextArea
                    field="description"
                    label={t('描述')}
                    placeholder={t('请输入组描述')}
                    rows={3}
                    showClear
                  />
                </Col>
                <Col span={24}>
                  {selectedType === 'endpoint' ? (
                    <JSONEditor
                      field="items"
                      label={t('端点映射')}
                      value={formRef.current?.getValue('items') ?? (typeof editingGroup?.items === 'string' ? editingGroup.items : JSON.stringify(editingGroup.items || {}, null, 2))}
                      onChange={(val) => formRef.current?.setValue('items', val)}
                      editorType='object'
                      placeholder={'{\n  "openai": {"path": "/v1/chat/completions", "method": "POST"}\n}'}
                      template={ENDPOINT_TEMPLATE}
                      templateLabel={t('填入模板')}
                      extraText={t('键为端点类型，值为路径和方法对象')}
                    />
                  ) : (
                    <Form.TagInput
                      field="items"
                      label={t('项目')}
                      placeholder={t('输入项目名称，按回车添加')}
                      addOnBlur
                      showClear
                      style={{ width: '100%' }}
                    />
                  )}
                </Col>
              </Row>
            </Card>
          </div>
        </Form>
      </Spin>
    </SideSheet>
  );
};

export default EditPrefillGroupModal;