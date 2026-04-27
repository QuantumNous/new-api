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

import React, { useEffect, useState, useContext } from 'react';
import { Button, Card, Switch } from '@heroui/react';
import { API, showError, showSuccess } from '../../../helpers';
import { useTranslation } from 'react-i18next';
import { StatusContext } from '../../../context/Status';

const DEFAULT_MODULES = {
  home: true,
  console: true,
  pricing: { enabled: true, requireAuth: false },
  docs: true,
  about: true,
};

// HeroUI v3 Switch is a compound component; this helper centralizes the
// anatomy so individual call sites stay readable.
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

export default function SettingsHeaderNavModules(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [statusState, statusDispatch] = useContext(StatusContext);
  const [headerNavModules, setHeaderNavModules] = useState(DEFAULT_MODULES);

  const handleHeaderNavModuleChange = (moduleKey) => (checked) => {
    setHeaderNavModules((prev) => {
      const next = { ...prev };
      if (moduleKey === 'pricing') {
        next.pricing = { ...prev.pricing, enabled: checked };
      } else {
        next[moduleKey] = checked;
      }
      return next;
    });
  };

  const handlePricingAuthChange = (checked) => {
    setHeaderNavModules((prev) => ({
      ...prev,
      pricing: { ...prev.pricing, requireAuth: checked },
    }));
  };

  const resetHeaderNavModules = () => {
    setHeaderNavModules(DEFAULT_MODULES);
    showSuccess(t('已重置为默认配置'));
  };

  const onSubmit = async () => {
    setLoading(true);
    try {
      const res = await API.put('/api/option/', {
        key: 'HeaderNavModules',
        value: JSON.stringify(headerNavModules),
      });
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('保存成功'));
        statusDispatch({
          type: 'set',
          payload: {
            ...statusState.status,
            HeaderNavModules: JSON.stringify(headerNavModules),
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
    if (props.options && props.options.HeaderNavModules) {
      try {
        const modules = JSON.parse(props.options.HeaderNavModules);
        if (typeof modules.pricing === 'boolean') {
          modules.pricing = { enabled: modules.pricing, requireAuth: false };
        }
        setHeaderNavModules({ ...DEFAULT_MODULES, ...modules });
      } catch (error) {
        setHeaderNavModules(DEFAULT_MODULES);
      }
    }
  }, [props.options]);

  const moduleConfigs = [
    { key: 'home', title: t('首页'), description: t('用户主页，展示系统信息') },
    {
      key: 'console',
      title: t('控制台'),
      description: t('用户控制面板，管理账户'),
    },
    {
      key: 'pricing',
      title: t('模型广场'),
      description: t('模型定价，需要登录访问'),
      hasSubConfig: true,
    },
    { key: 'docs', title: t('文档'), description: t('系统文档和帮助信息') },
    { key: 'about', title: t('关于'), description: t('关于系统的详细信息') },
  ];

  const isEnabled = (key) =>
    key === 'pricing' ? !!headerNavModules.pricing?.enabled : !!headerNavModules[key];

  return (
    <Card className='!rounded-2xl shadow-sm border-0'>
      <Card.Content className='p-6 space-y-6'>
        <div>
          <div className='text-base font-semibold text-foreground'>
            {t('顶栏管理')}
          </div>
          <div className='mt-1 text-xs text-muted'>
            {t('控制顶栏模块显示状态，全局生效')}
          </div>
        </div>

        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4'>
          {moduleConfigs.map((module) => (
            <div
              key={module.key}
              className='flex flex-col rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-background)] p-4 transition-colors hover:border-primary/40'
            >
              <div className='flex items-start justify-between gap-3'>
                <div className='min-w-0 flex-1'>
                  <div className='text-sm font-semibold text-foreground'>
                    {module.title}
                  </div>
                  <div className='mt-1 text-xs leading-snug text-muted'>
                    {module.description}
                  </div>
                </div>
                <ToggleSwitch
                  isSelected={isEnabled(module.key)}
                  onValueChange={handleHeaderNavModuleChange(module.key)}
                  ariaLabel={module.title}
                />
              </div>

              {module.key === 'pricing' && isEnabled('pricing') && (
                <div className='mt-3 border-t border-[color:var(--app-border)] pt-3'>
                  <div className='flex items-start justify-between gap-3'>
                    <div className='min-w-0 flex-1'>
                      <div className='text-xs font-medium text-muted'>
                        {t('需要登录访问')}
                      </div>
                      <div className='mt-0.5 text-[11px] leading-snug text-muted'>
                        {t('开启后未登录用户无法访问模型广场')}
                      </div>
                    </div>
                    <ToggleSwitch
                      isSelected={!!headerNavModules.pricing?.requireAuth}
                      onValueChange={handlePricingAuthChange}
                      ariaLabel={t('需要登录访问')}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className='flex items-center gap-3 border-t border-[color:var(--app-border)] pt-4'>
          <Button variant='tertiary' size='md' onPress={resetHeaderNavModules}>
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
