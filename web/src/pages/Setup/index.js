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

import React, { useEffect, useState, useRef } from 'react';
import {
  Card,
  Form,
  Button,
  Typography,
  Modal,
  Banner,
  Layout,
  Tag,
} from '@douyinfe/semi-ui';
import { API, showError, showNotice } from '../../helpers';
import { useTranslation } from 'react-i18next';
import {
  IconHelpCircle,
  IconInfoCircle,
  IconUser,
  IconLock,
  IconSetting,
  IconCheckCircleStroked,
} from '@douyinfe/semi-icons';
import { Shield, Rocket, FlaskConical, Database, Layers } from 'lucide-react';

const Setup = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [selfUseModeInfoVisible, setUsageModeInfoVisible] = useState(false);
  const [setupStatus, setSetupStatus] = useState({
    status: false,
    root_init: false,
    database_type: '',
  });
  const { Text, Title } = Typography;
  const formRef = useRef(null);

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    usageMode: 'external',
  });

  useEffect(() => {
    fetchSetupStatus();
  }, []);

  const fetchSetupStatus = async () => {
    try {
      const res = await API.get('/api/setup');
      const { success, data } = res.data;
      if (success) {
        setSetupStatus(data);

        // If setup is already completed, redirect to home
        if (data.status) {
          window.location.href = '/';
        }
      } else {
        showError(t('获取初始化状态失败'));
      }
    } catch (error) {
      console.error('Failed to fetch setup status:', error);
      showError(t('获取初始化状态失败'));
    }
  };

  const handleUsageModeChange = (val) => {
    setFormData({ ...formData, usageMode: val });
  };

  const onSubmit = () => {
    if (!formRef.current) {
      console.error('Form reference is null');
      showError(t('表单引用错误，请刷新页面重试'));
      return;
    }

    const values = formRef.current.getValues();
    console.log('Form values:', values);

    // For root_init=false, validate admin username and password
    if (!setupStatus.root_init) {
      if (!values.username || !values.username.trim()) {
        showError(t('请输入管理员用户名'));
        return;
      }

      if (!values.password || values.password.length < 8) {
        showError(t('密码长度至少为8个字符'));
        return;
      }

      if (values.password !== values.confirmPassword) {
        showError(t('两次输入的密码不一致'));
        return;
      }
    }

    // Prepare submission data
    const formValues = { ...values };
    formValues.SelfUseModeEnabled = values.usageMode === 'self';
    formValues.DemoSiteEnabled = values.usageMode === 'demo';

    // Remove usageMode as it's not needed by the backend
    delete formValues.usageMode;

    console.log('Submitting data to backend:', formValues);
    setLoading(true);

    // Submit to backend
    API.post('/api/setup', formValues)
      .then((res) => {
        const { success, message } = res.data;
        console.log('API response:', res.data);

        if (success) {
          showNotice(t('系统初始化成功，正在跳转...'));
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else {
          showError(message || t('初始化失败，请重试'));
        }
      })
      .catch((error) => {
        console.error('API error:', error);
        showError(t('系统初始化失败，请重试'));
        setLoading(false);
      })
      .finally(() => {
        // setLoading(false);
      });
  };

  return (
    <div className="bg-gray-50 mt-[60px]">
      <Layout>
        <Layout.Content>
          <div className="flex justify-center px-4 py-8">
            <div className="w-full max-w-3xl">
              {/* 主卡片容器 */}
              <Card className="!rounded-2xl shadow-lg border-0">
                {/* 顶部装饰性区域 */}
                <Card
                  className="!rounded-2xl !border-0 !shadow-2xl overflow-hidden mb-6"
                  style={{
                    background: 'linear-gradient(135deg, #f97316 0%, #f59e0b 25%, #f43f5e 50%, #ec4899 75%, #e879f9 100%)',
                    position: 'relative'
                  }}
                  bodyStyle={{ padding: 0 }}
                >
                  {/* 装饰性背景元素 */}
                  <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-white opacity-10 rounded-full"></div>
                    <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-white opacity-5 rounded-full"></div>
                    <div className="absolute top-1/2 right-1/4 w-24 h-24 bg-yellow-400 opacity-10 rounded-full"></div>
                  </div>

                  <div className="relative py-5 px-6 flex items-center" style={{ color: 'white' }}>
                    <div className="w-14 h-14 rounded-full bg-white bg-opacity-20 flex items-center justify-center mr-5 shadow-lg flex-shrink-0">
                      <IconSetting size="large" style={{ color: 'white' }} />
                    </div>
                    <div className="text-left">
                      <Title heading={3} style={{ color: 'white', marginBottom: '2px' }}>
                        {t('系统初始化')}
                      </Title>
                      <Text style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '15px' }}>
                        {t('欢迎使用，请完成以下设置以开始使用系统')}
                      </Text>
                    </div>
                  </div>
                  {/* 数据库警告 */}
                  {setupStatus.database_type === 'sqlite' && (
                    <div className="px-4">
                      <Banner
                        type='warning'
                        icon={
                          <div className="w-12 h-12 rounded-lg bg-orange-50 flex items-center justify-center">
                            <Database size={22} className="text-orange-500" />
                          </div>
                        }
                        closeIcon={null}
                        title={
                          <div className="flex items-center">
                            <span className="font-medium">{t('数据库警告')}</span>
                            <Tag color='orange' shape='circle' className="ml-2">
                              SQLite
                            </Tag>
                          </div>
                        }
                        description={
                          <div>
                            <p>
                              {t(
                                '您正在使用 SQLite 数据库。如果您在容器环境中运行，请确保已正确设置数据库文件的持久化映射，否则容器重启后所有数据将丢失！',
                              )}
                            </p>
                            <p className="mt-1">
                              <strong>{t(
                                '建议在生产环境中使用 MySQL 或 PostgreSQL 数据库，或确保 SQLite 数据库文件已映射到宿主机的持久化存储。',
                              )}</strong>
                            </p>
                          </div>
                        }
                        className="!rounded-xl mb-6"
                        fullMode={false}
                        bordered
                      />
                    </div>
                  )}
                  {/* MySQL数据库提示 */}
                  {setupStatus.database_type === 'mysql' && (
                    <div className="px-4">
                      <Banner
                        type='info'
                        icon={
                          <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center">
                            <Database size={22} className="text-blue-500" />
                          </div>
                        }
                        closeIcon={null}
                        title={
                          <div className="flex items-center">
                            <span className="font-medium">{t('数据库信息')}</span>
                            <Tag color='blue' shape='circle' className="ml-2">
                              MySQL
                            </Tag>
                          </div>
                        }
                        description={
                          <div>
                            <p>
                              {t(
                                '您正在使用 MySQL 数据库。MySQL 是一个可靠的关系型数据库管理系统，适合生产环境使用。',
                              )}
                            </p>
                          </div>
                        }
                        className="!rounded-xl mb-6"
                        fullMode={false}
                        bordered
                      />
                    </div>
                  )}
                  {/* PostgreSQL数据库提示 */}
                  {setupStatus.database_type === 'postgres' && (
                    <div className="px-4">
                      <Banner
                        type='success'
                        icon={
                          <div className="w-12 h-12 rounded-lg bg-green-50 flex items-center justify-center">
                            <Database size={22} className="text-green-500" />
                          </div>
                        }
                        closeIcon={null}
                        title={
                          <div className="flex items-center">
                            <span className="font-medium">{t('数据库信息')}</span>
                            <Tag color='green' shape='circle' className="ml-2">
                              PostgreSQL
                            </Tag>
                          </div>
                        }
                        description={
                          <div>
                            <p>
                              {t(
                                '您正在使用 PostgreSQL 数据库。PostgreSQL 是一个功能强大的开源关系型数据库系统，提供了出色的可靠性和数据完整性，适合生产环境使用。',
                              )}
                            </p>
                          </div>
                        }
                        className="!rounded-xl mb-6"
                        fullMode={false}
                        bordered
                      />
                    </div>
                  )}
                </Card>

                {/* 主内容区域 */}
                <Form
                  getFormApi={(formApi) => {
                    formRef.current = formApi;
                    console.log('Form API set:', formApi);
                  }}
                  initValues={formData}
                >
                  {/* 管理员账号设置 */}
                  <Card className="!rounded-2xl shadow-sm border-0 mb-6">
                    <div className="flex items-center mb-4 p-6 rounded-xl" style={{
                      background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #3b82f6 100%)',
                      position: 'relative'
                    }}>
                      <div className="absolute inset-0 overflow-hidden">
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white opacity-5 rounded-full"></div>
                        <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-white opacity-10 rounded-full"></div>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mr-4 relative">
                        <IconUser size="large" style={{ color: '#ffffff' }} />
                      </div>
                      <div className="relative">
                        <Text style={{ color: '#ffffff' }} className="text-lg font-medium">{t('管理员账号')}</Text>
                        <div style={{ color: '#ffffff' }} className="text-sm opacity-80">{t('设置系统管理员的登录信息')}</div>
                      </div>
                    </div>

                    {setupStatus.root_init ? (
                      <>
                        <Banner
                          type='info'
                          icon={
                            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                              <IconCheckCircleStroked size="large" className="text-blue-500" />
                            </div>
                          }
                          closeIcon={null}
                          description={
                            <div className="flex items-center">
                              <span>{t('管理员账号已经初始化过，请继续设置其他参数')}</span>
                            </div>
                          }
                          className="!rounded-lg"
                        />
                      </>
                    ) : (
                      <>
                        <Form.Input
                          field='username'
                          label={t('用户名')}
                          placeholder={t('请输入管理员用户名')}
                          prefix={<IconUser />}
                          showClear
                          size='large'
                          className="mb-4 !rounded-lg"
                          noLabel={false}
                          validateStatus="default"
                          onChange={(value) =>
                            setFormData({ ...formData, username: value })
                          }
                        />
                        <Form.Input
                          field='password'
                          label={t('密码')}
                          placeholder={t('请输入管理员密码')}
                          type='password'
                          prefix={<IconLock />}
                          showClear
                          size='large'
                          className="mb-4 !rounded-lg"
                          noLabel={false}
                          mode="password"
                          validateStatus="default"
                          onChange={(value) =>
                            setFormData({ ...formData, password: value })
                          }
                        />
                        <Form.Input
                          field='confirmPassword'
                          label={t('确认密码')}
                          placeholder={t('请确认管理员密码')}
                          type='password'
                          prefix={<IconLock />}
                          showClear
                          size='large'
                          className="!rounded-lg"
                          noLabel={false}
                          mode="password"
                          validateStatus="default"
                          onChange={(value) =>
                            setFormData({ ...formData, confirmPassword: value })
                          }
                        />
                      </>
                    )}
                  </Card>

                  {/* 使用模式 */}
                  <Card className="!rounded-2xl shadow-sm border-0 mb-6">
                    <div className="flex items-center mb-4 p-6 rounded-xl" style={{
                      background: 'linear-gradient(135deg, #4c1d95 0%, #6d28d9 50%, #7c3aed 100%)',
                      position: 'relative'
                    }}>
                      <div className="absolute inset-0 overflow-hidden">
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white opacity-5 rounded-full"></div>
                        <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-white opacity-10 rounded-full"></div>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mr-4 relative">
                        <Layers size={22} style={{ color: '#ffffff' }} />
                      </div>
                      <div className="relative">
                        <div className="flex items-center">
                          <Text style={{ color: '#ffffff' }} className="text-lg font-medium">{t('使用模式')}</Text>
                          <Button
                            theme='borderless'
                            type='tertiary'
                            icon={<IconHelpCircle size="small" style={{ color: '#ffffff' }} />}
                            size='small'
                            onClick={() => setUsageModeInfoVisible(true)}
                            className="!rounded-full"
                          />
                        </div>
                        <div style={{ color: '#ffffff' }} className="text-sm opacity-80">{t('选择适合您使用场景的模式')}</div>
                      </div>
                    </div>

                    <Form.RadioGroup
                      field='usageMode'
                      noLabel={true}
                      initValue='external'
                      onChange={handleUsageModeChange}
                      type='pureCard'
                      className="[&_.semi-radio-addon-buttonRadio-wrapper]:!rounded-xl"
                      validateStatus="default"
                    >
                      <div className="space-y-3 mt-2">
                        <Form.Radio
                          value='external'
                          className="!p-4 !rounded-xl hover:!bg-blue-50 transition-colors w-full"
                          extra={
                            <div className="flex items-start">
                              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center mr-3 flex-shrink-0">
                                <Rocket size={20} className="text-blue-500" />
                              </div>
                              <div className="flex-1">
                                <div className="font-medium text-gray-900 mb-1">{t('对外运营模式')}</div>
                                <div className="text-sm text-gray-500">{t('适用于为多个用户提供服务的场景')}</div>
                                <Tag color='blue' shape='circle' className="mt-2">
                                  {t('默认模式')}
                                </Tag>
                              </div>
                            </div>
                          }
                        />
                        <Form.Radio
                          value='self'
                          className="!p-4 !rounded-xl hover:!bg-green-50 transition-colors w-full"
                          extra={
                            <div className="flex items-start">
                              <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center mr-3 flex-shrink-0">
                                <Shield size={20} className="text-green-500" />
                              </div>
                              <div className="flex-1">
                                <div className="font-medium text-gray-900 mb-1">{t('自用模式')}</div>
                                <div className="text-sm text-gray-500">{t('适用于个人使用的场景，不需要设置模型价格')}</div>
                                <Tag color='green' shape='circle' className="mt-2">
                                  {t('无需计费')}
                                </Tag>
                              </div>
                            </div>
                          }
                        />
                        <Form.Radio
                          value='demo'
                          className="!p-4 !rounded-xl hover:!bg-purple-50 transition-colors w-full"
                          extra={
                            <div className="flex items-start">
                              <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center mr-3 flex-shrink-0">
                                <FlaskConical size={20} className="text-purple-500" />
                              </div>
                              <div className="flex-1">
                                <div className="font-medium text-gray-900 mb-1">{t('演示站点模式')}</div>
                                <div className="text-sm text-gray-500">{t('适用于展示系统功能的场景，提供基础功能演示')}</div>
                                <Tag color='purple' shape='circle' className="mt-2">
                                  {t('演示体验')}
                                </Tag>
                              </div>
                            </div>
                          }
                        />
                      </div>
                    </Form.RadioGroup>
                  </Card>
                </Form>

                <div className="flex justify-center mt-6">
                  <Button
                    type='primary'
                    onClick={onSubmit}
                    loading={loading}
                    size='large'
                    className="!rounded-lg !bg-gradient-to-r !from-orange-500 !to-pink-500 hover:!from-orange-600 hover:!to-pink-600 !border-0 !px-8"
                    icon={<IconCheckCircleStroked />}
                  >
                    {t('初始化系统')}
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </Layout.Content>
      </Layout>

      {/* 使用模式说明模态框 */}
      <Modal
        title={
          <div className="flex items-center">
            <IconInfoCircle className="mr-2 text-blue-500" />
            {t('使用模式说明')}
          </div>
        }
        visible={selfUseModeInfoVisible}
        onOk={() => setUsageModeInfoVisible(false)}
        onCancel={() => setUsageModeInfoVisible(false)}
        closeOnEsc={true}
        okText={t('我已了解')}
        cancelText={null}
        centered={true}
        size='medium'
        className="[&_.semi-modal-body]:!p-6"
      >
        <div className="space-y-6">
          {/* 对外运营模式 */}
          <div className="bg-blue-50 rounded-xl p-4">
            <div className="flex items-start">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mr-3 flex-shrink-0">
                <Rocket size={20} className="text-blue-600" />
              </div>
              <div>
                <Title heading={6} className="text-blue-900 mb-2">{t('对外运营模式')}</Title>
                <div className="space-y-2 text-sm text-gray-700">
                  <p>{t('默认模式，适用于为多个用户提供服务的场景。')}</p>
                  <p>{t('此模式下，系统将计算每次调用的用量，您需要对每个模型都设置价格，如果没有设置价格，用户将无法使用该模型。')}</p>
                  <div className="mt-3">
                    <Tag color='blue' shape='circle' className="mr-2">{t('计费模式')}</Tag>
                    <Tag color='blue' shape='circle'>{t('多用户支持')}</Tag>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 自用模式 */}
          <div className="bg-green-50 rounded-xl p-4">
            <div className="flex items-start">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mr-3 flex-shrink-0">
                <Shield size={20} className="text-green-600" />
              </div>
              <div>
                <Title heading={6} className="text-green-900 mb-2">{t('自用模式')}</Title>
                <div className="space-y-2 text-sm text-gray-700">
                  <p>{t('适用于个人使用的场景。')}</p>
                  <p>{t('不需要设置模型价格，系统将弱化用量计算，您可专注于使用模型。')}</p>
                  <div className="mt-3">
                    <Tag color='green' shape='circle' className="mr-2">{t('无需计费')}</Tag>
                    <Tag color='green' shape='circle'>{t('个人使用')}</Tag>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 演示站点模式 */}
          <div className="bg-purple-50 rounded-xl p-4">
            <div className="flex items-start">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center mr-3 flex-shrink-0">
                <FlaskConical size={20} className="text-purple-600" />
              </div>
              <div>
                <Title heading={6} className="text-purple-900 mb-2">{t('演示站点模式')}</Title>
                <div className="space-y-2 text-sm text-gray-700">
                  <p>{t('适用于展示系统功能的场景。')}</p>
                  <p>{t('提供基础功能演示，方便用户了解系统特性。')}</p>
                  <div className="mt-3">
                    <Tag color='purple' shape='circle' className="mr-2">{t('功能演示')}</Tag>
                    <Tag color='purple' shape='circle'>{t('体验试用')}</Tag>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Setup;
