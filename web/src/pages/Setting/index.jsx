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

import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ToggleButton, ToggleButtonGroup } from '@heroui/react';
import {
  Settings,
  Calculator,
  Gauge,
  Shapes,
  Cog,
  MoreHorizontal,
  LayoutDashboard,
  MessageSquare,
  Palette,
  CreditCard,
  Server,
  Activity,
} from 'lucide-react';

import SystemSetting from '../../components/settings/SystemSetting';
import { isRoot } from '../../helpers';
import OtherSetting from '../../components/settings/OtherSetting';
import OperationSetting from '../../components/settings/OperationSetting';
import RateLimitSetting from '../../components/settings/RateLimitSetting';
import ModelSetting from '../../components/settings/ModelSetting';
import DashboardSetting from '../../components/settings/DashboardSetting';
import RatioSetting from '../../components/settings/RatioSetting';
import ChatsSetting from '../../components/settings/ChatsSetting';
import DrawingSetting from '../../components/settings/DrawingSetting';
import PaymentSetting from '../../components/settings/PaymentSetting';
import ModelDeploymentSetting from '../../components/settings/ModelDeploymentSetting';
import PerformanceSetting from '../../components/settings/PerformanceSetting';

const Setting = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [tabActiveKey, setTabActiveKey] = useState('operation');
  let panes = [];

  if (isRoot()) {
    panes.push({
      icon: <Settings size={14} />,
      label: t('运营设置'),
      content: <OperationSetting />,
      itemKey: 'operation',
    });
    panes.push({
      icon: <LayoutDashboard size={14} />,
      label: t('仪表盘设置'),
      content: <DashboardSetting />,
      itemKey: 'dashboard',
    });
    panes.push({
      icon: <MessageSquare size={14} />,
      label: t('聊天设置'),
      content: <ChatsSetting />,
      itemKey: 'chats',
    });
    panes.push({
      icon: <Palette size={14} />,
      label: t('绘图设置'),
      content: <DrawingSetting />,
      itemKey: 'drawing',
    });
    panes.push({
      icon: <CreditCard size={14} />,
      label: t('支付设置'),
      content: <PaymentSetting />,
      itemKey: 'payment',
    });
    panes.push({
      icon: <Calculator size={14} />,
      label: t('分组与模型定价设置'),
      content: <RatioSetting />,
      itemKey: 'ratio',
    });
    panes.push({
      icon: <Gauge size={14} />,
      label: t('速率限制设置'),
      content: <RateLimitSetting />,
      itemKey: 'ratelimit',
    });
    panes.push({
      icon: <Shapes size={14} />,
      label: t('模型相关设置'),
      content: <ModelSetting />,
      itemKey: 'models',
    });
    panes.push({
      icon: <Server size={14} />,
      label: t('模型部署设置'),
      content: <ModelDeploymentSetting />,
      itemKey: 'model-deployment',
    });
    panes.push({
      icon: <Activity size={14} />,
      label: t('性能设置'),
      content: <PerformanceSetting />,
      itemKey: 'performance',
    });
    panes.push({
      icon: <Cog size={14} />,
      label: t('系统设置'),
      content: <SystemSetting />,
      itemKey: 'system',
    });
    panes.push({
      icon: <MoreHorizontal size={14} />,
      label: t('其他设置'),
      content: <OtherSetting />,
      itemKey: 'other',
    });
  }
  const onChangeTab = (key) => {
    setTabActiveKey(key);
    navigate(`/console/setting?tab=${key}`, { replace: false });
  };

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const tab = searchParams.get('tab');
    if (tab && panes.some((pane) => pane.itemKey === tab)) {
      setTabActiveKey(tab);
    } else {
      setTabActiveKey('operation');
      if (location.search !== '?tab=operation') {
        navigate('/console/setting?tab=operation', { replace: true });
      }
    }
  }, [location.search, navigate]);

  const activePane = panes.find((pane) => pane.itemKey === tabActiveKey) || panes[0];

  return (
    <div className='min-w-0'>
      {/* Settings tabs — HeroUI ToggleButtonGroup, same anatomy as
          ChannelsTabs / ModelsTabs (rounded-3xl pills, accent-soft on
          select). HeroUI's ToggleButton ships `cursor: pointer` and
          full keyboard / radiogroup semantics out of the box, replacing
          the hand-rolled `<button>` list which had no pointer cursor
          and a black-pill selected state that drifted from the rest of
          the admin UI. */}
      <ToggleButtonGroup
        aria-label={t('设置分类')}
        selectionMode='single'
        selectedKeys={[tabActiveKey]}
        onSelectionChange={(keys) => {
          const next = Array.from(keys || [])[0];
          if (!next || next === tabActiveKey) return;
          onChangeTab(String(next));
        }}
        className='!flex !flex-wrap !justify-start mb-4 gap-2'
      >
        {panes.map((pane) => (
          <ToggleButton key={pane.itemKey} id={pane.itemKey} size='sm'>
            {pane.icon}
            <span className='whitespace-nowrap'>{pane.label}</span>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <div key={activePane?.itemKey}>{activePane?.content}</div>
    </div>
  );
};

export default Setting;
