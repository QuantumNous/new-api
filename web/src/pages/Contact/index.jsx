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

import React, { useState } from 'react';
import {
  Button,
  Card,
  Col,
  Form,
  Row,
  Space,
  Typography,
} from '@douyinfe/semi-ui';
import { AlertCircle, Bug, LifeBuoy, MessageSquareMore } from 'lucide-react';
import { API, showError, showSuccess } from '../../helpers';
import { useTranslation } from 'react-i18next';

const { Title, Text } = Typography;

const categoryOptions = [
  { label: 'Bug', value: 'bug', icon: <Bug size={16} /> },
  { label: '咨询', value: 'consulting', icon: <LifeBuoy size={16} /> },
  { label: '建议', value: 'feature', icon: <MessageSquareMore size={16} /> },
  { label: '其他', value: 'other', icon: <AlertCircle size={16} /> },
];

const ContactPage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [formApi, setFormApi] = useState(null);

  const submitFeedback = async () => {
    const values = formApi?.getValues() || {};
    setLoading(true);
    try {
      const res = await API.post('/api/contact/feedback', values);
      const { success, message } = res.data;
      if (!success) {
        showError(message);
        return;
      }
      showSuccess(t('反馈已提交'));
      formApi?.setValues({
        username: '',
        email: '',
        category: 'bug',
        content: '',
      });
    } catch (error) {
      showError(t('提交反馈失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='mt-[60px] px-4 py-8 md:px-6 lg:px-8'>
      <div className='max-w-5xl mx-auto'>
        <div className='relative overflow-hidden rounded-3xl border border-semi-color-border bg-gradient-to-br from-[#f7f3ea] via-white to-[#dff4ef] p-8 md:p-12'>
          <div className='absolute -top-20 right-0 h-56 w-56 rounded-full bg-[#ffb347]/20 blur-3xl' />
          <div className='absolute bottom-0 left-0 h-48 w-48 rounded-full bg-[#35c0a1]/15 blur-3xl' />
          <div className='relative z-10'>
            <Text className='uppercase tracking-[0.3em] text-semi-color-text-2'>
              Contact
            </Text>
            <Title heading={2} className='!mb-3 !mt-3'>
              {t('联系与反馈')}
            </Title>
            <Text className='text-base md:text-lg text-semi-color-text-1'>
              {t('遇到 bug、配置问题、采购咨询或产品建议，都可以从这里直接提交给管理员。')}
            </Text>
          </div>
        </div>

        <Row gutter={[16, 16]} className='!mt-6'>
          <Col xs={24} lg={9}>
            <Card className='!rounded-2xl h-full'>
              <Space vertical spacing='loose' align='start'>
                <Title heading={4}>{t('提交说明')}</Title>
                <Text>{t('请尽量提供可复现步骤、报错截图链接或你的使用场景。')}</Text>
                <Text>{t('管理员会在反馈管理页面查看你提交的内容。')}</Text>
                <div className='grid gap-3 w-full'>
                  {categoryOptions.map((option) => (
                    <div
                      key={option.value}
                      className='flex items-center gap-3 rounded-2xl border border-semi-color-border bg-semi-color-bg-1 px-4 py-3'
                    >
                      {option.icon}
                      <div>
                        <div className='font-medium'>{option.label}</div>
                        <div className='text-sm text-semi-color-text-2'>
                          {option.value}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Space>
            </Card>
          </Col>
          <Col xs={24} lg={15}>
            <Card className='!rounded-2xl'>
              <Form
                initValues={{
                  username: '',
                  email: '',
                  category: 'bug',
                  content: '',
                }}
                getFormApi={setFormApi}
              >
                <Form.Section text={t('反馈表单')}>
                  <Form.Input
                    field='username'
                    label={t('用户名')}
                    placeholder={t('请输入你的称呼')}
                  />
                  <Form.Input
                    field='email'
                    label={t('邮箱')}
                    placeholder={t('请输入可联系的邮箱')}
                  />
                  <Form.Select
                    field='category'
                    label={t('反馈类型')}
                    optionList={categoryOptions.map((option) => ({
                      label: option.label,
                      value: option.value,
                    }))}
                  />
                  <Form.TextArea
                    field='content'
                    label={t('内容')}
                    placeholder={t('请描述问题、咨询内容或建议细节')}
                    autosize={{ minRows: 8, maxRows: 14 }}
                  />
                  <Button
                    theme='solid'
                    type='primary'
                    loading={loading}
                    onClick={submitFeedback}
                  >
                    {t('提交反馈')}
                  </Button>
                </Form.Section>
              </Form>
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default ContactPage;
