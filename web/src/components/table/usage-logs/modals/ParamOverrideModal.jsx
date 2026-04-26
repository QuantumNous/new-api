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

import React, { useMemo } from 'react';
import {
  Modal,
  Button,
  Chip,
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalHeader,
  useOverlayState,
} from '@heroui/react';
import { Copy } from 'lucide-react';
import { copy, showError, showSuccess } from '../../../../helpers';

const parseAuditLine = (line) => {
  if (typeof line !== 'string') {
    return null;
  }
  const firstSpaceIndex = line.indexOf(' ');
  if (firstSpaceIndex <= 0) {
    return { action: line, content: line };
  }
  return {
    action: line.slice(0, firstSpaceIndex),
    content: line.slice(firstSpaceIndex + 1),
  };
};

const getActionLabel = (action, t) => {
  switch ((action || '').toLowerCase()) {
    case 'set':
      return t('设置');
    case 'delete':
      return t('删除');
    case 'copy':
      return t('复制');
    case 'move':
      return t('移动');
    case 'append':
      return t('追加');
    case 'prepend':
      return t('前置');
    case 'trim_prefix':
      return t('去前缀');
    case 'trim_suffix':
      return t('去后缀');
    case 'ensure_prefix':
      return t('保前缀');
    case 'ensure_suffix':
      return t('保后缀');
    case 'trim_space':
      return t('去空格');
    case 'to_lower':
      return t('转小写');
    case 'to_upper':
      return t('转大写');
    case 'replace':
      return t('替换');
    case 'regex_replace':
      return t('正则替换');
    case 'set_header':
      return t('设请求头');
    case 'delete_header':
      return t('删请求头');
    case 'copy_header':
      return t('复制请求头');
    case 'move_header':
      return t('移动请求头');
    case 'pass_headers':
      return t('透传请求头');
    case 'sync_fields':
      return t('同步字段');
    case 'return_error':
      return t('返回错误');
    default:
      return action;
  }
};

const ParamOverrideModal = ({
  showParamOverrideModal,
  setShowParamOverrideModal,
  paramOverrideTarget,
  t,
}) => {
  const lines = Array.isArray(paramOverrideTarget?.lines)
    ? paramOverrideTarget.lines
    : [];
  const modalState = useOverlayState({
    isOpen: showParamOverrideModal,
    onOpenChange: (isOpen) => {
      if (!isOpen) setShowParamOverrideModal(false);
    },
  });

  const parsedLines = useMemo(() => {
    return lines.map(parseAuditLine);
  }, [lines]);

  const copyAll = async () => {
    const content = lines.join('\n');
    if (!content) {
      return;
    }
    if (await copy(content)) {
      showSuccess(t('参数覆盖已复制'));
      return;
    }
    showError(t('无法复制到剪贴板，请手动复制'));
  };

  return (
    <Modal state={modalState}>
      <ModalBackdrop variant='blur'>
        <ModalContainer size='2xl' placement='center' scroll='inside'>
          <ModalDialog className='bg-white/95 backdrop-blur dark:bg-slate-950/95'>
            <ModalHeader className='border-b border-slate-200/80 dark:border-white/10'>
              {t('参数覆盖详情')}
            </ModalHeader>
            <ModalBody className='p-6'>
              <div className='mb-4 flex items-start justify-between gap-3'>
                <div className='min-w-0'>
                  <div className='mb-1 font-semibold text-slate-800 dark:text-slate-100'>
                    {t('{{count}} 项操作', { count: lines.length })}
                  </div>
                  <div className='flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400'>
                    {paramOverrideTarget?.modelName ? (
                      <span>{paramOverrideTarget.modelName}</span>
                    ) : null}
                    {paramOverrideTarget?.requestId ? (
                      <span>
                        {t('Request ID')}: {paramOverrideTarget.requestId}
                      </span>
                    ) : null}
                    {paramOverrideTarget?.requestPath ? (
                      <span>
                        {t('请求路径')}: {paramOverrideTarget.requestPath}
                      </span>
                    ) : null}
                  </div>
                </div>

                <Button
                  startContent={<Copy size={16} />}
                  variant='flat'
                  size='sm'
                  onPress={copyAll}
                  isDisabled={lines.length === 0}
                >
                  {t('复制')}
                </Button>
              </div>

              <div className='mb-4 h-px bg-slate-200 dark:bg-white/10' />

              {lines.length === 0 ? (
                <div className='py-8 text-center text-sm text-slate-500 dark:text-slate-400'>
                  {t('暂无参数覆盖记录')}
                </div>
              ) : (
                <div className='flex max-h-[56vh] flex-col gap-2 overflow-y-auto pr-1'>
                  {parsedLines.map((item, index) => {
                    if (!item) {
                      return null;
                    }

                    return (
                      <div
                        key={`${item.action}-${index}`}
                        className='flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 dark:border-white/10 dark:bg-slate-900/60'
                      >
                        <Chip color='primary' size='sm' variant='flat'>
                          {getActionLabel(item.action, t)}
                        </Chip>
                        <pre className='min-w-0 flex-1 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-slate-800 dark:text-slate-100'>
                          {item.content}
                        </pre>
                      </div>
                    );
                  })}
                </div>
              )}
            </ModalBody>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
};

export default ParamOverrideModal;
