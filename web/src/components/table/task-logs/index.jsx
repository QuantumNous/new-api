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
import CardPro from '../../common/ui/CardPro';
import TaskLogsTable from './TaskLogsTable';
import TaskLogsActions from './TaskLogsActions';
import TaskLogsFilters from './TaskLogsFilters';
import ColumnSelectorModal from './modals/ColumnSelectorModal';
import ContentModal from './modals/ContentModal';
import AudioPreviewModal from './modals/AudioPreviewModal';
import { useTaskLogsData } from '../../../hooks/task-logs/useTaskLogsData';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import { createCardProPagination } from '../../../helpers/utils';
import {
  Activity,
  Clock3,
  Columns3,
  FileSearch,
  ShieldCheck,
} from 'lucide-react';

const TaskLogsPage = () => {
  const taskLogsData = useTaskLogsData();
  const isMobile = useIsMobile();
  const visibleTaskCount = taskLogsData.logs?.length || 0;
  const visibleColumnCount = Object.values(
    taskLogsData.visibleColumns || {},
  ).filter(Boolean).length;
  const taskSummaryItems = [
    {
      icon: FileSearch,
      label: taskLogsData.t('任务总数'),
      value: taskLogsData.logCount,
    },
    {
      icon: Activity,
      label: taskLogsData.t('当前视图'),
      value: visibleTaskCount,
    },
    {
      icon: Columns3,
      label: taskLogsData.t('显示列'),
      value: visibleColumnCount,
    },
    {
      icon: Clock3,
      label: taskLogsData.t('日志角色'),
      value: taskLogsData.isAdminUser
        ? taskLogsData.t('管理员视图')
        : taskLogsData.t('个人视图'),
    },
  ];

  return (
    <div className='na-task-console'>
      {/* Modals */}
      <ColumnSelectorModal {...taskLogsData} />
      <ContentModal {...taskLogsData} isVideo={false} />
      {/* 新增：视频预览弹窗 */}
      <ContentModal
        isModalOpen={taskLogsData.isVideoModalOpen}
        setIsModalOpen={taskLogsData.setIsVideoModalOpen}
        modalContent={taskLogsData.videoUrl}
        isVideo={true}
      />
      <AudioPreviewModal
        isModalOpen={taskLogsData.isAudioModalOpen}
        setIsModalOpen={taskLogsData.setIsAudioModalOpen}
        audioClips={taskLogsData.audioClips}
      />

      <section className='na-task-console-hero'>
        <div>
          <p className='na-task-console-eyebrow'>
            {taskLogsData.t('异步任务证据台')}
          </p>
          <h1 className='na-task-console-title'>
            {taskLogsData.t('任务日志')}
          </h1>
          <p className='na-task-console-copy'>
            {taskLogsData.t(
              '追踪绘图、音频、视频等异步任务的提交时间、完成状态、结果地址和失败原因。',
            )}
          </p>
        </div>
        <div className='na-task-console-risk'>
          <ShieldCheck size={16} />
          <span>{taskLogsData.t('任务证据可回看')}</span>
        </div>
      </section>

      <section className='na-task-summary-strip'>
        {taskSummaryItems.map((item) => {
          const Icon = item.icon;
          return (
            <article className='na-task-summary-item' key={item.label}>
              <Icon className='na-task-summary-icon' aria-hidden />
              <div>
                <p>{item.label}</p>
                <strong>{item.value}</strong>
              </div>
            </article>
          );
        })}
      </section>

      <section className='na-task-table-workbench'>
        <CardPro
          type='type2'
          statsArea={<TaskLogsActions {...taskLogsData} />}
          searchArea={<TaskLogsFilters {...taskLogsData} />}
          paginationArea={createCardProPagination({
            currentPage: taskLogsData.activePage,
            pageSize: taskLogsData.pageSize,
            total: taskLogsData.logCount,
            onPageChange: taskLogsData.handlePageChange,
            onPageSizeChange: taskLogsData.handlePageSizeChange,
            isMobile: isMobile,
            t: taskLogsData.t,
          })}
          t={taskLogsData.t}
        >
          <TaskLogsTable {...taskLogsData} />
        </CardPro>
      </section>
    </div>
  );
};

export default TaskLogsPage;
