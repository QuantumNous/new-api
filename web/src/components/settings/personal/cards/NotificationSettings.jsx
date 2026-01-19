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

import React, { useRef, useEffect, useState, useContext } from 'react';
import {
  Button,
  Typography,
  Card,
  Avatar,
  Form,
  Radio,
  Toast,
  Tabs,
  TabPane,
  Switch,
  Row,
  Col,
} from '@douyinfe/semi-ui';
import { IconMail, IconKey, IconBell, IconLink } from '@douyinfe/semi-icons';
import { ShieldCheck, Bell, DollarSign, Settings } from 'lucide-react';
import {
  renderQuotaWithPrompt,
  API,
  showSuccess,
  showError,
} from '../../../../helpers';
import CodeViewer from '../../../playground/CodeViewer';
import { StatusContext } from '../../../../context/Status';
import { UserContext } from '../../../../context/User';
import { useUserPermissions } from '../../../../hooks/common/useUserPermissions';
import {
  mergeAdminConfig,
  useSidebar,
} from '../../../../hooks/common/useSidebar';

const NotificationSettings = ({
  t,
  notificationSettings,
  handleNotificationSettingChange,
  saveNotificationSettings,
}) => {
  const formApiRef = useRef(null);
  const [statusState] = useContext(StatusContext);
  const [userState] = useContext(UserContext);

  // 左侧边栏设置相关状态
  const [sidebarLoading, setSidebarLoading] = useState(false);
  const [activeTabKey, setActiveTabKey] = useState('notification');
  const [sidebarModulesUser, setSidebarModulesUser] = useState({
    chat: {
      enabled: true,
      playground: true,
      chat: true,
    },
    console: {
      enabled: true,
      detail: true,
      token: true,
      log: true,
      midjourney: true,
      task: true,
    },
    personal: {
      enabled: true,
      topup: true,
      personal: true,
    },
    admin: {
      enabled: true,
      channel: true,
      models: true,
      deployment: true,
      redemption: true,
      user: true,
      setting: true,
    },
  });
  const [adminConfig, setAdminConfig] = useState(null);

  // 使用后端权限验证替代前端角色判断
  const {
    permissions,
    loading: permissionsLoading,
    hasSidebarSettingsPermission,
    isSidebarSectionAllowed,
    isSidebarModuleAllowed,
  } = useUserPermissions();

  // 使用useSidebar钩子获取刷新方法
  const { refreshUserConfig } = useSidebar();

  // 左侧边栏设置处理函数
  const handleSectionChange = (sectionKey) => {
    return (checked) => {
      const newModules = {
        ...sidebarModulesUser,
        [sectionKey]: {
          ...sidebarModulesUser[sectionKey],
          enabled: checked,
        },
      };
      setSidebarModulesUser(newModules);
    };
  };

  const handleModuleChange = (sectionKey, moduleKey) => {
    return (checked) => {
      const newModules = {
        ...sidebarModulesUser,
        [sectionKey]: {
          ...sidebarModulesUser[sectionKey],
          [moduleKey]: checked,
        },
      };
      setSidebarModulesUser(newModules);
    };
  };

  const saveSidebarSettings = async () => {
    setSidebarLoading(true);
    try {
      const res = await API.put('/api/user/self', {
        sidebar_modules: JSON.stringify(sidebarModulesUser),
      });
      if (res.data.success) {
        showSuccess(t('侧边栏设置保存成功'));

        // 刷新useSidebar钩子中的用户配置，实现实时更新
        await refreshUserConfig();
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('保存失败'));
    }
    setSidebarLoading(false);
  };

  const resetSidebarModules = () => {
    const defaultConfig = {
      chat: { enabled: true, playground: true, chat: true },
      console: {
        enabled: true,
        detail: true,
        token: true,
        log: true,
        midjourney: true,
        task: true,
      },
      personal: { enabled: true, topup: true, personal: true },
      admin: {
        enabled: true,
        channel: true,
        models: true,
        deployment: true,
        redemption: true,
        user: true,
        setting: true,
      },
    };
    setSidebarModulesUser(defaultConfig);
  };

  // 加载左侧边栏配置
  useEffect(() => {
    const loadSidebarConfigs = async () => {
      try {
        // 获取管理员全局配置
        if (statusState?.status?.SidebarModulesAdmin) {
          try {
            const adminConf = JSON.parse(
              statusState.status.SidebarModulesAdmin,
            );
            setAdminConfig(mergeAdminConfig(adminConf));
          } catch (error) {
            setAdminConfig(mergeAdminConfig(null));
          }
        } else {
          setAdminConfig(mergeAdminConfig(null));
        }

        // 获取用户个人配置
        const userRes = await API.get('/api/user/self');
        if (userRes.data.success && userRes.data.data.sidebar_modules) {
          let userConf;
          if (typeof userRes.data.data.sidebar_modules === 'string') {
            userConf = JSON.parse(userRes.data.data.sidebar_modules);
          } else {
            userConf = userRes.data.data.sidebar_modules;
          }
          setSidebarModulesUser(userConf);
        }
      } catch (error) {
        console.error('加载边栏配置失败:', error);
      }
    };

    loadSidebarConfigs();
  }, [statusState]);

  // 初始化表单值
  useEffect(() => {
    if (formApiRef.current && notificationSettings) {
      formApiRef.current.setValues(notificationSettings);
    }
  }, [notificationSettings]);

  // 处理表单字段变化
  const handleFormChange = (field, value) => {
    handleNotificationSettingChange(field, value);
  };

  // 检查功能是否被管理员允许
  const isAllowedByAdmin = (sectionKey, moduleKey = null) => {
    if (!adminConfig) return true;

    if (moduleKey) {
      return (
        adminConfig[sectionKey]?.enabled && adminConfig[sectionKey]?.[moduleKey]
      );
    } else {
      return adminConfig[sectionKey]?.enabled;
    }
  };

  // 区域配置数据（根据权限过滤）
  const sectionConfigs = [
    {
      key: 'chat',
      title: t('聊天区域'),
      description: t('操练场和聊天功能'),
      modules: [
        {
          key: 'playground',
          title: t('操练场'),
          description: t('AI模型测试环境'),
        },
        { key: 'chat', title: t('聊天'), description: t('聊天会话管理') },
      ],
    },
    {
      key: 'console',
      title: t('控制台区域'),
      description: t('数据管理和日志查看'),
      modules: [
        { key: 'detail', title: t('数据看板'), description: t('系统数据统计') },
        { key: 'token', title: t('令牌管理'), description: t('API令牌管理') },
        { key: 'log', title: t('使用日志'), description: t('API使用记录') },
        {
          key: 'midjourney',
          title: t('绘图日志'),
          description: t('绘图任务记录'),
        },
        { key: 'task', title: t('任务日志'), description: t('系统任务记录') },
      ],
    },
    {
      key: 'personal',
      title: t('个人中心区域'),
      description: t('用户个人功能'),
      modules: [
        { key: 'topup', title: t('钱包管理'), description: t('余额充值管理') },
        {
          key: 'personal',
          title: t('个人设置'),
          description: t('个人信息设置'),
        },
      ],
    },
    // 管理员区域：根据后端权限控制显示
    {
      key: 'admin',
      title: t('管理员区域'),
      description: t('系统管理功能'),
      modules: [
        { key: 'channel', title: t('渠道管理'), description: t('API渠道配置') },
        { key: 'models', title: t('模型管理'), description: t('AI模型配置') },
        {
          key: 'deployment',
          title: t('模型部署'),
          description: t('模型部署管理'),
        },
        {
          key: 'redemption',
          title: t('兑换码管理'),
          description: t('兑换码生成管理'),
        },
        { key: 'user', title: t('用户管理'), description: t('用户账户管理') },
        {
          key: 'setting',
          title: t('系统设置'),
          description: t('系统参数配置'),
        },
      ],
    },
  ]
    .filter((section) => {
      // 使用后端权限验证替代前端角色判断
      return isSidebarSectionAllowed(section.key);
    })
    .map((section) => ({
      ...section,
      modules: section.modules.filter((module) =>
        isSidebarModuleAllowed(section.key, module.key),
      ),
    }))
    .filter(
      (section) =>
        // 过滤掉没有可用模块的区域
        section.modules.length > 0 && isAllowedByAdmin(section.key),
    );

  // 表单提交
  const handleSubmit = () => {
    if (formApiRef.current) {
      formApiRef.current
        .validate()
        .then(() => {
          saveNotificationSettings();
        })
        .catch((errors) => {
          console.log('表单验证失败:', errors);
          Toast.error(t('请检查表单填写是否正确'));
        });
    } else {
      saveNotificationSettings();
    }
  };

  return (
    <Card
      className='!rounded-2xl shadow-sm border-0'
      footer={
        <div className='flex justify-end gap-3'>
          {activeTabKey === 'sidebar' ? (
            // 边栏设置标签页的按钮
            <>
              <Button
                type='tertiary'
                onClick={resetSidebarModules}
                className='!rounded-lg'
              >
                {t('重置为默认')}
              </Button>
              <Button
                type='primary'
                onClick={saveSidebarSettings}
                loading={sidebarLoading}
                className='!rounded-lg'
              >
                {t('保存设置')}
              </Button>
            </>
          ) : (
            // 其他标签页的通用保存按钮
            <Button type='primary' onClick={handleSubmit}>
              {t('保存设置')}
            </Button>
          )}
        </div>
      }
    >
      {/* 卡片头部 */}
      <div className='flex items-center mb-4'>
        <Avatar size='small' color='blue' className='mr-3 shadow-md'>
          <Bell size={16} />
        </Avatar>
        <div>
          <Typography.Text className='text-lg font-medium'>
            {t('其他设置')}
          </Typography.Text>
          <div className='text-xs text-gray-600'>
            {t('通知、价格和隐私相关设置')}
          </div>
        </div>
      </div>

      <Form
        getFormApi={(api) => (formApiRef.current = api)}
        initValues={notificationSettings}
        onSubmit={handleSubmit}
      >
        {() => (
          <Tabs
            type='card'
            defaultActiveKey='notification'
            onChange={(key) => setActiveTabKey(key)}
          >
            {/* 通知配置 Tab */}
            <TabPane
              tab={
                <div className='flex items-center'>
                  <Bell size={16} className='mr-2' />
                  {t('通知配置')}
                </div>
              }
              itemKey='notification'
            >
              <div className='py-4'>
                <Form.RadioGroup
                  field='warningType'
                  label={t('通知方式')}
                  initValue={notificationSettings.warningType}
                  onChange={(value) => handleFormChange('warningType', value)}
                  rules={[{ required: true, message: t('请选择通知方式') }]}
                >
                  <Radio value='email'>{t('邮件通知')}</Radio>
                  <Radio value='webhook'>{t('Webhook通知')}</Radio>
                  <Radio value='bark'>{t('Bark通知')}</Radio>
                  <Radio value='gotify'>{t('Gotify通知')}</Radio>
                </Form.RadioGroup>

                <Form.AutoComplete
                  field='warningThreshold'
                  label={
                    <span>
                      {t('额度预警阈值')}{' '}
                      {renderQuotaWithPrompt(
                        notificationSettings.warningThreshold,
                      )}
                    </span>
                  }
                  placeholder={t('请输入预警额度')}
                  data={[
                    { value: 100000, label: '0.2$' },
                    { value: 500000, label: '1$' },
                    { value: 1000000, label: '2$' },
                    { value: 5000000, label: '10$' },
                  ]}
                  onChange={(val) => handleFormChange('warningThreshold', val)}
                  prefix={<IconBell />}
                  extraText={t(
                    '当剩余额度低于此数值时，系统将通过选择的方式发送通知',
                  )}
                  style={{ width: '100%', maxWidth: '300px' }}
                  rules={[
                    { required: true, message: t('请输入预警阈值') },
                    {
                      validator: (rule, value) => {
                        const numValue = Number(value);
                        if (isNaN(numValue) || numValue <= 0) {
                          return Promise.reject(t('预警阈值必须为正数'));
                        }
                        return Promise.resolve();
                      },
                    },
                  ]}
                />

                {/* 邮件通知设置 */}
                {notificationSettings.warningType === 'email' && (
                  <Form.Input
                    field='notificationEmail'
                    label={t('通知邮箱')}
                    placeholder={t('留空则使用账号绑定的邮箱')}
                    onChange={(val) =>
                      handleFormChange('notificationEmail', val)
                    }
                    prefix={<IconMail />}
                    extraText={t(
                      '设置用于接收额度预警的邮箱地址，不填则使用账号绑定的邮箱',
                    )}
                    showClear
                  />
                )}

                {/* Webhook通知设置 */}
                {notificationSettings.warningType === 'webhook' && (
                  <>
                    <Form.Input
                      field='webhookUrl'
                      label={t('Webhook地址')}
                      placeholder={t(
                        '请输入Webhook地址，例如: https://example.com/webhook',
                      )}
                      onChange={(val) => handleFormChange('webhookUrl', val)}
                      prefix={<IconLink />}
                      extraText={t(
                        '只支持HTTPS，系统将以POST方式发送通知，请确保地址可以接收POST请求',
                      )}
                      showClear
                      rules={[
                        {
                          required:
                            notificationSettings.warningType === 'webhook',
                          message: t('请输入Webhook地址'),
                        },
                        {
                          pattern: /^https:\/\/.+/,
                          message: t('Webhook地址必须以https://开头'),
                        },
                      ]}
                    />

                    <Form.Input
                      field='webhookSecret'
                      label={t('接口凭证')}
                      placeholder={t('请输入密钥')}
                      onChange={(val) => handleFormChange('webhookSecret', val)}
                      prefix={<IconKey />}
                      extraText={t(
                        '密钥将以Bearer方式添加到请求头中，用于验证webhook请求的合法性',
                      )}
                      showClear
                    />

                    <Form.Slot label={t('Webhook请求结构说明')}>
                      <div>
                        <div style={{ height: '200px', marginBottom: '12px' }}>
                          <CodeViewer
                            content={{
                              type: 'quota_exceed',
                              title: '额度预警通知',
                              content:
                                '您的额度即将用尽，当前剩余额度为 {{value}}',
                              values: ['$0.99'],
                              timestamp: 1739950503,
                            }}
                            title='webhook'
                            language='json'
                          />
                        </div>
                        <div className='text-xs text-gray-500 leading-relaxed'>
                          <div>
                            <strong>type:</strong>{' '}
                            {t('通知类型 (quota_exceed: 额度预警)')}{' '}
                          </div>
                          <div>
                            <strong>title:</strong> {t('通知标题')}
                          </div>
                          <div>
                            <strong>content:</strong>{' '}
                            {t('通知内容，支持 {{value}} 变量占位符')}
                          </div>
                          <div>
                            <strong>values:</strong>{' '}
                            {t('按顺序替换content中的变量占位符')}
                          </div>
                          <div>
                            <strong>timestamp:</strong> {t('Unix时间戳')}
                          </div>
                        </div>
                      </div>
                    </Form.Slot>
                  </>
                )}

                {/* Bark推送设置 */}
                {notificationSettings.warningType === 'bark' && (
                  <>
                    <Form.Input
                      field='barkUrl'
                      label={t('Bark推送URL')}
                      placeholder={t(
                        '请输入Bark推送URL，例如: https://api.day.app/yourkey/{{title}}/{{content}}',
                      )}
                      onChange={(val) => handleFormChange('barkUrl', val)}
                      prefix={<IconLink />}
                      extraText={t(
                        '支持HTTP和HTTPS，模板变量: {{title}} (通知标题), {{content}} (通知内容)',
                      )}
                      showClear
                      rules={[
                        {
                          required: notificationSettings.warningType === 'bark',
                          message: t('请输入Bark推送URL'),
                        },
                        {
                          pattern: /^https?:\/\/.+/,
                          message: t('Bark推送URL必须以http://或https://开头'),
                        },
                      ]}
                    />

                    <div className='mt-3 p-4 bg-gray-50/50 rounded-xl'>
                      <div className='text-sm text-gray-700 mb-3'>
                        <strong>{t('模板示例')}</strong>
                      </div>
                      <div className='text-xs text-gray-600 font-mono bg-white p-3 rounded-lg shadow-sm mb-4'>
                        https://api.day.app/yourkey/{'{{title}}'}/
                        {'{{content}}'}?sound=alarm&group=quota
                      </div>
                      <div className='text-xs text-gray-500 space-y-2'>
                        <div>
                          • <strong>{'title'}:</strong> {t('通知标题')}
                        </div>
                        <div>
                          • <strong>{'content'}:</strong> {t('通知内容')}
                        </div>
                        <div className='mt-3 pt-3 border-t border-gray-200'>
                          <span className='text-gray-400'>
                            {t('更多参数请参考')}
                          </span>{' '}
                          <a
                            href='https://github.com/Finb/Bark'
                            target='_blank'
                            rel='noopener noreferrer'
                            className='text-blue-500 hover:text-blue-600 font-medium'
                          >
                            Bark {t('官方文档')}
                          </a>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Gotify推送设置 */}
                {notificationSettings.warningType === 'gotify' && (
                  <>
                    <Form.Input
                      field='gotifyUrl'
                      label={t('Gotify服务器地址')}
                      placeholder={t(
                        '请输入Gotify服务器地址，例如: https://gotify.example.com',
                      )}
                      onChange={(val) => handleFormChange('gotifyUrl', val)}
                      prefix={<IconLink />}
                      extraText={t(
                        '支持HTTP和HTTPS，填写Gotify服务器的完整URL地址',
                      )}
                      showClear
                      rules={[
                        {
                          required:
                            notificationSettings.warningType === 'gotify',
                          message: t('请输入Gotify服务器地址'),
                        },
                        {
                          pattern: /^https?:\/\/.+/,
                          message: t(
                            'Gotify服务器地址必须以http://或https://开头',
                          ),
                        },
                      ]}
                    />

                    <Form.Input
                      field='gotifyToken'
                      label={t('Gotify应用令牌')}
                      placeholder={t('请输入Gotify应用令牌')}
                      onChange={(val) => handleFormChange('gotifyToken', val)}
                      prefix={<IconKey />}
                      extraText={t(
                        '在Gotify服务器创建应用后获得的令牌，用于发送通知',
                      )}
                      showClear
                      rules={[
                        {
                          required:
                            notificationSettings.warningType === 'gotify',
                          message: t('请输入Gotify应用令牌'),
                        },
                      ]}
                    />

                    <Form.AutoComplete
                      field='gotifyPriority'
                      label={t('消息优先级')}
                      placeholder={t('请选择消息优先级')}
                      data={[
                        { value: 0, label: t('0 - 最低') },
                        { value: 2, label: t('2 - 低') },
                        { value: 5, label: t('5 - 正常（默认）') },
                        { value: 8, label: t('8 - 高') },
                        { value: 10, label: t('10 - 最高') },
                      ]}
                      onChange={(val) =>
                        handleFormChange('gotifyPriority', val)
                      }
                      prefix={<IconBell />}
                      extraText={t('消息优先级，范围0-10，默认为5')}
                      style={{ width: '100%', maxWidth: '300px' }}
                    />

                    <div className='mt-3 p-4 bg-gray-50/50 rounded-xl'>
                      <div className='text-sm text-gray-700 mb-3'>
                        <strong>{t('配置说明')}</strong>
                      </div>
                      <div className='text-xs text-gray-500 space-y-2'>
                        <div>
                          1. {t('在Gotify服务器的应用管理中创建新应用')}
                        </div>
                        <div>
                          2.{' '}
                          {t(
                            '复制应用的令牌（Token）并填写到上方的应用令牌字段',
                          )}
                        </div>
                        <div>3. {t('填写Gotify服务器的完整URL地址')}</div>
                        <div className='mt-3 pt-3 border-t border-gray-200'>
                          <span className='text-gray-400'>
                            {t('更多信息请参考')}
                          </span>{' '}
                          <a
                            href='https://gotify.net/'
                            target='_blank'
                            rel='noopener noreferrer'
                            className='text-blue-500 hover:text-blue-600 font-medium'
                          >
                            Gotify {t('官方文档')}
                          </a>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </TabPane>

            {/* 价格设置 Tab */}
            <TabPane
              tab={
                <div className='flex items-center'>
                  <DollarSign size={16} className='mr-2' />
                  {t('价格设置')}
                </div>
              }
              itemKey='pricing'
            >
              <div className='py-4'>
                <Form.Switch
                  field='acceptUnsetModelRatioModel'
                  label={t('接受未设置价格模型')}
                  checkedText={t('开')}
                  uncheckedText={t('关')}
                  onChange={(value) =>
                    handleFormChange('acceptUnsetModelRatioModel', value)
                  }
                  extraText={t(
                    '当模型没有设置价格时仍接受调用，仅当您信任该网站时使用，可能会产生高额费用',
                  )}
                />
              </div>
            </TabPane>

            {/* 隐私设置 Tab */}
            <TabPane
              tab={
                <div className='flex items-center'>
                  <ShieldCheck size={16} className='mr-2' />
                  {t('隐私设置')}
                </div>
              }
              itemKey='privacy'
            >
              <div className='py-4'>
                <Form.Switch
                  field='recordIpLog'
                  label={t('记录请求与错误日志IP')}
                  checkedText={t('开')}
                  uncheckedText={t('关')}
                  onChange={(value) => handleFormChange('recordIpLog', value)}
                  extraText={t(
                    '开启后，仅"消费"和"错误"日志将记录您的客户端IP地址',
                  )}
                />
              </div>
            </TabPane>

            {/* 左侧边栏设置 Tab - 根据后端权限控制显示 */}
            {hasSidebarSettingsPermission() && (
              <TabPane
                tab={
                  <div className='flex items-center'>
                    <Settings size={16} className='mr-2' />
                    {t('边栏设置')}
                  </div>
                }
                itemKey='sidebar'
              >
                <div className='py-4'>
                  <div className='mb-4'>
                    <Typography.Text
                      type='secondary'
                      size='small'
                      style={{
                        fontSize: '12px',
                        lineHeight: '1.5',
                        color: 'var(--semi-color-text-2)',
                      }}
                    >
                      {t('您可以个性化设置侧边栏的要显示功能')}
                    </Typography.Text>
                  </div>
                  {/* 边栏设置功能区域容器 */}
                  <div
                    className='border rounded-xl p-4'
                    style={{
                      borderColor: 'var(--semi-color-border)',
                      backgroundColor: 'var(--semi-color-bg-1)',
                    }}
                  >
                    {sectionConfigs.map((section) => (
                      <div key={section.key} className='mb-6'>
                        {/* 区域标题和总开关 */}
                        <div
                          className='flex justify-between items-center mb-4 p-4 rounded-lg'
                          style={{
                            backgroundColor: 'var(--semi-color-fill-0)',
                            border: '1px solid var(--semi-color-border-light)',
                            borderColor: 'var(--semi-color-fill-1)',
                          }}
                        >
                          <div>
                            <div className='font-semibold text-base text-gray-900 mb-1'>
                              {section.title}
                            </div>
                            <Typography.Text
                              type='secondary'
                              size='small'
                              style={{
                                fontSize: '12px',
                                lineHeight: '1.5',
                                color: 'var(--semi-color-text-2)',
                              }}
                            >
                              {section.description}
                            </Typography.Text>
                          </div>
                          <Switch
                            checked={
                              sidebarModulesUser[section.key]?.enabled !== false
                            }
                            onChange={handleSectionChange(section.key)}
                            size='default'
                          />
                        </div>

                        {/* 功能模块网格 */}
                        <Row gutter={[12, 12]}>
                          {section.modules
                            .filter((module) =>
                              isAllowedByAdmin(section.key, module.key),
                            )
                            .map((module) => (
                              <Col
                                key={module.key}
                                xs={24}
                                sm={24}
                                md={12}
                                lg={8}
                                xl={8}
                              >
                                <Card
                                  className={`!rounded-xl border border-gray-200 hover:border-blue-300 transition-all duration-200 ${
                                    sidebarModulesUser[section.key]?.enabled !==
                                    false
                                      ? ''
                                      : 'opacity-50'
                                  }`}
                                  bodyStyle={{ padding: '16px' }}
                                  hoverable
                                >
                                  <div className='flex justify-between items-center h-full'>
                                    <div className='flex-1 text-left'>
                                      <div className='font-semibold text-sm text-gray-900 mb-1'>
                                        {module.title}
                                      </div>
                                      <Typography.Text
                                        type='secondary'
                                        size='small'
                                        className='block'
                                        style={{
                                          fontSize: '12px',
                                          lineHeight: '1.5',
                                          color: 'var(--semi-color-text-2)',
                                          marginTop: '4px',
                                        }}
                                      >
                                        {module.description}
                                      </Typography.Text>
                                    </div>
                                    <div className='ml-4'>
                                      <Switch
                                        checked={
                                          sidebarModulesUser[section.key]?.[
                                            module.key
                                          ] !== false
                                        }
                                        onChange={handleModuleChange(
                                          section.key,
                                          module.key,
                                        )}
                                        size='default'
                                        disabled={
                                          sidebarModulesUser[section.key]
                                            ?.enabled === false
                                        }
                                      />
                                    </div>
                                  </div>
                                </Card>
                              </Col>
                            ))}
                        </Row>
                      </div>
                    ))}
                  </div>{' '}
                  {/* 关闭边栏设置功能区域容器 */}
                </div>
              </TabPane>
            )}
          </Tabs>
        )}
      </Form>
    </Card>
  );
};

export default NotificationSettings;
