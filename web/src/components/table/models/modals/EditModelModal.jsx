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

import React, { useState, useEffect, useRef, useMemo } from 'react';
import JSONEditor from '../../../common/ui/JSONEditor';
import {
  SideSheet,
  Form,
  Button,
  Space,
  Spin,
  Typography,
  Card,
  Tag,
  Avatar,
  Col,
  Row,
} from '@douyinfe/semi-ui';
import { Save, X, FileText } from 'lucide-react';
import { IconLink } from '@douyinfe/semi-icons';
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

const nameRuleOptions = [
  { label: '精确名称匹配', value: 0 },
  { label: '前缀名称匹配', value: 1 },
  { label: '包含名称匹配', value: 2 },
  { label: '后缀名称匹配', value: 3 },
];

const EditModelModal = (props) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const isMobile = useIsMobile();
  const formApiRef = useRef(null);
  const isEdit = props.editingModel && props.editingModel.id !== undefined;
  const placement = useMemo(() => (isEdit ? 'right' : 'left'), [isEdit]);

  // 供应商列表
  const [vendors, setVendors] = useState([]);

  // 预填组（标签、端点）
  const [tagGroups, setTagGroups] = useState([]);
  const [endpointGroups, setEndpointGroups] = useState([]);

  // 获取供应商列表
  const fetchVendors = async () => {
    try {
      const res = await API.get('/api/vendors/?page_size=1000'); // 获取全部供应商
      if (res.data.success) {
        const items = res.data.data.items || res.data.data || [];
        setVendors(Array.isArray(items) ? items : []);
      }
    } catch (error) {
      // ignore
    }
  };

  // 获取预填组（标签、端点）
  const fetchPrefillGroups = async () => {
    try {
      const [tagRes, endpointRes] = await Promise.all([
        API.get('/api/prefill_group?type=tag'),
        API.get('/api/prefill_group?type=endpoint'),
      ]);
      if (tagRes?.data?.success) {
        setTagGroups(tagRes.data.data || []);
      }
      if (endpointRes?.data?.success) {
        setEndpointGroups(endpointRes.data.data || []);
      }
    } catch (error) {
      // ignore
    }
  };

  useEffect(() => {
    if (props.visiable) {
      fetchVendors();
      fetchPrefillGroups();
    }
  }, [props.visiable]);

  const getInitValues = () => ({
    model_name: props.editingModel?.model_name || '',
    description: '',
    icon: '',
    tags: [],
    vendor_id: undefined,
    vendor: '',
    vendor_icon: '',
    endpoints: '',
    name_rule: props.editingModel?.model_name ? 0 : undefined, // 通过未配置模型过来的固定为精确匹配
    status: true,
  });

  const handleCancel = () => {
    props.handleClose();
  };

  const loadModel = async () => {
    if (!isEdit || !props.editingModel.id) return;

    setLoading(true);
    try {
      const res = await API.get(`/api/models/${props.editingModel.id}`);
      const { success, message, data } = res.data;
      if (success) {
        // 处理tags
        if (data.tags) {
          data.tags = data.tags.split(',').filter(Boolean);
        } else {
          data.tags = [];
        }
        // endpoints 保持原始 JSON 字符串，若为空设为空串
        if (!data.endpoints) {
          data.endpoints = '';
        }
        // 处理status，将数字转为布尔值
        data.status = data.status === 1;
        if (formApiRef.current) {
          formApiRef.current.setValues({ ...getInitValues(), ...data });
        }
      } else {
        showError(message);
      }
    } catch (error) {
      showError(t('加载模型信息失败'));
    }
    setLoading(false);
  };

  useEffect(() => {
    if (formApiRef.current) {
      if (!isEdit) {
        formApiRef.current.setValues({
          ...getInitValues(),
          model_name: props.editingModel?.model_name || '',
        });
      }
    }
  }, [props.editingModel?.id, props.editingModel?.model_name]);

  useEffect(() => {
    if (props.visiable) {
      if (isEdit) {
        loadModel();
      } else {
        formApiRef.current?.setValues({
          ...getInitValues(),
          model_name: props.editingModel?.model_name || '',
        });
      }
    } else {
      formApiRef.current?.reset();
    }
  }, [props.visiable, props.editingModel?.id, props.editingModel?.model_name]);

  const submit = async (values) => {
    setLoading(true);
    try {
      const submitData = {
        ...values,
        tags: Array.isArray(values.tags) ? values.tags.join(',') : values.tags,
        endpoints: values.endpoints || '',
        status: values.status ? 1 : 0,
      };

      if (isEdit) {
        submitData.id = props.editingModel.id;
        const res = await API.put('/api/models/', submitData);
        const { success, message } = res.data;
        if (success) {
          showSuccess(t('模型更新成功！'));
          props.refresh();
          props.handleClose();
        } else {
          showError(t(message));
        }
      } else {
        const res = await API.post('/api/models/', submitData);
        const { success, message } = res.data;
        if (success) {
          showSuccess(t('模型创建成功！'));
          props.refresh();
          props.handleClose();
        } else {
          showError(t(message));
        }
      }
    } catch (error) {
      showError(error.response?.data?.message || t('操作失败'));
    }
    setLoading(false);
    formApiRef.current?.setValues(getInitValues());
  };

  return (
    <SideSheet
      placement={placement}
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
            {isEdit ? t('更新模型信息') : t('创建新的模型')}
          </Title>
        </Space>
      }
      bodyStyle={{ padding: '0' }}
      visible={props.visiable}
      width={isMobile ? '100%' : 600}
      footer={
        <div className='flex justify-end bg-white'>
          <Space>
            <Button
              theme='solid'
              className='!rounded-lg'
              onClick={() => formApiRef.current?.submitForm()}
              icon={<Save size={16} />}
              loading={loading}
            >
              {t('提交')}
            </Button>
            <Button
              theme='light'
              className='!rounded-lg'
              type='primary'
              onClick={handleCancel}
              icon={<X size={16} />}
            >
              {t('取消')}
            </Button>
          </Space>
        </div>
      }
      closeIcon={null}
      onCancel={() => handleCancel()}
    >
      <Spin spinning={loading}>
        <Form
          key={isEdit ? 'edit' : 'new'}
          initValues={getInitValues()}
          getFormApi={(api) => (formApiRef.current = api)}
          onSubmit={submit}
        >
          {({ values }) => (
            <div className='p-2'>
              {/* 基本信息 */}
              <Card className='!rounded-2xl shadow-sm border-0'>
                <div className='flex items-center mb-2'>
                  <Avatar size='small' color='green' className='mr-2 shadow-md'>
                    <FileText size={16} />
                  </Avatar>
                  <div>
                    <Text className='text-lg font-medium'>{t('基本信息')}</Text>
                    <div className='text-xs text-gray-600'>{t('设置模型的基本信息')}</div>
                  </div>
                </div>
                <Row gutter={12}>
                  <Col span={24}>
                    <Form.Input
                      field='model_name'
                      label={t('模型名称')}
                      placeholder={t('请输入模型名称，如：gpt-4')}
                      rules={[{ required: true, message: t('请输入模型名称') }]}
                      showClear
                    />
                  </Col>

                  <Col span={24}>
                    <Form.Select
                      field='name_rule'
                      label={t('名称匹配类型')}
                      placeholder={t('请选择名称匹配类型')}
                      optionList={nameRuleOptions.map(o => ({ label: t(o.label), value: o.value }))}
                      rules={[{ required: true, message: t('请选择名称匹配类型') }]}
                      extraText={t('根据模型名称和匹配规则查找模型元数据，优先级：精确 > 前缀 > 后缀 > 包含')}
                      style={{ width: '100%' }}
                    />
                  </Col>

                  <Col span={24}>
                    <Form.Input
                      field='icon'
                      label={t('模型图标')}
                      placeholder={t('请输入图标名称')}
                      extraText={
                        <span>
                          {t('图标使用@lobehub/icons库，如：OpenAI、Claude.Color，支持链式参数：OpenAI.Avatar.type={\'platform\'}、OpenRouter.Avatar.shape={\'square\'}，查询所有可用图标请 ')}
                          <Typography.Text
                            link={{ href: 'https://icons.lobehub.com/components/lobe-hub', target: '_blank' }}
                            icon={<IconLink />}
                            underline
                          >
                            {t('请点击我')}
                          </Typography.Text>
                        </span>
                      }
                      showClear
                    />
                  </Col>

                  <Col span={24}>
                    <Form.TextArea
                      field='description'
                      label={t('描述')}
                      placeholder={t('请输入模型描述')}
                      rows={3}
                      showClear
                    />
                  </Col>
                  <Col span={24}>
                    <Form.TagInput
                      field='tags'
                      label={t('标签')}
                      placeholder={t('输入标签或使用","分隔多个标签')}
                      addOnBlur
                      showClear
                      onChange={(newTags) => {
                        if (!formApiRef.current) return;
                        const normalize = (tags) => {
                          if (!Array.isArray(tags)) return [];
                          return [...new Set(tags.flatMap(tag => tag.split(',').map(t => t.trim()).filter(Boolean)))];
                        };
                        const normalized = normalize(newTags);
                        formApiRef.current.setValue('tags', normalized);
                      }}
                      style={{ width: '100%' }}
                      {...(tagGroups.length > 0 && {
                        extraText: (
                          <Space wrap>
                            {tagGroups.map(group => (
                              <Button
                                key={group.id}
                                size='small'
                                type='primary'
                                onClick={() => {
                                  if (formApiRef.current) {
                                    const currentTags = formApiRef.current.getValue('tags') || [];
                                    const newTags = [...currentTags, ...(group.items || [])];
                                    const uniqueTags = [...new Set(newTags)];
                                    formApiRef.current.setValue('tags', uniqueTags);
                                  }
                                }}
                              >
                                {group.name}
                              </Button>
                            ))}
                          </Space>
                        )
                      })}
                    />
                  </Col>
                  <Col span={24}>
                    <Form.Select
                      field='vendor_id'
                      label={t('供应商')}
                      placeholder={t('选择模型供应商')}
                      optionList={vendors.map(v => ({ label: v.name, value: v.id }))}
                      filter
                      showClear
                      onChange={(value) => {
                        const vendorInfo = vendors.find(v => v.id === value);
                        if (vendorInfo && formApiRef.current) {
                          formApiRef.current.setValue('vendor', vendorInfo.name);
                        }
                      }}
                      style={{ width: '100%' }}
                    />
                  </Col>
                  <Col span={24}>
                    <JSONEditor
                      field='endpoints'
                      label={t('端点映射')}
                      placeholder={'{\n  "openai": {"path": "/v1/chat/completions", "method": "POST"}\n}'}
                      value={values.endpoints}
                      onChange={(val) => formApiRef.current?.setValue('endpoints', val)}
                      formApi={formApiRef.current}
                      editorType='object'
                      template={ENDPOINT_TEMPLATE}
                      templateLabel={t('填入模板')}
                      extraText={t('留空则使用默认端点；支持 {path, method}')}
                      extraFooter={endpointGroups.length > 0 && (
                        <Space wrap>
                          {endpointGroups.map(group => (
                            <Button
                              key={group.id}
                              size='small'
                              type='primary'
                              onClick={() => {
                                try {
                                  const current = formApiRef.current?.getValue('endpoints') || '';
                                  let base = {};
                                  if (current && current.trim()) base = JSON.parse(current);
                                  const groupObj = typeof group.items === 'string' ? JSON.parse(group.items || '{}') : (group.items || {});
                                  const merged = { ...base, ...groupObj };
                                  formApiRef.current?.setValue('endpoints', JSON.stringify(merged, null, 2));
                                } catch (e) {
                                  try {
                                    const groupObj = typeof group.items === 'string' ? JSON.parse(group.items || '{}') : (group.items || {});
                                    formApiRef.current?.setValue('endpoints', JSON.stringify(groupObj, null, 2));
                                  } catch { }
                                }
                              }}
                            >
                              {group.name}
                            </Button>
                          ))}
                        </Space>
                      )}
                    />
                  </Col>
                  <Col span={24}>
                    <Form.Switch
                      field='status'
                      label={t('状态')}
                      size="large"
                    />
                  </Col>
                </Row>
              </Card>
            </div>
          )}
        </Form>
      </Spin>
    </SideSheet>
  );
};

export default EditModelModal;