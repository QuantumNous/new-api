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
import { Modal, Form, Radio } from '@douyinfe/semi-ui';

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
    user_id,
    user_search_type,
    model_name,
  } = inputs;
  const userSearchType = user_search_type || 'username';

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

        {isAdminUser && (
          <Form.RadioGroup
            field='user_search_type'
            label={t('用户')}
            initValue={userSearchType}
            value={userSearchType}
            onChange={(value) => handleInputChange(value, 'user_search_type')}
          >
            <Radio value='username'>{t('用户名')}</Radio>
            <Radio value='user_id'>{t('用户ID')}</Radio>
          </Form.RadioGroup>
        )}

        {isAdminUser &&
          userSearchType === 'username' &&
          createFormField(Form.Input, {
            field: 'username',
            label: t('用户名'),
            value: username,
            placeholder: t('可选值'),
            name: 'username',
            onChange: (value) => handleInputChange(value, 'username'),
          })}

        {isAdminUser &&
          userSearchType === 'user_id' &&
          createFormField(Form.InputNumber, {
            field: 'user_id',
            label: t('用户ID'),
            value: user_id,
            placeholder: t('可选值'),
            name: 'user_id',
            min: 1,
            step: 1,
            precision: 0,
            onChange: (value) => handleInputChange(value, 'user_id'),
          })}

        {isAdminUser && userSearchType === 'user_id' && username && (
          <div className='text-xs text-gray-500 mb-2'>
            {t('用户名')}：{username}
          </div>
        )}

        {createFormField(Form.Input, {
          field: 'model_name',
          label: t('模型名称'),
          value: model_name,
          placeholder: t('可选值'),
          name: 'model_name',
          onChange: (value) => handleInputChange(value, 'model_name'),
        })}
      </Form>
    </Modal>
  );
};

export default SearchModal;
