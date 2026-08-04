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

import React, { useRef } from 'react';
import { Modal, Form } from '@douyinfe/semi-ui';

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
  const formRef = useRef();

  const FORM_FIELD_PROPS = {
    className: 'w-full mb-2 !rounded-lg',
  };

  const createFormField = (Component, props) => (
    <Component {...FORM_FIELD_PROPS} {...props} />
  );

  const {
    start_timestamp,
    end_timestamp,
    username,
    token_name,
    model_name,
    group,
    channel,
  } = inputs;

  return (
    <Modal
      title={t('搜索条件')}
      visible={searchModalVisible}
      onOk={handleSearchConfirm}
      onCancel={handleCloseModal}
      closeOnEsc={true}
      size={isMobile ? 'full-width' : 'small'}
      centered
    >
      <Form ref={formRef} layout='vertical' className='w-full'>
        {createFormField(Form.DatePicker, {
          field: 'start_timestamp',
          label: t('起始时间'),
          initValue: start_timestamp,
          value: start_timestamp,
          type: 'dateTime',
          name: 'start_timestamp',
          onChange: (value) => handleInputChange(value, 'start_timestamp'),
        })}

        {createFormField(Form.DatePicker, {
          field: 'end_timestamp',
          label: t('结束时间'),
          initValue: end_timestamp,
          value: end_timestamp,
          type: 'dateTime',
          name: 'end_timestamp',
          onChange: (value) => handleInputChange(value, 'end_timestamp'),
        })}

        {createFormField(Form.Select, {
          field: 'data_export_default_time',
          label: t('时间粒度'),
          initValue: dataExportDefaultTime,
          placeholder: t('时间粒度'),
          name: 'data_export_default_time',
          optionList: timeOptions,
          onChange: (value) =>
            handleInputChange(value, 'data_export_default_time'),
        })}

        {isAdminUser &&
          createFormField(Form.Input, {
            field: 'username',
            label: t('用户名称'),
            value: username,
            placeholder: t('可选值'),
            name: 'username',
            onChange: (value) => handleInputChange(value, 'username'),
          })}

        {createFormField(Form.Input, {
          field: 'model_name',
          label: t('模型'),
          value: model_name,
          placeholder: t('可选，支持模型名匹配'),
          name: 'model_name',
          onChange: (value) => handleInputChange(value, 'model_name'),
        })}

        {createFormField(Form.Input, {
          field: 'token_name',
          label: t('令牌名称'),
          value: token_name,
          placeholder: t('可选，按令牌名称筛选'),
          name: 'token_name',
          onChange: (value) => handleInputChange(value, 'token_name'),
        })}

        {createFormField(Form.Input, {
          field: 'group',
          label: t('分组'),
          value: group,
          placeholder: t('可选，按分组筛选'),
          name: 'group',
          onChange: (value) => handleInputChange(value, 'group'),
        })}

        {isAdminUser &&
          createFormField(Form.Input, {
            field: 'channel',
            label: t('渠道 ID'),
            value: channel,
            placeholder: t('可选，按渠道筛选'),
            name: 'channel',
            onChange: (value) => handleInputChange(value, 'channel'),
          })}
      </Form>
    </Modal>
  );
};

export default SearchModal;
