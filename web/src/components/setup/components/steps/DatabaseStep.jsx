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
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  HardDrive,
  Info,
} from 'lucide-react';

const databaseCopy = {
  sqlite: {
    label: 'SQLite',
    tone: 'warning',
    icon: AlertTriangle,
  },
  mysql: {
    label: 'MySQL',
    tone: 'success',
    icon: CheckCircle2,
  },
  postgres: {
    label: 'PostgreSQL',
    tone: 'success',
    icon: CheckCircle2,
  },
};

/**
 * 数据库检查步骤组件
 * 显示当前数据库类型和相关警告信息
 */
const DatabaseStep = ({ setupStatus, renderNavigationButtons, t }) => {
  // 检测是否在 Electron 环境中运行
  const isElectron =
    typeof window !== 'undefined' && window.electron?.isElectron;
  const databaseType = setupStatus.database_type || 'sqlite';
  const meta = databaseCopy[databaseType] || databaseCopy.sqlite;
  const StatusIcon = isElectron && databaseType === 'sqlite' ? HardDrive : meta.icon;
  const isWarning = databaseType === 'sqlite' && !isElectron;

  return (
    <>
      <div className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]'>
        <Card className={`rounded-3xl p-5 ${
          isWarning
            ? 'border border-amber-200 bg-amber-50/80 dark:border-amber-900/60 dark:bg-amber-950/30'
            : 'border border-emerald-200 bg-emerald-50/80 dark:border-emerald-900/60 dark:bg-emerald-950/30'
        }`}>
          <div className='flex items-start gap-4'>
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
              isWarning
                ? 'bg-amber-500 text-white'
                : 'bg-emerald-500 text-white'
            }`}>
              <StatusIcon size={24} />
            </div>
            <div className='min-w-0'>
              <div className='mb-2 flex flex-wrap items-center gap-2'>
                <h3 className='text-lg font-semibold text-foreground'>
                  {isElectron ? t('本地数据存储') : isWarning ? t('数据库警告') : t('数据库信息')}
                </h3>
                <Chip
                  variant='tertiary'
                  color={isWarning ? 'warning' : 'success'}
                  className='w-fit'
                >
                  {meta.label}
                </Chip>
              </div>

              {databaseType === 'sqlite' ? (
                isElectron ? (
                  <div className='space-y-3 text-sm leading-6 text-foreground'>
                    <p>
                      {t(
                        '您的数据将安全地存储在本地计算机上。所有配置、用户信息和使用记录都会自动保存，关闭应用后不会丢失。',
                      )}
                    </p>
                    {window.electron?.dataDir && (
                      <div className='rounded-2xl bg-background/70 p-3'>
                        <div className='mb-1 text-xs font-medium text-muted'>
                          {t('数据存储位置：')}
                        </div>
                        <code className='break-all text-xs text-foreground'>
                          {window.electron.dataDir}
                        </code>
                      </div>
                    )}
                    <p className='text-muted'>
                      {t('提示：如需备份数据，只需复制上述目录即可')}
                    </p>
                  </div>
                ) : (
                  <div className='space-y-3 text-sm leading-6 text-amber-900 dark:text-amber-100'>
                    <p>
                      {t(
                        '您正在使用 SQLite 数据库。如果您在容器环境中运行，请确保已正确设置数据库文件的持久化映射，否则容器重启后所有数据将丢失！',
                      )}
                    </p>
                    <p className='font-medium'>
                      {t(
                        '建议在生产环境中使用 MySQL 或 PostgreSQL 数据库，或确保 SQLite 数据库文件已映射到宿主机的持久化存储。',
                      )}
                    </p>
                  </div>
                )
              ) : (
                <p className='text-sm leading-6 text-foreground'>
                  {databaseType === 'mysql'
                    ? t(
                      '您正在使用 MySQL 数据库。MySQL 是一个可靠的关系型数据库管理系统，适合生产环境使用。',
                    )
                    : t(
                      '您正在使用 PostgreSQL 数据库。PostgreSQL 是一个功能强大的开源关系型数据库系统，提供了出色的可靠性和数据完整性，适合生产环境使用。',
                    )}
                </p>
              )}
            </div>
          </div>
        </Card>

        <Card className='rounded-3xl border border-border bg-background/70 p-5'>
          <div className='mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-surface-secondary text-muted'>
            <Database size={22} />
          </div>
          <div className='text-sm font-semibold text-foreground'>
            {t('连接状态')}
          </div>
          <div className='mt-2 flex items-center gap-2 text-sm text-muted'>
            <Info size={16} />
            <span>{t('已读取当前数据库配置')}</span>
          </div>
        </Card>
      </div>
      {renderNavigationButtons && renderNavigationButtons()}
    </>
  );
};

export default DatabaseStep;
