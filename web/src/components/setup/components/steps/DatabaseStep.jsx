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
import { Banner } from '@douyinfe/semi-ui';

/**
 * 数据库检查步骤组件
 * 显示当前数据库类型和相关警告信息
 */
const DatabaseStep = ({ setupStatus, renderNavigationButtons, t }) => {
  return (
    <>
      {/* 数据库警告 */}
      {setupStatus.database_type === 'sqlite' && (
        <Banner
          type='warning'
          closeIcon={null}
          title={t('数据库警告')}
          description={
            <div>
              <p>
                {t(
                  '您正在使用 SQLite 数据库。如果您在容器环境中运行，请确保已正确设置数据库文件的持久化映射，否则容器重启后所有数据将丢失！',
                )}
              </p>
              <p className='mt-1'>
                <strong>
                  {t(
                    '建议在生产环境中使用 MySQL 或 PostgreSQL 数据库，或确保 SQLite 数据库文件已映射到宿主机的持久化存储。',
                  )}
                </strong>
              </p>
            </div>
          }
          className='!rounded-lg'
          fullMode={false}
          bordered
        />
      )}

      {/* MySQL数据库提示 */}
      {setupStatus.database_type === 'mysql' && (
        <Banner
          type='success'
          closeIcon={null}
          title={t('数据库信息')}
          description={
            <div>
              <p>
                {t(
                  '您正在使用 MySQL 数据库。MySQL 是一个可靠的关系型数据库管理系统，适合生产环境使用。',
                )}
              </p>
            </div>
          }
          className='!rounded-lg'
          fullMode={false}
          bordered
        />
      )}

      {/* PostgreSQL数据库提示 */}
      {setupStatus.database_type === 'postgres' && (
        <Banner
          type='success'
          closeIcon={null}
          title={t('数据库信息')}
          description={
            <div>
              <p>
                {t(
                  '您正在使用 PostgreSQL 数据库。PostgreSQL 是一个功能强大的开源关系型数据库系统，提供了出色的可靠性和数据完整性，适合生产环境使用。',
                )}
              </p>
            </div>
          }
          className='!rounded-lg'
          fullMode={false}
          bordered
        />
      )}
      {renderNavigationButtons && renderNavigationButtons()}
    </>
  );
};

export default DatabaseStep;
