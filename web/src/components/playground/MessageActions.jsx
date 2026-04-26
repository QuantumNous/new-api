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
import { Button, Tooltip } from '@heroui/react';
import { RefreshCw, Copy, Trash2, UserCheck, Edit } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const MessageActions = ({
  message,
  styleState,
  onMessageReset,
  onMessageCopy,
  onMessageDelete,
  onRoleToggle,
  onMessageEdit,
  isAnyMessageGenerating = false,
  isEditing = false,
}) => {
  const { t } = useTranslation();

  const isLoading =
    message.status === 'loading' || message.status === 'incomplete';
  const shouldDisableActions = isAnyMessageGenerating || isEditing;
  const canToggleRole =
    message.role === 'assistant' || message.role === 'system';
  const canEdit =
    !isLoading &&
    message.content &&
    typeof onMessageEdit === 'function' &&
    !isEditing;

  return (
    <div className='flex items-center gap-0.5'>
      {!isLoading && (
        <Tooltip
          content={shouldDisableActions ? t('操作暂时被禁用') : t('重试')}
          position='top'
        >
          <Button
            isIconOnly
            variant='ghost'
            size='sm'
            onPress={() => !shouldDisableActions && onMessageReset(message)}
            isDisabled={shouldDisableActions}
            className={`!rounded-full ${shouldDisableActions ? '!text-gray-300 !cursor-not-allowed' : '!text-gray-400 hover:!text-blue-600 hover:!bg-blue-50'} ${styleState.isMobile ? '!w-6 !h-6' : '!w-7 !h-7'} !p-0 transition-all`}
            aria-label={t('重试')}
          >
            <RefreshCw size={styleState.isMobile ? 12 : 14} />
          </Button>
        </Tooltip>
      )}

      {message.content && (
        <Tooltip content={t('复制')} position='top'>
          <Button
            isIconOnly
            variant='ghost'
            size='sm'
            onPress={() => onMessageCopy(message)}
            className={`!rounded-full !text-gray-400 hover:!text-green-600 hover:!bg-green-50 ${styleState.isMobile ? '!w-6 !h-6' : '!w-7 !h-7'} !p-0 transition-all`}
            aria-label={t('复制')}
          >
            <Copy size={styleState.isMobile ? 12 : 14} />
          </Button>
        </Tooltip>
      )}

      {canEdit && (
        <Tooltip
          content={shouldDisableActions ? t('操作暂时被禁用') : t('编辑')}
          position='top'
        >
          <Button
            isIconOnly
            variant='ghost'
            size='sm'
            onPress={() => !shouldDisableActions && onMessageEdit(message)}
            isDisabled={shouldDisableActions}
            className={`!rounded-full ${shouldDisableActions ? '!text-gray-300 !cursor-not-allowed' : '!text-gray-400 hover:!text-yellow-600 hover:!bg-yellow-50'} ${styleState.isMobile ? '!w-6 !h-6' : '!w-7 !h-7'} !p-0 transition-all`}
            aria-label={t('编辑')}
          >
            <Edit size={styleState.isMobile ? 12 : 14} />
          </Button>
        </Tooltip>
      )}

      {canToggleRole && !isLoading && (
        <Tooltip
          content={
            shouldDisableActions
              ? t('操作暂时被禁用')
              : message.role === 'assistant'
                ? t('切换为System角色')
                : t('切换为Assistant角色')
          }
          position='top'
        >
          <Button
            isIconOnly
            variant='ghost'
            size='sm'
            onPress={() =>
              !shouldDisableActions && onRoleToggle && onRoleToggle(message)
            }
            isDisabled={shouldDisableActions}
            className={`!rounded-full ${shouldDisableActions ? '!text-gray-300 !cursor-not-allowed' : message.role === 'system' ? '!text-purple-500 hover:!text-purple-700 hover:!bg-purple-50' : '!text-gray-400 hover:!text-purple-600 hover:!bg-purple-50'} ${styleState.isMobile ? '!w-6 !h-6' : '!w-7 !h-7'} !p-0 transition-all`}
            aria-label={
              message.role === 'assistant'
                ? t('切换为System角色')
                : t('切换为Assistant角色')
            }
          >
            <UserCheck size={styleState.isMobile ? 12 : 14} />
          </Button>
        </Tooltip>
      )}

      {!isLoading && (
        <Tooltip
          content={shouldDisableActions ? t('操作暂时被禁用') : t('删除')}
          position='top'
        >
          <Button
            isIconOnly
            variant='ghost'
            size='sm'
            onPress={() => !shouldDisableActions && onMessageDelete(message)}
            isDisabled={shouldDisableActions}
            className={`!rounded-full ${shouldDisableActions ? '!text-gray-300 !cursor-not-allowed' : '!text-gray-400 hover:!text-red-600 hover:!bg-red-50'} ${styleState.isMobile ? '!w-6 !h-6' : '!w-7 !h-7'} !p-0 transition-all`}
            aria-label={t('删除')}
          >
            <Trash2 size={styleState.isMobile ? 12 : 14} />
          </Button>
        </Tooltip>
      )}
    </div>
  );
};

export default MessageActions;
