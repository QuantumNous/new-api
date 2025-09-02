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
  Button,
  Switch,
  Typography,
  Row,
  Col,
  Avatar,
} from '@douyinfe/semi-ui';
import { API, showSuccess, showError } from '../../../helpers';

import { useUserPermissions } from '../../../hooks/common/useUserPermissions';
import { useSidebar } from '../../../hooks/common/useSidebar';
import { Settings } from 'lucide-react';

const { Text } = Typography;

export default function SettingsSidebarModulesUser() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  // 用户个人左侧边栏模块设置
   const [sidebarModulesUser, setSidebarModulesUser] = useState({});
   // 管理员全局配置
   const [adminConfig, setAdminConfig] = useState(null);
   const [configLoading, setConfigLoading] = useState(true);

  // 使用后端权限验证替代前端角色判断
  const {
    loading: permissionsLoading,
    hasSidebarSettingsPermission,
  } = useUserPermissions();

  // 使用useSidebar钩子获取刷新方法
  const { refreshUserConfig } = useSidebar();

  // 如果没有边栏设置权限，不显示此组件
  if (!permissionsLoading && !hasSidebarSettingsPermission()) {
    return null;
  }

  // 如果配置还在加载中，显示加载状态
  if (configLoading || permissionsLoading) {
    return (
      <Card className='!rounded-2xl shadow-sm border-0'>
        <div className='flex items-center justify-center py-8'>
          <div className='text-gray-500'>{t('加载中...')}</div>
        </div>
      </Card>
    );
  }

  // // 权限加载中，显示加载状态
  // if (permissionsLoading) {
  //   return null;
  // }

  // 获取默认系统配置
  const getDefaultSystemConfig = () => {
    return {
      chat: {
        enabled: true,
        playground: true,
        chat: true
      },
      console: {
        enabled: true,
        detail: true,
        token: true,
        log: true,
        midjourney: true,
        task: true
      },
      personal: {
        enabled: true,
        topup: true,
        personal: true
      },
      admin: {
        enabled: true,
        channel: true,
        models: true,
        redemption: true,
        user: {
          enabled: true,
          groupManagement: true
        },
        setting: true
      }
    };
  };

  // 合并用户配置与系统配置，确保显示所有系统允许的区域
  const mergeUserConfigWithSystemConfig = (userConfig, systemConfig) => {
    const mergedConfig = {};

    // 遍历系统配置的所有区域
    Object.keys(systemConfig).forEach(sectionKey => {
      const systemSection = systemConfig[sectionKey];
      if (systemSection && systemSection.enabled) {
        // 获取用户对这个区域的配置，如果没有则使用默认值
        const userSection = userConfig[sectionKey] || {};

        mergedConfig[sectionKey] = {
          enabled: userSection.enabled !== undefined ? userSection.enabled : true
        };

        // 遍历区域内的模块
        Object.keys(systemSection).forEach(moduleKey => {
          if (moduleKey !== 'enabled') {
            const systemModuleValue = systemSection[moduleKey];

            // 处理布尔值和嵌套对象两种情况
            if (typeof systemModuleValue === 'boolean' && systemModuleValue === true) {
              mergedConfig[sectionKey][moduleKey] = userSection[moduleKey] !== undefined ? userSection[moduleKey] : true;
            } else if (typeof systemModuleValue === 'object' && systemModuleValue !== null && systemModuleValue.enabled === true) {
              // 对于嵌套对象，在个人设置中只关心enabled状态，不处理子功能
              let userEnabled = systemModuleValue.enabled; // 使用系统默认值

              if (userSection[moduleKey] !== undefined) {
                if (typeof userSection[moduleKey] === 'boolean') {
                  // 如果用户配置是布尔值，直接使用
                  userEnabled = userSection[moduleKey];
                } else if (typeof userSection[moduleKey] === 'object' && userSection[moduleKey] !== null) {
                  // 如果用户配置是对象，提取enabled状态
                  userEnabled = userSection[moduleKey].enabled !== false;
                }
              }

              // 在个人设置中，只保存enabled状态，不保存子功能配置
              mergedConfig[sectionKey][moduleKey] = userEnabled;
            }
          }
        });
      }
    });

    return mergedConfig;
  };

  // 根据系统允许的权限范围生成默认配置
  const generateDefaultConfig = (systemConfig = null) => {
    const defaultConfig = {};
    const configToUse = systemConfig || adminConfig;

    // 基于系统配置生成默认配置
    if (configToUse) {
      Object.keys(configToUse).forEach(sectionKey => {
        const section = configToUse[sectionKey];
        if (section && section.enabled) {
          defaultConfig[sectionKey] = { enabled: true };

          // 为每个系统允许的模块设置默认值为true
          Object.keys(section).forEach(moduleKey => {
            if (moduleKey !== 'enabled') {
              const moduleValue = section[moduleKey];

              // 处理布尔值和嵌套对象两种情况
              if (typeof moduleValue === 'boolean' && moduleValue === true) {
                defaultConfig[sectionKey][moduleKey] = true;
              } else if (typeof moduleValue === 'object' && moduleValue !== null && moduleValue.enabled === true) {
                // 对于嵌套对象，在个人设置中只关心enabled状态，默认为true
                defaultConfig[sectionKey][moduleKey] = true;
              }
            }
          });
        }
      });
    }

    return defaultConfig;
  };

  // // 用户个人左侧边栏模块设置
  // const [sidebarModulesUser, setSidebarModulesUser] = useState({});

  // // 管理员全局配置
  // const [adminConfig, setAdminConfig] = useState(null);
  // const [configLoading, setConfigLoading] = useState(true);

  // 处理区域级别开关变更
  function handleSectionChange(sectionKey) {
    return (checked) => {
      const newModules = {
        ...sidebarModulesUser,
        [sectionKey]: {
          ...sidebarModulesUser[sectionKey],
          enabled: checked,
        },
      };
      setSidebarModulesUser(newModules);
      console.log('用户边栏区域配置变更:', sectionKey, checked, newModules);
    };
  }

  // 处理功能级别开关变更
  function handleModuleChange(sectionKey, moduleKey) {
    return (checked) => {
      // 在个人设置中，所有模块都使用简单布尔值，不处理嵌套对象的子功能
      const newModules = {
        ...sidebarModulesUser,
        [sectionKey]: {
          ...sidebarModulesUser[sectionKey],
          [moduleKey]: checked
        }
      };
      setSidebarModulesUser(newModules);
      console.log(
        '用户边栏功能配置变更:',
        sectionKey,
        moduleKey,
        checked,
        newModules,
      );
    };
  }

  // 重置为默认配置（基于权限过滤）
  function resetSidebarModules() {
    const defaultConfig = generateDefaultConfig();
    setSidebarModulesUser(defaultConfig);
    showSuccess(t('已重置为默认配置'));
    console.log('用户边栏配置重置为默认:', defaultConfig);
  }

  // 保存配置
  async function onSubmit() {
    setLoading(true);
    try {
      console.log('保存用户边栏配置:', sidebarModulesUser);
      const res = await API.put('/api/user/self', {
        sidebar_modules: JSON.stringify(sidebarModulesUser),
      });
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('保存成功'));
        console.log('用户边栏配置保存成功');

        // 刷新useSidebar钩子中的用户配置，实现实时更新
        await refreshUserConfig();
        console.log('用户边栏配置已刷新，边栏将立即更新');
      } else {
        showError(message);
        console.error('用户边栏配置保存失败:', message);
      }
    } catch (error) {
      showError(t('保存失败，请重试'));
      console.error('用户边栏配置保存异常:', error);
    } finally {
      setLoading(false);
    }
  }

  // 统一的配置加载逻辑
  useEffect(() => {
    const loadConfigs = async () => {
      try {
        setConfigLoading(true);
        // 获取用户信息和设置
        const userRes = await API.get('/api/user/self');
        if (userRes.data.success && userRes.data.data.setting) {
          // 从setting字段中获取系统权限信息
          try {
            const setting = JSON.parse(userRes.data.data.setting);
            if (setting.sidebar_system_config) {
              const systemConfig = JSON.parse(setting.sidebar_system_config);
              setAdminConfig(systemConfig);
            } else {
              // 如果没有系统配置，使用默认配置
              setAdminConfig(getDefaultSystemConfig());
              console.log('使用默认系统配置');
            }
          } catch (error) {
            console.error('解析系统配置失败:', error);
            setAdminConfig(getDefaultSystemConfig());
          }

          // 从同一个setting字段中获取用户的原始偏好设置
          try {
            const setting = JSON.parse(userRes.data.data.setting);
            const systemConfig = setting.sidebar_system_config ? JSON.parse(setting.sidebar_system_config) : getDefaultSystemConfig();

            if (setting.sidebar_modules) {
              let userConf;
              if (typeof setting.sidebar_modules === 'string') {
                userConf = JSON.parse(setting.sidebar_modules);
              } else {
                userConf = setting.sidebar_modules;
              }

              // 确保用户配置包含所有系统允许的区域，即使用户关闭了它们
              const mergedConfig = mergeUserConfigWithSystemConfig(userConf, systemConfig);
              setSidebarModulesUser(mergedConfig);
            } else {
              const defaultConfig = generateDefaultConfig(systemConfig);
              setSidebarModulesUser(defaultConfig);
            }
          } catch (error) {
            console.error('解析用户设置失败:', error);
            const defaultConfig = generateDefaultConfig();
            setSidebarModulesUser(defaultConfig);
          }
        } else {
          // 如果没有setting数据，使用默认配置
          const defaultSystemConfig = getDefaultSystemConfig();
          setAdminConfig(defaultSystemConfig);
          const defaultConfig = generateDefaultConfig(defaultSystemConfig);
          setSidebarModulesUser(defaultConfig);
        }
      } catch (error) {
        console.error('加载边栏配置失败:', error);
        // 出错时设置空配置
        setAdminConfig({});
        setSidebarModulesUser({});
      } finally {
        setConfigLoading(false);
      }
    };

    // 只有权限加载完成且有边栏设置权限时才加载配置
    if (!permissionsLoading && hasSidebarSettingsPermission()) {
      loadConfigs();
    }
  }, [permissionsLoading, hasSidebarSettingsPermission]);

  // 区域配置数据（根据后端权限过滤）
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
        { key: 'setting', title: t('系统设置'), description: t('系统参数配置') }
      ]
    }
  ].filter(section => {
    // 仅显示系统启用的区域
    const sec = adminConfig?.[section.key];
    const systemAllowed = !!sec && sec.enabled === true;
    console.log(`区域 ${section.key} 系统是否允许:`, systemAllowed, 'adminConfig:', adminConfig);
    return systemAllowed;
  }).map(section => ({
    ...section,
    modules: section.modules.filter(module => {
      // 仅显示系统启用的模块（布尔true或对象enabled为true）
      const sysVal = adminConfig?.[section.key]?.[module.key];
      const allowed = typeof sysVal === 'boolean' ? sysVal === true : sysVal?.enabled === true;
      console.log(`模块 ${section.key}.${module.key} 系统是否允许:`, allowed);
      return allowed;
    })
  })).filter(section => {
    // 过滤掉没有可用模块的区域
    const hasModules = section.modules.length > 0;
    console.log(`区域 ${section.key} 是否有可用模块:`, hasModules, '模块数量:', section.modules.length);
    return hasModules;
  });

  return (
    <Card className='!rounded-2xl shadow-sm border-0'>
      {/* 卡片头部 */}
      <div className='flex items-center mb-4'>
        <Avatar size='small' color='purple' className='mr-3 shadow-md'>
          <Settings size={16} />
        </Avatar>
        <div>
          <Typography.Text className='text-lg font-medium'>
            {t('左侧边栏个人设置')}
          </Typography.Text>
          <div className='text-xs text-gray-600'>
            {t('个性化设置左侧边栏的显示内容')}
          </div>
        </div>
      </div>

      <div className='mb-4'>
        <Text type='secondary' className='text-sm text-gray-600'>
          {t('您可以个性化设置侧边栏的要显示功能')}
        </Text>
      </div>

      {sectionConfigs.map((section) => (
        <div key={section.key} className='mb-6'>
          {/* 区域标题和总开关 */}
          <div className='flex justify-between items-center mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200'>
            <div>
              <div className='font-semibold text-base text-gray-900 mb-1'>
                {section.title}
              </div>
              <Text className='text-xs text-gray-600'>
                {section.description}
              </Text>
            </div>
            <Switch
              checked={sidebarModulesUser[section.key]?.enabled}
              onChange={handleSectionChange(section.key)}
              size='default'
            />
          </div>

            {/* 功能模块网格 */}
            <Row gutter={[12, 12]}>
              {section.modules.map((module) => (
                <Col key={module.key} xs={24} sm={12} md={8} lg={6} xl={6}>
                  <Card
                    className={`!rounded-xl border border-gray-200 hover:border-blue-300 transition-all duration-200 ${
                      sidebarModulesUser[section.key]?.enabled ? '' : 'opacity-50'
                    }`}
                    bodyStyle={{ padding: '16px' }}
                    hoverable
                  >
                    <div className='flex justify-between items-center h-full'>
                      <div className='flex-1 text-left'>
                        <div className='font-semibold text-sm text-gray-900 mb-1'>
                          {module.title}
                        </div>
                        <Text className='text-xs text-gray-600 leading-relaxed block'>
                          {module.description}
                        </Text>
                      </div>
                      <div className='ml-4'>
                        <Switch
                          checked={sidebarModulesUser[section.key]?.[module.key] === true}
                          onChange={handleModuleChange(section.key, module.key)}
                          size="default"
                          disabled={!sidebarModulesUser[section.key]?.enabled}
                        />
                      </div>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        ))}

      {/* 底部按钮 */}
      <div className='flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200'>
        <Button
          type='tertiary'
          onClick={resetSidebarModules}
          className='!rounded-lg'
        >
          {t('重置为默认')}
        </Button>
        <Button
          type='primary'
          onClick={onSubmit}
          loading={loading}
          className='!rounded-lg'
        >
          {t('保存设置')}
        </Button>
      </div>
    </Card>
  );
}
