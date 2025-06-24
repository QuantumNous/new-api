import React from 'react';
import {
  Button,
  Tooltip,
} from '@douyinfe/semi-ui';
import {
  RefreshCw,
  Copy,
  Trash2,
  UserCheck,
  Edit,
} from 'lucide-react';
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
  isEditing = false
}) => {
  const { t } = useTranslation();

  const isLoading = message.status === 'loading' || message.status === 'incomplete';
  const shouldDisableActions = isAnyMessageGenerating || isEditing;
  const canToggleRole = message.role === 'assistant' || message.role === 'system';
  const canEdit = !isLoading && message.content && typeof onMessageEdit === 'function' && !isEditing;

  return (
    <div className="flex items-center gap-0.5">
      {!isLoading && (
        <Tooltip content={shouldDisableActions ? t('操作暂时被禁用') : t('重试')} position="top">
          <Button
            theme="borderless"
            type="tertiary"
            size="small"
            icon={<RefreshCw size={styleState.isMobile ? 12 : 14} />}
            onClick={() => !shouldDisableActions && onMessageReset(message)}
            disabled={shouldDisableActions}
            className={`!rounded-full ${shouldDisableActions ? '!text-gray-300 !cursor-not-allowed' : '!text-gray-400 hover:!text-blue-600 hover:!bg-blue-50'} ${styleState.isMobile ? '!w-6 !h-6' : '!w-7 !h-7'} !p-0 transition-all`}
            aria-label={t('重试')}
          />
        </Tooltip>
      )}

      {message.content && (
        <Tooltip content={t('复制')} position="top">
          <Button
            theme="borderless"
            type="tertiary"
            size="small"
            icon={<Copy size={styleState.isMobile ? 12 : 14} />}
            onClick={() => onMessageCopy(message)}
            className={`!rounded-full !text-gray-400 hover:!text-green-600 hover:!bg-green-50 ${styleState.isMobile ? '!w-6 !h-6' : '!w-7 !h-7'} !p-0 transition-all`}
            aria-label={t('复制')}
          />
        </Tooltip>
      )}

      {canEdit && (
        <Tooltip content={shouldDisableActions ? t('操作暂时被禁用') : t('编辑')} position="top">
          <Button
            theme="borderless"
            type="tertiary"
            size="small"
            icon={<Edit size={styleState.isMobile ? 12 : 14} />}
            onClick={() => !shouldDisableActions && onMessageEdit(message)}
            disabled={shouldDisableActions}
            className={`!rounded-full ${shouldDisableActions ? '!text-gray-300 !cursor-not-allowed' : '!text-gray-400 hover:!text-yellow-600 hover:!bg-yellow-50'} ${styleState.isMobile ? '!w-6 !h-6' : '!w-7 !h-7'} !p-0 transition-all`}
            aria-label={t('编辑')}
          />
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
          position="top"
        >
          <Button
            theme="borderless"
            type="tertiary"
            size="small"
            icon={<UserCheck size={styleState.isMobile ? 12 : 14} />}
            onClick={() => !shouldDisableActions && onRoleToggle && onRoleToggle(message)}
            disabled={shouldDisableActions}
            className={`!rounded-full ${shouldDisableActions ? '!text-gray-300 !cursor-not-allowed' : message.role === 'system' ? '!text-purple-500 hover:!text-purple-700 hover:!bg-purple-50' : '!text-gray-400 hover:!text-purple-600 hover:!bg-purple-50'} ${styleState.isMobile ? '!w-6 !h-6' : '!w-7 !h-7'} !p-0 transition-all`}
            aria-label={message.role === 'assistant' ? t('切换为System角色') : t('切换为Assistant角色')}
          />
        </Tooltip>
      )}

      {!isLoading && (
        <Tooltip content={shouldDisableActions ? t('操作暂时被禁用') : t('删除')} position="top">
          <Button
            theme="borderless"
            type="tertiary"
            size="small"
            icon={<Trash2 size={styleState.isMobile ? 12 : 14} />}
            onClick={() => !shouldDisableActions && onMessageDelete(message)}
            disabled={shouldDisableActions}
            className={`!rounded-full ${shouldDisableActions ? '!text-gray-300 !cursor-not-allowed' : '!text-gray-400 hover:!text-red-600 hover:!bg-red-50'} ${styleState.isMobile ? '!w-6 !h-6' : '!w-7 !h-7'} !p-0 transition-all`}
            aria-label={t('删除')}
          />
        </Tooltip>
      )}
    </div>
  );
};

export default MessageActions; 