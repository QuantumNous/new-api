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

import React, { useState, useEffect, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Button, Switch } from '@heroui/react';
import { API, showSuccess, showError } from '../../../helpers';
import { StatusContext } from '../../../context/Status';

const DEFAULT_SIDEBAR_MODULES = {
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
    subscription: true,
    setting: true,
  },
};

function ToggleSwitch({ isSelected, onValueChange, ariaLabel, isDisabled }) {
  return (
    <Switch
      isSelected={!!isSelected}
      onChange={onValueChange}
      aria-label={ariaLabel}
      isDisabled={isDisabled}
      size='sm'
    >
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
    </Switch>
  );
}

export default function SettingsSidebarModulesAdmin(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [statusState, statusDispatch] = useContext(StatusContext);
  const [sidebarModulesAdmin, setSidebarModulesAdmin] = useState(
    DEFAULT_SIDEBAR_MODULES,
  );

  const handleSectionChange = (sectionKey) => (checked) => {
    setSidebarModulesAdmin((prev) => ({
      ...prev,
      [sectionKey]: { ...prev[sectionKey], enabled: checked },
    }));
  };

  const handleModuleChange = (sectionKey, moduleKey) => (checked) => {
    setSidebarModulesAdmin((prev) => ({
      ...prev,
      [sectionKey]: { ...prev[sectionKey], [moduleKey]: checked },
    }));
  };

  const resetSidebarModules = () => {
    setSidebarModulesAdmin(DEFAULT_SIDEBAR_MODULES);
    showSuccess(t('已重置为默认配置'));
  };

  const onSubmit = async () => {
    setLoading(true);
    try {
      const res = await API.put('/api/option/', {
        key: 'SidebarModulesAdmin',
        value: JSON.stringify(sidebarModulesAdmin),
      });
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('保存成功'));
        statusDispatch({
          type: 'set',
          payload: {
            ...statusState.status,
            SidebarModulesAdmin: JSON.stringify(sidebarModulesAdmin),
          },
        });
        if (props.refresh) await props.refresh();
      } else {
        showError(message);
      }
    } catch (error) {
      showError(t('保存失败，请重试'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (props.options && props.options.SidebarModulesAdmin) {
      try {
        const modules = JSON.parse(props.options.SidebarModulesAdmin);
        setSidebarModulesAdmin({ ...DEFAULT_SIDEBAR_MODULES, ...modules });
      } catch (error) {
        setSidebarModulesAdmin(DEFAULT_SIDEBAR_MODULES);
      }
    }
  }, [props.options]);

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
          key: 'deployment',
          title: t('模型部署'),
          description: t('模型部署管理'),
        },
        {
          key: 'subscription',
          title: t('订阅管理'),
          description: t('订阅套餐管理'),
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
  ];

  return (
    <Card className='!rounded-2xl shadow-sm border-0'>
      <Card.Content className='p-6 space-y-6'>
        <div>
          <div className='text-base font-semibold text-foreground'>
            {t('侧边栏管理（全局控制）')}
          </div>
          <div className='mt-1 text-xs text-muted'>
            {t(
              '全局控制侧边栏区域和功能显示，管理员隐藏的功能用户无法启用',
            )}
          </div>
        </div>

        {sectionConfigs.map((section) => {
          const sectionEnabled =
            !!sidebarModulesAdmin[section.key]?.enabled;
          return (
            <div key={section.key} className='space-y-3'>
              <div className='flex items-start justify-between gap-3 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-4 py-3'>
                <div className='min-w-0 flex-1'>
                  <div className='text-sm font-semibold text-foreground'>
                    {section.title}
                  </div>
                  <div className='mt-1 text-xs leading-snug text-muted'>
                    {section.description}
                  </div>
                </div>
                <ToggleSwitch
                  isSelected={sectionEnabled}
                  onValueChange={handleSectionChange(section.key)}
                  ariaLabel={section.title}
                />
              </div>

              <div
                className={`grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 transition-opacity ${
                  sectionEnabled ? 'opacity-100' : 'opacity-50'
                }`}
              >
                {section.modules.map((module) => (
                  <div
                    key={module.key}
                    className='flex items-start justify-between gap-3 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-background)] p-4 transition-colors hover:border-primary/40'
                  >
                    <div className='min-w-0 flex-1'>
                      <div className='text-sm font-semibold text-foreground'>
                        {module.title}
                      </div>
                      <div className='mt-1 text-xs leading-snug text-muted'>
                        {module.description}
                      </div>
                    </div>
                    <ToggleSwitch
                      isSelected={
                        !!sidebarModulesAdmin[section.key]?.[module.key]
                      }
                      onValueChange={handleModuleChange(
                        section.key,
                        module.key,
                      )}
                      ariaLabel={module.title}
                      isDisabled={!sectionEnabled}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <div className='flex items-center gap-3 border-t border-[color:var(--app-border)] pt-4'>
          <Button variant='flat' size='md' onPress={resetSidebarModules}>
            {t('重置为默认')}
          </Button>
          <Button
            color='primary'
            size='md'
            onPress={onSubmit}
            isPending={loading}
            className='min-w-[100px]'
          >
            {t('保存设置')}
          </Button>
        </div>
      </Card.Content>
    </Card>
  );
}
