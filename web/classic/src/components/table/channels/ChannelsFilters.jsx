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
import { Button, Form } from '@douyinfe/semi-ui';
import { IconSearch, IconUpload } from '@douyinfe/semi-icons';
import { renderQuotaWithAmount } from '../../../helpers';

const ChannelsFilters = ({
  setEditingChannel,
  setShowEdit,
  refresh,
  setShowColumnSelector,
  formInitValues,
  setFormApi,
  searchChannels,
  enableTagMode,
  formApi,
  groupOptions,
  channelStats,
  loading,
  searching,
  setShowBatchImport,
  t,
}) => {
  const formattedStats = useMemo(() => {
    const totalAmount = Number(channelStats?.balance_total) || 0;
    const usedQuota = Number(channelStats?.used_quota_balance_nonzero) || 0;
    const quotaPerUnit = Number(localStorage.getItem('quota_per_unit')) || 0;
    const usedAmount = quotaPerUnit > 0 ? usedQuota / quotaPerUnit : 0;
    const remainingAmount = totalAmount - usedAmount;

    return {
      totalAmount: renderQuotaWithAmount(totalAmount),
      remainingAmount: renderQuotaWithAmount(remainingAmount),
    };
  }, [
    channelStats?.used_quota_balance_nonzero,
    channelStats?.balance_total,
  ]);

  return (
    <div className='flex flex-col md:flex-row justify-between items-center gap-2 w-full'>
      <div className='flex gap-2 w-full md:w-auto order-2 md:order-1'>
        <Button
          size='small'
          theme='light'
          type='primary'
          className='w-full md:w-auto'
          onClick={() => {
            setEditingChannel({
              id: undefined,
            });
            setShowEdit(true);
          }}
        >
          {t('添加渠道')}
        </Button>

        <Button
          size='small'
          type='tertiary'
          className='w-full md:w-auto'
          icon={<IconUpload />}
          onClick={() => {
            if (setShowBatchImport) setShowBatchImport(true);
          }}
        >
          {t('批量导入')}
        </Button>

        <Button
          size='small'
          type='tertiary'
          className='w-full md:w-auto'
          onClick={refresh}
        >
          {t('刷新')}
        </Button>

        <Button
          size='small'
          type='tertiary'
          onClick={() => setShowColumnSelector(true)}
          className='w-full md:w-auto'
        >
          {t('列设置')}
        </Button>
      </div>

      <div className='flex flex-col md:flex-row items-center gap-2 w-full md:w-auto order-1 md:order-2'>
        <Form
          initValues={formInitValues}
          getFormApi={(api) => setFormApi(api)}
          onSubmit={() => searchChannels(enableTagMode)}
          allowEmpty={true}
          autoComplete='off'
          layout='horizontal'
          trigger='change'
          stopValidateWithError={false}
          className='flex flex-col md:flex-row items-center gap-2 w-full'
        >
          <div className='relative w-full md:w-64'>
            <Form.Input
              size='small'
              field='searchKeyword'
              prefix={<IconSearch />}
              placeholder={t('渠道ID，名称，密钥，API地址')}
              showClear
              pure
            />
          </div>
          <div className='w-full md:w-48'>
            <Form.Input
              size='small'
              field='searchModel'
              prefix={<IconSearch />}
              placeholder={t('模型关键字')}
              showClear
              pure
            />
          </div>
          <div className='w-full md:w-32'>
            <Form.Select
              size='small'
              field='searchGroup'
              placeholder={t('选择分组')}
              optionList={[
                { label: t('选择分组'), value: null },
                ...groupOptions,
              ]}
              className='w-full'
              showClear
              pure
              onChange={() => {
                // 延迟执行搜索，让表单值先更新
                setTimeout(() => {
                  searchChannels(enableTagMode);
                }, 0);
              }}
            />
          </div>
          <Button
            size='small'
            type='tertiary'
            htmlType='submit'
            loading={loading || searching}
            className='w-full md:w-auto'
          >
            {t('查询')}
          </Button>
          <Button
            size='small'
            type='tertiary'
            onClick={() => {
              if (formApi) {
                formApi.reset();
                // 重置后立即查询，使用setTimeout确保表单重置完成
                setTimeout(() => {
                  refresh();
                }, 100);
              }
            }}
            className='w-full md:w-auto'
          >
            {t('重置')}
          </Button>
          <div className='flex flex-wrap items-center justify-end gap-1 text-xs text-gray-600 w-full md:w-auto'>
            <span className='rounded bg-gray-50 px-2 py-1 whitespace-nowrap'>
              {t('总额度')}{' '}
              <span className='font-semibold text-gray-900'>
                {formattedStats.totalAmount}
              </span>
            </span>
            <span className='rounded bg-gray-50 px-2 py-1 whitespace-nowrap'>
              {t('剩余额度')}{' '}
              <span className='font-semibold text-gray-900'>
                {formattedStats.remainingAmount}
              </span>
            </span>
          </div>
        </Form>
      </div>
    </div>
  );
};

export default ChannelsFilters;
