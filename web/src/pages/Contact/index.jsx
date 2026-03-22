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

import React, { useContext, useEffect, useMemo, useState } from 'react';
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
import { useActualTheme } from '../../context/Theme';
import { UserContext } from '../../context/User';
import {
  getFeedbackCategoryMeta,
  getFeedbackCategoryOptions,
} from '../../helpers/feedback';

const { Title, Text } = Typography;

const ContactPage = () => {
  const { t } = useTranslation();
  const actualTheme = useActualTheme();
  const [userState] = useContext(UserContext);
  const [loading, setLoading] = useState(false);
  const [formApi, setFormApi] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('bug');
  const loginUsername = userState?.user?.username?.trim() || '';

  const categoryOptions = useMemo(
    () =>
      getFeedbackCategoryOptions(t).map((option) => ({
        ...option,
        icon:
          option.value === 'bug' ? (
            <Bug size={18} />
          ) : option.value === 'consulting' ? (
            <LifeBuoy size={18} />
          ) : option.value === 'feature' ? (
            <MessageSquareMore size={18} />
          ) : (
            <AlertCircle size={18} />
          ),
      })),
    [t],
  );
  const selectedCategoryMeta = useMemo(
    () => getFeedbackCategoryMeta(selectedCategory, t),
    [selectedCategory, t],
  );

  useEffect(() => {
    if (!formApi) {
      return;
    }

    const currentUsername = formApi.getValue('username');
    if (!currentUsername && loginUsername) {
      formApi.setValue('username', loginUsername);
    }
  }, [formApi, loginUsername]);

  const validateFeedback = (values) => {
    const username = values.username?.trim() || '';
    const email = values.email?.trim() || '';
    const content = values.content?.trim() || '';

    if (username.length < 2 || username.length > 64) {
      return { message: t('用户名长度必须在 2 到 64 个字符之间') };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { message: t('邮箱格式无效') };
    }
    if (content.length < 10 || content.length > 5000) {
      return { message: t('反馈内容长度必须在 10 到 5000 个字符之间') };
    }

    return {
      values: {
        username,
        email,
        category: selectedCategory,
        content,
      },
    };
  };

  const submitFeedback = async () => {
    const validation = validateFeedback(formApi?.getValues() || {});
    if (!validation.values) {
      showError(validation.message);
      return;
    }

    setLoading(true);
    try {
      const res = await API.post('/api/contact/feedback', validation.values);
      const { success, message } = res.data;
      if (!success) {
        showError(t(message) || message);
        return;
      }
      showSuccess(t('反馈已提交'));
      formApi?.setValues({
        username: loginUsername,
        email: '',
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
        <div
          className='relative overflow-hidden rounded-3xl border p-8 md:p-12'
          style={{
            borderColor: 'var(--semi-color-border)',
            background:
              actualTheme === 'dark'
                ? 'linear-gradient(135deg, rgba(24, 29, 38, 0.98) 0%, rgba(19, 34, 47, 0.98) 56%, rgba(14, 76, 74, 0.92) 100%)'
                : 'linear-gradient(135deg, #f7f3ea 0%, #ffffff 56%, #dff4ef 100%)',
          }}
        >
          <div
            className='absolute -top-20 right-0 h-56 w-56 rounded-full blur-3xl'
            style={{
              background:
                actualTheme === 'dark'
                  ? 'rgba(255, 179, 71, 0.14)'
                  : 'rgba(255, 179, 71, 0.20)',
            }}
          />
          <div
            className='absolute bottom-0 left-0 h-48 w-48 rounded-full blur-3xl'
            style={{
              background:
                actualTheme === 'dark'
                  ? 'rgba(53, 192, 161, 0.18)'
                  : 'rgba(53, 192, 161, 0.15)',
            }}
          />
          <div className='relative z-10'>
            <Text
              className='uppercase tracking-[0.3em]'
              style={{
                color:
                  actualTheme === 'dark'
                    ? 'rgba(255, 255, 255, 0.72)'
                    : 'var(--semi-color-text-2)',
              }}
            >
              {t('反馈中心')}
            </Text>
            <Title
              heading={2}
              className='!mb-3 !mt-3'
              style={{
                color:
                  actualTheme === 'dark' ? 'rgba(255, 255, 255, 0.96)' : undefined,
              }}
            >
              {t('联系与反馈')}
            </Title>
            <Text
              className='text-base md:text-lg'
              style={{
                color:
                  actualTheme === 'dark'
                    ? 'rgba(255, 255, 255, 0.82)'
                    : 'var(--semi-color-text-1)',
              }}
            >
              {t('遇到 bug、配置问题、采购咨询或产品建议，都可以从这里直接提交给管理员。')}
            </Text>
          </div>
        </div>

        <Row gutter={[16, 16]} className='!mt-6'>
          <Col xs={24} lg={9}>
            <Card className='!rounded-2xl h-full'>
              <Space vertical spacing='loose' align='start'>
                <Title heading={4}>{t('选择反馈类型')}</Title>
                <Text>{t('先在左侧选择类型，右侧会显示当前反馈类型提示。')}</Text>
                <Text>{t('请尽量提供可复现步骤、报错截图链接或你的使用场景。')}</Text>
                <div className='grid gap-3 w-full'>
                  {categoryOptions.map((option) => (
                    <button
                      key={option.value}
                      type='button'
                      className='w-full rounded-2xl border px-4 py-4 text-left transition-all'
                      style={{
                        borderColor:
                          selectedCategory === option.value
                            ? 'var(--semi-color-primary)'
                            : 'var(--semi-color-border)',
                        background:
                          selectedCategory === option.value
                            ? 'var(--semi-color-primary-light-default)'
                            : 'var(--semi-color-bg-1)',
                        boxShadow:
                          selectedCategory === option.value
                            ? '0 10px 30px rgba(var(--semi-blue-5), 0.12)'
                            : 'none',
                      }}
                      onClick={() => setSelectedCategory(option.value)}
                    >
                      <div className='flex items-start gap-3'>
                        <div
                          className='mt-1'
                          style={{
                            color:
                              selectedCategory === option.value
                                ? 'var(--semi-color-primary)'
                                : 'var(--semi-color-text-1)',
                          }}
                        >
                          {option.icon}
                        </div>
                        <div>
                          <div className='font-medium'>{option.label}</div>
                          <div className='text-sm text-semi-color-text-2'>
                            {option.description}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </Space>
            </Card>
          </Col>
          <Col xs={24} lg={15}>
            <Card className='!rounded-2xl'>
              <Form
                initValues={{
                  username: loginUsername,
                  email: '',
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
                  <Text className='text-sm text-semi-color-text-2 !mb-3'>
                    {t('当前反馈类型：{{type}}', {
                      type: selectedCategoryMeta.label,
                    })}
                  </Text>
                  <Form.TextArea
                    field='content'
                    label={t('内容')}
                    placeholder={selectedCategoryMeta.description}
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
