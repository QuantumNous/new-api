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
import { Form, Button } from '@douyinfe/semi-ui';
import { IconRefresh, IconSearch } from '@douyinfe/semi-icons';

const TokensFilters = ({
  formInitValues,
  setFormApi,
  searchTokens,
  loading,
  searching,
  t,
}) => {
  // Handle form reset and immediate search
  const formApiRef = useRef(null);

  const handleReset = () => {
    if (!formApiRef.current) return;
    formApiRef.current.reset();
    setTimeout(() => {
      searchTokens();
    }, 100);
  };

  return (
    <Form
      initValues={formInitValues}
      getFormApi={(api) => {
        setFormApi(api);
        formApiRef.current = api;
      }}
      onSubmit={() => searchTokens(1)}
      allowEmpty={true}
      autoComplete='off'
      layout='horizontal'
      trigger='change'
      stopValidateWithError={false}
      className='token-filter-form'
    >
      <div className='token-filter-row'>
        <div className='token-filter-input'>
          <Form.Input
            field='searchKeyword'
            prefix={<IconSearch />}
            placeholder={t('搜索关键字')}
            showClear
            pure
            size='small'
          />
        </div>

        <div className='token-filter-input'>
          <Form.Input
            field='searchToken'
            prefix={<IconSearch />}
            placeholder={t('密钥')}
            showClear
            pure
            size='small'
          />
        </div>

        <div className='token-filter-actions'>
          <Button
            type='primary'
            theme='solid'
            htmlType='submit'
            loading={loading || searching}
            size='default'
            icon={<IconSearch />}
            className='token-filter-button token-filter-button-primary'
          >
            {t('查询')}
          </Button>

          <Button
            type='tertiary'
            onClick={handleReset}
            size='default'
            icon={<IconRefresh />}
            className='token-filter-button'
          >
            {t('重置')}
          </Button>
        </div>
      </div>
    </Form>
  );
};

export default TokensFilters;
