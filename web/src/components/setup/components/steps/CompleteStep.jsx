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
import { Avatar, Typography, Descriptions } from '@douyinfe/semi-ui';
import { CheckCircle } from 'lucide-react';

const { Text, Title } = Typography;

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
  return (
    <div className='text-center'>
      <Avatar color='green' className='mx-auto mb-4 shadow-lg'>
        <CheckCircle size={24} />
      </Avatar>
      <Title heading={3} className='mb-2'>
        {t('准备完成初始化')}
      </Title>
      <Text type='secondary' className='mb-6 block'>
        {t('请确认以下设置信息，点击"初始化系统"开始配置')}
      </Text>

      <Descriptions>
        <Descriptions.Item itemKey={t('数据库类型')}>
          {setupStatus.database_type === 'sqlite'
            ? 'SQLite'
            : setupStatus.database_type === 'mysql'
              ? 'MySQL'
              : 'PostgreSQL'}
        </Descriptions.Item>
        <Descriptions.Item itemKey={t('管理员账号')}>
          {setupStatus.root_init
            ? t('已初始化')
            : formData.username || t('未设置')}
        </Descriptions.Item>
        <Descriptions.Item itemKey={t('使用模式')}>
          {formData.usageMode === 'external'
            ? t('对外运营模式')
            : formData.usageMode === 'self'
              ? t('自用模式')
              : t('演示站点模式')}
        </Descriptions.Item>
      </Descriptions>

      {renderNavigationButtons && renderNavigationButtons()}
    </div>
  );
};

export default CompleteStep;
