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

import React, { useEffect, useState } from 'react';
import { Card, Spinner, Tabs } from '@heroui/react';
import { useTranslation } from 'react-i18next';

import ModelPricingCombined from '../../pages/Setting/Ratio/ModelPricingCombined';
import GroupRatioSettings from '../../pages/Setting/Ratio/GroupRatioSettings';
import ModelRatioNotSetEditor from '../../pages/Setting/Ratio/ModelRationNotSetEditor';
import UpstreamRatioSync from '../../pages/Setting/Ratio/UpstreamRatioSync';
import ToolPriceSettings from '../../pages/Setting/Ratio/ToolPriceSettings';

import { API, showError, toBoolean } from '../../helpers';

const RatioSetting = () => {
  const { t } = useTranslation();

  let [inputs, setInputs] = useState({
    ModelPrice: '',
    ModelRatio: '',
    CacheRatio: '',
    CreateCacheRatio: '',
    CompletionRatio: '',
    GroupRatio: '',
    GroupGroupRatio: '',
    ImageRatio: '',
    AudioRatio: '',
    AudioCompletionRatio: '',
    AutoGroups: '',
    DefaultUseAutoGroup: false,
    ExposeRatioEnabled: false,
    UserUsableGroups: '',
    'group_ratio_setting.group_special_usable_group': '',
  });

  const [loading, setLoading] = useState(false);

  const getOptions = async () => {
    const res = await API.get('/api/option/');
    const { success, message, data } = res.data;
    if (success) {
      let newInputs = {};
      data.forEach((item) => {
        if (item.value.startsWith('{') || item.value.startsWith('[')) {
          try {
            item.value = JSON.stringify(JSON.parse(item.value), null, 2);
          } catch (e) {
            // Keep the raw value when the backend returns invalid JSON.
          }
        }
        if (['DefaultUseAutoGroup', 'ExposeRatioEnabled'].includes(item.key)) {
          newInputs[item.key] = toBoolean(item.value);
        } else {
          newInputs[item.key] = item.value;
        }
      });
      setInputs(newInputs);
    } else {
      showError(message);
    }
  };

  const onRefresh = async () => {
    try {
      setLoading(true);
      await getOptions();
    } catch (error) {
      showError('刷新失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    onRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className='relative'>
      {loading ? (
        <div className='absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-background/70 backdrop-blur-sm'>
          <Spinner size='lg' />
        </div>
      ) : null}
      <Card className='mt-2.5'>
        <Tabs defaultSelectedKey='pricing' variant='secondary'>
          <Tabs.List aria-label={t('倍率设置')}>
            <Tabs.Tab id='pricing'>{t('模型定价设置')}</Tabs.Tab>
            <Tabs.Tab id='group'>{t('分组相关设置')}</Tabs.Tab>
            <Tabs.Tab id='unset_models'>{t('未设置价格模型')}</Tabs.Tab>
            <Tabs.Tab id='upstream_sync'>{t('上游倍率同步')}</Tabs.Tab>
            <Tabs.Tab id='tool_price'>{t('工具调用定价')}</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel id='pricing' className='pt-6'>
            <ModelPricingCombined options={inputs} refresh={onRefresh} />
          </Tabs.Panel>
          <Tabs.Panel id='group' className='pt-6'>
            <GroupRatioSettings options={inputs} refresh={onRefresh} />
          </Tabs.Panel>
          <Tabs.Panel id='unset_models' className='pt-6'>
            <ModelRatioNotSetEditor options={inputs} refresh={onRefresh} />
          </Tabs.Panel>
          <Tabs.Panel id='upstream_sync' className='pt-6'>
            <UpstreamRatioSync options={inputs} refresh={onRefresh} />
          </Tabs.Panel>
          <Tabs.Panel id='tool_price' className='pt-6'>
            <ToolPriceSettings options={inputs} />
          </Tabs.Panel>
        </Tabs>
      </Card>
    </div>
  );
};

export default RatioSetting;
