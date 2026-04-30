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

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, Tabs, TabPane, Popover, Checkbox, CheckboxGroup, Button } from '@douyinfe/semi-ui';
import { PieChart, Settings } from 'lucide-react';
import { VChart } from '@visactor/react-vchart';
import { ALL_CHART_TABS, CHART_TABS_NONE, STORAGE_KEYS } from '../../constants/dashboard.constants';

// 解析 data_dashboard_chart_tabs 的取值：
//   '' → null（未限制，调用方回退到"全部"）
//   '__none__' → []（管理员显式全部隐藏）
//   'k1,k2' → ['k1', 'k2']
const parseGlobalChartTabs = (value) => {
  if (value === CHART_TABS_NONE) return [];
  if (value) return value.split(',');
  return null;
};

const SPEC_MAP = {
  '1': 'spec_line',
  '2': 'spec_model_line',
  '3': 'spec_pie',
  '4': 'spec_rank_bar',
  '7': 'spec_token_bar',
  '5': 'spec_user_rank',
  '6': 'spec_user_trend',
  '8': 'spec_user_token_rank',
  '9': 'spec_user_token_trend',
};

const ChartsPanel = ({
  activeChartTab,
  setActiveChartTab,
  spec_line,
  spec_model_line,
  spec_pie,
  spec_rank_bar,
  spec_token_bar,
  spec_user_rank,
  spec_user_trend,
  spec_user_token_rank,
  spec_user_token_trend,
  isAdminUser,
  CARD_PROPS,
  CHART_CONFIG,
  FLEX_CENTER_GAP2,
  hasApiInfoPanel,
  t,
}) => {
  const specs = {
    spec_line,
    spec_model_line,
    spec_pie,
    spec_rank_bar,
    spec_token_bar,
    spec_user_rank,
    spec_user_trend,
    spec_user_token_rank,
    spec_user_token_trend,
  };

  // ========== Tab 可见性逻辑 ==========
  const [userTabs, setUserTabs] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CHART_TABS_USER);
    return saved ? saved.split(',') : null;
  });

  const visibleTabs = useMemo(() => {
    const globalSetting = localStorage.getItem(STORAGE_KEYS.CHART_TABS_GLOBAL) || '';
    const globalTabs = parseGlobalChartTabs(globalSetting);
    const enabledKeys = userTabs || globalTabs || ALL_CHART_TABS.map((tab) => tab.key);

    return ALL_CHART_TABS.filter((tab) => {
      if (tab.adminOnly && !isAdminUser) return false;
      return enabledKeys.includes(tab.key);
    });
  }, [userTabs, isAdminUser]);

  // 如果当前激活的 tab 不在可见列表里，自动切到第一个
  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.find((tab) => tab.key === activeChartTab)) {
      setActiveChartTab(visibleTabs[0].key);
    }
  }, [visibleTabs, activeChartTab, setActiveChartTab]);

  const handleUserTabsChange = useCallback((checkedValues) => {
    if (checkedValues.length === 0) return;
    setUserTabs(checkedValues);
    localStorage.setItem(STORAGE_KEYS.CHART_TABS_USER, checkedValues.join(','));
  }, []);

  const handleResetUserTabs = useCallback(() => {
    setUserTabs(null);
    localStorage.removeItem(STORAGE_KEYS.CHART_TABS_USER);
  }, []);

  // 用户偏好设置的可选项（受管理员全局设置和权限限制）
  const availableTabs = useMemo(() => {
    const globalSetting = localStorage.getItem(STORAGE_KEYS.CHART_TABS_GLOBAL) || '';
    const globalTabs = parseGlobalChartTabs(globalSetting);

    return ALL_CHART_TABS.filter((tab) => {
      if (tab.adminOnly && !isAdminUser) return false;
      if (globalTabs && !globalTabs.includes(tab.key)) return false;
      return true;
    });
  }, [isAdminUser]);

  const checkedUserTabs = userTabs || visibleTabs.map((tab) => tab.key);

  return (
    <Card
      {...CARD_PROPS}
      className={`!rounded-2xl ${hasApiInfoPanel ? 'lg:col-span-3' : ''}`}
      title={
        <div className='flex flex-col lg:flex-row lg:items-center lg:justify-between w-full gap-3'>
          <div className={FLEX_CENTER_GAP2}>
            <PieChart size={16} />
            {t('模型数据分析')}
            <Popover
              content={
                <div className='p-3' style={{ maxWidth: 320 }}>
                  <div className='text-sm font-medium mb-2'>{t('图表显示设置')}</div>
                  <CheckboxGroup
                    direction='vertical'
                    value={checkedUserTabs}
                    onChange={handleUserTabsChange}
                  >
                    {availableTabs.map((tab) => (
                      <Checkbox key={tab.key} value={tab.key}>
                        {t(tab.label)}
                      </Checkbox>
                    ))}
                  </CheckboxGroup>
                  {userTabs && (
                    <Button
                      size='small'
                      type='tertiary'
                      className='mt-2'
                      onClick={handleResetUserTabs}
                    >
                      {t('重置为默认')}
                    </Button>
                  )}
                </div>
              }
              trigger='click'
              position='bottomLeft'
            >
              <Button
                icon={<Settings size={14} />}
                size='small'
                type='tertiary'
                theme='borderless'
                aria-label={t('图表显示设置')}
                className='text-gray-400 hover:text-gray-600'
              />
            </Popover>
          </div>
          <Tabs
            type='slash'
            activeKey={activeChartTab}
            onChange={setActiveChartTab}
          >
            {visibleTabs.map((tab) => (
              <TabPane
                key={tab.key}
                tab={<span>{t(tab.label)}</span>}
                itemKey={tab.key}
              />
            ))}
          </Tabs>
        </div>
      }
      bodyStyle={{ padding: 0 }}
    >
      <div className='h-96 p-2'>
        {visibleTabs.map((tab) => {
          if (activeChartTab !== tab.key) return null;
          const specKey = SPEC_MAP[tab.key];
          return (
            <VChart key={tab.key} spec={specs[specKey]} option={CHART_CONFIG} />
          );
        })}
      </div>
    </Card>
  );
};

export default ChartsPanel;
