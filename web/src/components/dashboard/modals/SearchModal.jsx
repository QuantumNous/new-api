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
import {
  Button,
  Input,
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalFooter,
  ModalHeader,
  useOverlayState,
} from '@heroui/react';

const SearchModal = ({
  searchModalVisible,
  handleSearchConfirm,
  handleCloseModal,
  isMobile,
  isAdminUser,
  inputs,
  dataExportDefaultTime,
  timeOptions,
  handleInputChange,
  t,
}) => {
  const { start_timestamp, end_timestamp, username } = inputs;
  const modalState = useOverlayState({
    isOpen: searchModalVisible,
    onOpenChange: (isOpen) => {
      if (!isOpen) handleCloseModal();
    },
  });

  const fieldClass =
    'flex flex-col gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200';

  return (
    <Modal state={modalState}>
      <ModalBackdrop variant='blur'>
        <ModalContainer size={isMobile ? 'full' : 'sm'} placement='center'>
          <ModalDialog className='bg-white/95 backdrop-blur dark:bg-slate-950/95'>
            <ModalHeader className='border-b border-slate-200/80 dark:border-white/10'>
              {t('搜索条件')}
            </ModalHeader>
            <ModalBody className='space-y-4 px-6 py-5'>
              <label className={fieldClass}>
                {t('起始时间')}
                <Input
                  value={start_timestamp}
                  onChange={(event) =>
                    handleInputChange(event.target.value, 'start_timestamp')
                  }
                  placeholder='YYYY-MM-DD HH:mm:ss'
                  fullWidth
                />
              </label>

              <label className={fieldClass}>
                {t('结束时间')}
                <Input
                  value={end_timestamp}
                  onChange={(event) =>
                    handleInputChange(event.target.value, 'end_timestamp')
                  }
                  placeholder='YYYY-MM-DD HH:mm:ss'
                  fullWidth
                />
              </label>

              <label className={fieldClass}>
                {t('时间粒度')}
                <select
                  className='h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100'
                  value={dataExportDefaultTime}
                  onChange={(event) =>
                    handleInputChange(
                      event.target.value,
                      'data_export_default_time',
                    )
                  }
                >
                  {timeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              {isAdminUser && (
                <label className={fieldClass}>
                  {t('用户名称')}
                  <Input
                    value={username}
                    onChange={(event) =>
                      handleInputChange(event.target.value, 'username')
                    }
                    placeholder={t('可选值')}
                    fullWidth
                  />
                </label>
              )}
            </ModalBody>
            <ModalFooter className='border-t border-slate-200/80 dark:border-white/10'>
              <Button variant='ghost' onPress={handleCloseModal}>
                {t('取消')}
              </Button>
              <Button variant='primary' onPress={handleSearchConfirm}>
                {t('确定')}
              </Button>
            </ModalFooter>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
};

export default SearchModal;
