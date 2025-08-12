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

import React, { useEffect } from 'react';
import { Notification, Button, Space, Typography } from '@douyinfe/semi-ui';

// 固定通知 ID，保持同一个实例即可避免闪烁
const NOTICE_ID = 'models-batch-actions';

/**
 * SelectionNotification 选择通知组件
 * 1. 当 selectedKeys.length > 0 时，使用固定 id 创建/更新通知
 * 2. 当 selectedKeys 清空时关闭通知
 */
const SelectionNotification = ({ selectedKeys = [], t, onDelete, onAddPrefill, onClear, onCopy }) => {
  // 根据选中数量决定显示/隐藏或更新通知
  useEffect(() => {
    const selectedCount = selectedKeys.length;

    if (selectedCount > 0) {
      const titleNode = (
        <Space wrap>
          <span>{t('批量操作')}</span>
          <Typography.Text type="tertiary" size="small">{t('已选择 {{count}} 个模型', { count: selectedCount })}</Typography.Text>
        </Space>
      );

      const content = (
        <Space wrap>
          <Button
            size="small"
            type="tertiary"
            theme="solid"
            onClick={onClear}
          >
            {t('取消全选')}
          </Button>
          <Button
            size="small"
            type="primary"
            theme="solid"
            onClick={onAddPrefill}
          >
            {t('加入预填组')}
          </Button>
          <Button
            size="small"
            type="secondary"
            theme="solid"
            onClick={onCopy}
          >
            {t('复制名称')}
          </Button>
          <Button
            size="small"
            type="danger"
            theme="solid"
            onClick={onDelete}
          >
            {t('删除所选')}
          </Button>
        </Space>
      );

      // 使用相同 id 更新通知（若已存在则就地更新，不存在则创建）
      Notification.info({
        id: NOTICE_ID,
        title: titleNode,
        content,
        duration: 0, // 不自动关闭
        position: 'bottom',
        showClose: false,
      });
    } else {
      // 取消全部勾选时关闭通知
      Notification.close(NOTICE_ID);
    }
  }, [selectedKeys, t, onDelete, onAddPrefill, onClear, onCopy]);

  // 卸载时确保关闭通知
  useEffect(() => {
    return () => {
      Notification.close(NOTICE_ID);
    };
  }, []);

  return null; // 该组件不渲染可见内容
};

export default SelectionNotification;
