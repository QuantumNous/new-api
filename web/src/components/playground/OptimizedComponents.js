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
import MessageContent from './MessageContent';
import MessageActions from './MessageActions';
import SettingsPanel from './SettingsPanel';
import DebugPanel from './DebugPanel';

// 优化的消息内容组件
export const OptimizedMessageContent = React.memo(MessageContent, (prevProps, nextProps) => {
  // 只有这些属性变化时才重新渲染
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.status === nextProps.message.status &&
    prevProps.message.role === nextProps.message.role &&
    prevProps.message.reasoningContent === nextProps.message.reasoningContent &&
    prevProps.message.isReasoningExpanded === nextProps.message.isReasoningExpanded &&
    prevProps.isEditing === nextProps.isEditing &&
    prevProps.editValue === nextProps.editValue &&
    prevProps.styleState.isMobile === nextProps.styleState.isMobile
  );
});

// 优化的消息操作组件
export const OptimizedMessageActions = React.memo(MessageActions, (prevProps, nextProps) => {
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.role === nextProps.message.role &&
    prevProps.isAnyMessageGenerating === nextProps.isAnyMessageGenerating &&
    prevProps.isEditing === nextProps.isEditing &&
    prevProps.onMessageReset === nextProps.onMessageReset
  );
});

// 优化的设置面板组件
export const OptimizedSettingsPanel = React.memo(SettingsPanel, (prevProps, nextProps) => {
  return (
    JSON.stringify(prevProps.inputs) === JSON.stringify(nextProps.inputs) &&
    JSON.stringify(prevProps.parameterEnabled) === JSON.stringify(nextProps.parameterEnabled) &&
    JSON.stringify(prevProps.models) === JSON.stringify(nextProps.models) &&
    JSON.stringify(prevProps.groups) === JSON.stringify(nextProps.groups) &&
    prevProps.customRequestMode === nextProps.customRequestMode &&
    prevProps.customRequestBody === nextProps.customRequestBody &&
    prevProps.showDebugPanel === nextProps.showDebugPanel &&
    prevProps.showSettings === nextProps.showSettings &&
    JSON.stringify(prevProps.previewPayload) === JSON.stringify(nextProps.previewPayload) &&
    JSON.stringify(prevProps.messages) === JSON.stringify(nextProps.messages)
  );
});

// 优化的调试面板组件
export const OptimizedDebugPanel = React.memo(DebugPanel, (prevProps, nextProps) => {
  return (
    prevProps.show === nextProps.show &&
    prevProps.activeTab === nextProps.activeTab &&
    JSON.stringify(prevProps.debugData) === JSON.stringify(nextProps.debugData) &&
    JSON.stringify(prevProps.previewPayload) === JSON.stringify(nextProps.previewPayload) &&
    prevProps.customRequestMode === nextProps.customRequestMode &&
    prevProps.showDebugPanel === nextProps.showDebugPanel
  );
}); 