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
import { Typography } from '@douyinfe/semi-ui';
import { ListTodo } from 'lucide-react';
import CompactModeToggle from '../../common/ui/CompactModeToggle';

const { Text } = Typography;

const TaskLogsActions = ({ compactMode, setCompactMode, t }) => {
  return (
    <div className='task-table-overview'>
      <div className='task-table-overview-copy'>
        <div className='task-table-overview-eyebrow'>
          <ListTodo size={15} strokeWidth={2.1} />
          <span>{t('任务总览')}</span>
        </div>
        <Text className='task-table-overview-title'>
          {t('查看任务队列、执行状态与结果回传细节')}
        </Text>
        <p className='task-table-overview-subtitle'>
          {t('支持按时间范围、任务 ID 与渠道快速检索，便于排查任务排队、失败与结果异常')}
        </p>
      </div>

      <div className='task-table-overview-side'>
        <CompactModeToggle
          compactMode={compactMode}
          setCompactMode={setCompactMode}
          t={t}
          className='task-compact-toggle'
        />
      </div>
    </div>
  );
};

export default TaskLogsActions;
