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

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Form,
  Button,
  Switch,
  Row,
  Col,
  Typography,
} from '@douyinfe/semi-ui';
import { API, showSuccess, showError } from '../../../helpers';

const { Text } = Typography;

export default function SettingsSidebarModulesAdmin(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  
  // 左侧边栏模块管理状态（管理员全局控制）
  const [sidebarModulesAdmin, setSidebarModulesAdmin] = useState({
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
      redemption: true,
      user: {
        enabled: true,
        groupManagement: false // 默认关闭分组管理
      },
      setting: true
    }
  });

  // 处理区域级别开关变更
  function handleSectionChange(sectionKey) {
    return (checked) => {
      const newModules = {
        ...sidebarModulesAdmin,
        [sectionKey]: {
          ...sidebarModulesAdmin[sectionKey],
          enabled: checked,
        },
      };
      setSidebarModulesAdmin(newModules);
    };
  }

  // 处理功能级别开关变更
  function handleModuleChange(sectionKey, moduleKey) {
    return (checked) => {
      const newModules = {
        ...sidebarModulesAdmin,
        [sectionKey]: {
          ...sidebarModulesAdmin[sectionKey],
          [moduleKey]: checked
        }
      };
      setSidebarModulesAdmin(newModules);
    };
  }

  // 处理用户管理分组管理子开关变更
  function handleUserGroupManagementChange(checked) {
    const newModules = {
      ...sidebarModulesAdmin,
      admin: {
        ...sidebarModulesAdmin.admin,
        user: {
          ...sidebarModulesAdmin.admin.user,
          groupManagement: checked
        }
      }
    };
    setSidebarModulesAdmin(newModules);
  }

  // 重置为默认配置
  function resetSidebarModules() {
    const defaultModules = {
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
        redemption: true,
        user: {
          enabled: true,
          groupManagement: false // 默认关闭分组管理
        },
        setting: true
      }
    };
    setSidebarModulesAdmin(defaultModules);
    showSuccess(t('已重置为默认配置'));
  }

  // 保存配置
  async function onSubmit() {
    setLoading(true);
    try {
      const res = await API.put('/api/option/', {
        key: 'SidebarModulesAdmin',
        value: JSON.stringify(sidebarModulesAdmin),
      });
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('保存成功'));

        // 刷新父组件状态
        if (props.refresh) {
          await props.refresh();
        }

        // 触发全局侧边栏刷新事件，通知所有useSidebar实例更新
        // 使用全局事件目标（与useSidebar钩子中的一致）
        if (window.sidebarEventTarget) {
          window.sidebarEventTarget.dispatchEvent(new CustomEvent('sidebar-refresh'));
        }
      } else {
        showError(message);
      }
    } catch (error) {
      showError(t('保存失败，请重试'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // 从 props.options 中获取配置
    if (props.options && props.options.SidebarModulesAdmin) {
      try {
        const modules = JSON.parse(props.options.SidebarModulesAdmin);
        setSidebarModulesAdmin(modules);
      } catch (error) {
        // 使用默认配置
        const defaultModules = {
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
            redemption: true,
            user: {
              enabled: true,
              groupManagement: false // 默认关闭分组管理
            },
            setting: true
          }
        };
        setSidebarModulesAdmin(defaultModules);
      }
    }
  }, [props.options]);

  // 区域配置数据
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
    {
      key: 'admin',
      title: t('管理员区域'),
      description: t('系统管理功能'),
      modules: [
        { key: 'channel', title: t('渠道管理'), description: t('API渠道配置') },
        { key: 'models', title: t('模型管理'), description: t('AI模型配置') },
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
  ];

  return (
    <Card>
      <Form.Section
        text={t('侧边栏管理（全局控制）')}
        extraText={t(
          '全局控制侧边栏区域和功能显示，管理员隐藏的功能用户无法启用',
        )}
      >
        {sectionConfigs.map((section) => (
          <div key={section.key} style={{ marginBottom: '32px' }}>
            {/* 区域标题和总开关 */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
                padding: '12px 16px',
                backgroundColor: 'var(--semi-color-fill-0)',
                borderRadius: '8px',
                border: '1px solid var(--semi-color-border)',
              }}
            >
              <div>
                <div
                  style={{
                    fontWeight: '600',
                    fontSize: '16px',
                    color: 'var(--semi-color-text-0)',
                    marginBottom: '4px',
                  }}
                >
                  {section.title}
                </div>
                <Text
                  type='secondary'
                  size='small'
                  style={{
                    fontSize: '12px',
                    color: 'var(--semi-color-text-2)',
                    lineHeight: '1.4',
                  }}
                >
                  {section.description}
                </Text>
              </div>
              <Switch
                checked={sidebarModulesAdmin[section.key]?.enabled}
                onChange={handleSectionChange(section.key)}
                size='default'
              />
            </div>

            {/* 功能模块网格 */}
            <Row gutter={[16, 16]}>
              {section.modules.map((module) => (
                <Col key={module.key} xs={24} sm={12} md={8} lg={6} xl={6}>
                  <Card
                    bodyStyle={{ padding: '16px' }}
                    hoverable
                    style={{
                      opacity: sidebarModulesAdmin[section.key]?.enabled
                        ? 1
                        : 0.5,
                      transition: 'opacity 0.2s',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        height: '100%',
                      }}
                    >
                      <div style={{ flex: 1, textAlign: 'left' }}>
                        <div
                          style={{
                            fontWeight: '600',
                            fontSize: '14px',
                            color: 'var(--semi-color-text-0)',
                            marginBottom: '4px',
                          }}
                        >
                          {module.title}
                        </div>
                        <Text
                          type='secondary'
                          size='small'
                          style={{
                            fontSize: '12px',
                            color: 'var(--semi-color-text-2)',
                            lineHeight: '1.4',
                            display: 'block',
                          }}
                        >
                          {module.description}
                        </Text>
                      </div>
                      <div style={{ marginLeft: '16px' }}>
                        <Switch
                          checked={
                            module.key === 'user'
                              ? sidebarModulesAdmin[section.key]?.user?.enabled
                              : sidebarModulesAdmin[section.key]?.[module.key]
                          }
                          onChange={
                            module.key === 'user'
                              ? (checked) => {
                                  const newModules = {
                                    ...sidebarModulesAdmin,
                                    [section.key]: {
                                      ...sidebarModulesAdmin[section.key],
                                      user: {
                                        ...sidebarModulesAdmin[section.key].user,
                                        enabled: checked
                                      }
                                    }
                                  };
                                  setSidebarModulesAdmin(newModules);
                                }
                              : handleModuleChange(section.key, module.key)
                          }
                          size="default"
                          disabled={!sidebarModulesAdmin[section.key]?.enabled}
                        />
                      </div>
                    </div>

                    {/* 为用户管理添加分组管理子开关 */}
                    {module.key === 'user' && (
                      module.key === 'user'
                        ? sidebarModulesAdmin[section.key]?.user?.enabled
                        : sidebarModulesAdmin[section.key]?.[module.key]
                    ) && (
                      <div style={{
                        borderTop: '1px solid var(--semi-color-border)',
                        marginTop: '12px',
                        paddingTop: '12px'
                      }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <div style={{ flex: 1, textAlign: 'left' }}>
                            <div style={{
                              fontWeight: '500',
                              fontSize: '12px',
                              color: 'var(--semi-color-text-1)',
                              marginBottom: '2px'
                            }}>
                              {t('分组管理')}
                            </div>
                            <Text
                              type="secondary"
                              size="small"
                              style={{
                                fontSize: '11px',
                                color: 'var(--semi-color-text-2)',
                                lineHeight: '1.4',
                                display: 'block'
                              }}
                            >
                              {t('控制管理员是否可以访问分组管理功能')}
                            </Text>
                          </div>
                          <div style={{ marginLeft: '16px' }}>
                            <Switch
                              checked={sidebarModulesAdmin[section.key]?.user?.groupManagement || false}
                              onChange={handleUserGroupManagementChange}
                              size="small"
                              disabled={!sidebarModulesAdmin[section.key]?.enabled || !(
                                module.key === 'user'
                                  ? sidebarModulesAdmin[section.key]?.user?.enabled
                                  : sidebarModulesAdmin[section.key]?.[module.key]
                              )}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        ))}

        <div
          style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-start',
            alignItems: 'center',
            paddingTop: '8px',
            borderTop: '1px solid var(--semi-color-border)',
          }}
        >
          <Button
            size='default'
            type='tertiary'
            onClick={resetSidebarModules}
            style={{
              borderRadius: '6px',
              fontWeight: '500',
            }}
          >
            {t('重置为默认')}
          </Button>
          <Button
            size='default'
            type='primary'
            onClick={onSubmit}
            loading={loading}
            style={{
              borderRadius: '6px',
              fontWeight: '500',
              minWidth: '100px',
            }}
          >
            {t('保存设置')}
          </Button>
        </div>
      </Form.Section>
    </Card>
  );
}
