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

import React from 'react';
import { Card, Chip } from '@heroui/react';
import { CheckCircle2, Database, KeyRound, Rocket, Settings2 } from 'lucide-react';

/**
 * 完成步骤组件
 * 显示配置总结和初始化确认界面
 */
const CompleteStep = ({
  setupStatus,
  formData,
  renderNavigationButtons,
  t,
}) => {
  const summaryItems = [
    {
      label: t('数据库类型'),
      icon: Database,
      value:
        setupStatus.database_type === 'sqlite'
          ? 'SQLite'
          : setupStatus.database_type === 'mysql'
            ? 'MySQL'
            : 'PostgreSQL',
    },
    {
      label: t('管理员账号'),
      icon: KeyRound,
      value: setupStatus.root_init
        ? t('已初始化')
        : formData.username || t('未设置'),
    },
    {
      label: t('使用模式'),
      icon: Settings2,
      value:
        formData.usageMode === 'external'
          ? t('对外运营模式')
          : formData.usageMode === 'self'
            ? t('自用模式')
            : t('演示站点模式'),
    },
  ];

  return (
    <div>
      <Card className='mb-5 overflow-hidden rounded-3xl border border-emerald-200 bg-[linear-gradient(135deg,rgba(16,185,129,0.14),rgba(14,165,233,0.10))] p-5 dark:border-emerald-900/60'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-center'>
          <div className='flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'>
            <Rocket size={26} />
          </div>
          <div className='min-w-0'>
            <Chip variant='flat' color='success' className='mb-3 w-fit'>
              <CheckCircle2 size={14} />
              {t('准备就绪')}
            </Chip>
            <h3 className='text-2xl font-semibold tracking-tight text-foreground'>
              {t('准备完成初始化')}
            </h3>
            <p className='mt-2 text-sm leading-6 text-foreground'>
              {t('请确认以下设置信息，点击"初始化系统"开始配置')}
            </p>
          </div>
        </div>
      </Card>

      <div className='grid grid-cols-1 gap-3 text-left sm:grid-cols-3'>
        {summaryItems.map((item) => {
          const Icon = item.icon;

          return (
          <Card
            key={item.label}
            className='rounded-3xl border border-border bg-background/80 p-4'
          >
            <div className='mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-surface-secondary text-muted'>
              <Icon size={20} />
            </div>
            <div className='text-xs text-muted'>{item.label}</div>
            <div className='mt-1 text-sm font-semibold text-foreground'>
              {item.value}
            </div>
          </Card>
          );
        })}
      </div>

      {renderNavigationButtons && renderNavigationButtons()}
    </div>
  );
};

export default CompleteStep;
